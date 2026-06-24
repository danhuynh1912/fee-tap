import { num } from '../lib/utils'
import { BALLS_PER_BOX } from '../constants'
import { resolveFeeContext } from './fee/resolveFeeContext'

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

const mIdx = (y, m0) => y * 12 + m0
const fromIdx = (i) => ({ year: Math.floor(i / 12), month0: ((i % 12) + 12) % 12 })

function countWeekdaysInMonth(year, month0, weekdays) {
  const set = new Set(weekdays)
  const last = new Date(year, month0 + 1, 0).getDate()
  const breakdown = {}
  let total = 0
  for (let d = 1; d <= last; d++) {
    const wd = new Date(year, month0, d).getDay()
    if (set.has(wd)) {
      total++
      breakdown[wd] = (breakdown[wd] || 0) + 1
    }
  }
  return { total, breakdown }
}

function makePeriod(kind, startIdx, len) {
  const months = []
  for (let k = 0; k < len; k++) months.push(fromIdx(startIdx + k))
  return { kind, startIdx, len, months }
}

export function sessionsForPeriod(weekdays, period) {
  if (!weekdays.length) return { total: 0, breakdown: {} }
  let total = 0
  const breakdown = {}
  for (const { year, month0 } of period.months) {
    const c = countWeekdaysInMonth(year, month0, weekdays)
    total += c.total
    for (const k in c.breakdown) breakdown[k] = (breakdown[k] || 0) + c.breakdown[k]
  }
  return { total, breakdown }
}

function sessionsHappenedByNow(weekdays, period, today = new Date()) {
  const wdSet = new Set(weekdays.map(Number))
  const { year: sy, month0: sm0 } = period.months[0]
  const lastM = period.months[period.months.length - 1]
  const periodEnd = new Date(lastM.year, lastM.month0 + 1, 0)
  const cutoff = today <= periodEnd ? today : periodEnd
  const periodStart = new Date(sy, sm0, 1)
  const cutoffDay = new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate())
  let count = 0
  const d = new Date(periodStart)
  while (d <= cutoffDay) {
    if (wdSet.has(d.getDay())) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// ---------------------------------------------------------------------------
// Period resolution
// ---------------------------------------------------------------------------

export function periodDateRange(period) {
  const { year: sy, month0: sm0 } = period.months[0]
  const lastM = period.months[period.months.length - 1]
  const daysInLast = new Date(lastM.year, lastM.month0 + 1, 0).getDate()
  const start = `${sy}-${String(sm0 + 1).padStart(2, '0')}-01`
  const end = `${lastM.year}-${String(lastM.month0 + 1).padStart(2, '0')}-${String(daysInLast).padStart(2, '0')}`
  return { start, end }
}

export function resolvePeriodForSlot(slot, now = new Date()) {
  const here = mIdx(now.getFullYear(), now.getMonth())
  const n = Math.max(1, Math.round(num(slot.cycle_months)) || 1)
  if (n === 1) {
    return { current: makePeriod('month', here, 1), next: makePeriod('month', here + 1, 1) }
  }
  const anchor = Math.max(1, Math.min(12, Math.round(num(slot.cycle_start_month, 1)))) - 1
  const off = (((now.getMonth() - anchor) % n) + n) % n
  const start = here - off
  return { current: makePeriod('cycle', start, n), next: makePeriod('cycle', start + n, n) }
}

// ---------------------------------------------------------------------------
// Collection deadline
//
// renewal_day = day-of-month in the month BEFORE the period starts.
// e.g. quarterly T5-T7, renewal_day=25 → deadline = April 25
// ---------------------------------------------------------------------------

export function slotCollectionDeadline(slot, period) {
  if (!slot.renewal_day) return null
  const { year: sy, month0: sm0 } = period.months[0]
  const deadlineIdx = mIdx(sy, sm0) - 1
  const { year, month0 } = fromIdx(deadlineIdx)
  const day = Math.min(slot.renewal_day, new Date(year, month0 + 1, 0).getDate())
  return new Date(year, month0, day)
}

// ---------------------------------------------------------------------------
// computeSlot — full forecast for one court slot
// ---------------------------------------------------------------------------

export function computeSlot(slot, now = new Date()) {
  const weekdays = Array.isArray(slot.weekdays) ? slot.weekdays : []
  const periods = resolvePeriodForSlot(slot, now)

  const sess = sessionsForPeriod(weekdays, periods.current)
  const nextSess = sessionsForPeriod(weekdays, periods.next)
  const happened = sessionsHappenedByNow(weekdays, periods.current, now)

  const price = num(slot.price_per_hour)
  const hours = num(slot.hours_per_session)
  const courtCost = price * hours * sess.total
  const nextCourtCost = price * hours * nextSess.total

  const currentDeadline = slotCollectionDeadline(slot, periods.current)
  const nextDeadline = slotCollectionDeadline(slot, periods.next)

  const msPerDay = 86400000
  const daysUntilNext = nextDeadline ? Math.ceil((nextDeadline - now) / msPerDay) : null

  return {
    slot,
    period: periods.current,
    nextPeriod: periods.next,
    totalSessions: sess.total,
    breakdown: sess.breakdown,
    nextSessions: nextSess.total,
    courtCost,
    nextCourtCost,
    happened,
    currentDeadline,
    nextDeadline,
    daysUntilNext,
    isDeadlineSoon: daysUntilNext !== null && daysUntilNext <= 30 && daysUntilNext >= 0,
  }
}

// ---------------------------------------------------------------------------
// Shuttle helpers
// ---------------------------------------------------------------------------

export function estimateShuttle(slots, shuttleConfig, now = new Date()) {
  const here = mIdx(now.getFullYear(), now.getMonth())
  const n = Math.max(1, Math.round(num(shuttleConfig.shuttle_cycle_months)) || 1)
  const anchor = Math.max(1, Math.min(12, Math.round(num(shuttleConfig.shuttle_cycle_start_month, 1)))) - 1
  const off = n === 1 ? 0 : (((now.getMonth() - anchor) % n) + n) % n
  const shuttlePeriod = makePeriod(n === 1 ? 'month' : 'cycle', here - off, n)
  const totalSessions = slots.reduce((sum, slot) => {
    return sum + sessionsForPeriod(Array.isArray(slot.weekdays) ? slot.weekdays : [], shuttlePeriod).total
  }, 0)
  const boxes = Math.ceil((totalSessions * num(shuttleConfig.estimated_shuttlecocks)) / BALLS_PER_BOX)
  const cost = boxes * num(shuttleConfig.price_per_box)
  return { totalSessions, boxes, cost }
}

export function inventoryStatus(shuttleStock, slots, shuttleConfig, now = new Date()) {
  const boxesLeft = num(shuttleStock)
  const tubesLeft = boxesLeft * BALLS_PER_BOX
  const tubesPerSession = num(shuttleConfig.estimated_shuttlecocks)

  const here = mIdx(now.getFullYear(), now.getMonth())
  const currentMonth = makePeriod('month', here, 1)
  const sessionsPerMonth = slots.reduce((sum, slot) => {
    return sum + sessionsForPeriod(Array.isArray(slot.weekdays) ? slot.weekdays : [], currentMonth).total
  }, 0)

  const tubesPerMonth = sessionsPerMonth * tubesPerSession
  const sessionsLeft = tubesPerSession > 0 ? Math.floor(tubesLeft / tubesPerSession) : 0

  let estimatedEmptyDate = null
  if (tubesPerMonth > 0 && boxesLeft > 0) {
    estimatedEmptyDate = new Date(now.getTime() + (tubesLeft / tubesPerMonth) * 30.44 * 86400000)
  }

  // Only count refill boxes needed BEYOND current stock
  const tubesNeededThisMonth = sessionsPerMonth * tubesPerSession
  const tubesShort = Math.max(0, tubesNeededThisMonth - tubesLeft)
  const refillBoxes = tubesShort > 0 ? Math.ceil(tubesShort / BALLS_PER_BOX) : 0
  const refillCost = refillBoxes * num(shuttleConfig.price_per_box)
  const cost = refillCost

  return { boxesLeft, sessionsLeft, estimatedEmptyDate, refillBoxes, refillCost, cost }
}

// ---------------------------------------------------------------------------
// computeShuttleStock — event-sourced inventory projection
//
// currentStock  = SUM(delta) — confirmed from all transactions
// projectedStock = currentStock − (unlogged past sessions × rate)
//   where "unlogged past sessions" = scheduled sessions since the last restock
//   that have neither a session_log entry nor a shuttle_transaction deduction
//
// Rate change (settle flow): caller inserts 'estimated' transactions for all
// unlogged sessions at the OLD rate before saving the new rate. This locks
// history so future projections start clean from the new rate.
// ---------------------------------------------------------------------------

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeShuttleStock(shuttleTxns, slots, settings, logs, now = new Date()) {
  const rate = num(settings.estimated_shuttlecocks) || 0
  const allWeekdays = [...new Set(slots.flatMap((s) => (Array.isArray(s.weekdays) ? s.weekdays : [])))]
  const currentStock = (shuttleTxns || []).reduce((sum, t) => sum + (t.delta || 0), 0)

  if (!allWeekdays.length || rate === 0) {
    return {
      currentStock,
      projectedStock: currentStock,
      unloggedCount: 0,
      sessionsLeft: rate > 0 ? Math.floor(currentStock / rate) : 0,
      nextBuyDate: null,
      totalBalls: Math.max(0, currentStock),
    }
  }

  // Anchor = most recent restock or opening transaction
  const restocks = (shuttleTxns || []).filter((t) => t.source === 'restock' || t.source === 'opening')
  if (!restocks.length) {
    // No restock anchor — use most recent adjustment as soft anchor.
    // Deduct actual balls consumed in session logs after that adjustment date.
    const adjustments = (shuttleTxns || []).filter((t) => t.source === 'adjustment' || t.source === 'estimated')
    if (!adjustments.length) {
      return { currentStock: 0, projectedStock: 0, unloggedCount: 0, sessionsLeft: 0, nextBuyDate: null, totalBalls: 0 }
    }
    const latestAdj = adjustments.reduce((a, b) => (a.created_at > b.created_at ? a : b))
    const adjDate = new Date(latestAdj.created_at)
    adjDate.setHours(0, 0, 0, 0)
    const adjStr = localDateStr(adjDate)
    const logsByDate = Object.fromEntries((logs || []).filter((l) => l.played_on >= adjStr).map((l) => [l.played_on, l]))
    const wdSet = new Set(allWeekdays.map(Number))
    const todayStr = localDateStr(now)
    let used = 0
    let unloggedCount = 0
    const d = new Date(adjDate)
    while (localDateStr(d) < todayStr) {
      const ds = localDateStr(d)
      if (wdSet.has(d.getDay())) {
        const log = logsByDate[ds]
        if (log) {
          used += num(log.actual_shuttlecocks) || rate
        } else {
          used += rate
          unloggedCount++
        }
      }
      d.setDate(d.getDate() + 1)
    }
    const projectedStock = currentStock - used
    return {
      currentStock,
      projectedStock,
      unloggedCount,
      sessionsLeft: projectedStock > 0 && rate > 0 ? Math.floor(projectedStock / rate) : 0,
      nextBuyDate: projectedStock <= 0 ? localDateStr(now) : null,
      totalBalls: Math.max(0, projectedStock),
    }
  }

  const latestRestock = restocks.reduce((latest, t) => (t.created_at > latest.created_at ? t : latest))
  const anchorDate = new Date(latestRestock.created_at)
  anchorDate.setHours(0, 0, 0, 0)

  const todayStr = localDateStr(now)

  // Dates already settled via existing transactions or logs
  const settledDates = new Set()
  for (const t of shuttleTxns || []) {
    if (t.session_date && t.source !== 'restock' && t.source !== 'opening') {
      settledDates.add(t.session_date)
    }
  }
  for (const l of logs || []) {
    if (l.played_on) settledDates.add(l.played_on)
  }

  // Walk from anchor to yesterday, collect unlogged scheduled sessions
  const wdSet = new Set(allWeekdays.map(Number))
  const unloggedDates = []
  const d = new Date(anchorDate)
  while (true) {
    const dateStr = localDateStr(d)
    if (dateStr >= todayStr) break
    if (wdSet.has(d.getDay()) && !settledDates.has(dateStr)) {
      unloggedDates.push(dateStr)
    }
    d.setDate(d.getDate() + 1)
  }

  const projectedStock = currentStock - unloggedDates.length * rate

  // Project forward: how many future sessions before stock runs out?
  let stockLeft = projectedStock
  let sessionsLeft = 0
  let nextBuyDate = null

  if (projectedStock <= 0) {
    nextBuyDate = todayStr
  } else {
    const fd = new Date(now)
    fd.setHours(0, 0, 0, 0)
    let iters = 0
    while (stockLeft > 0 && iters++ < 730) {
      if (wdSet.has(fd.getDay())) {
        stockLeft -= rate
        if (stockLeft >= 0) sessionsLeft++
        else if (!nextBuyDate) nextBuyDate = localDateStr(fd)
      }
      fd.setDate(fd.getDate() + 1)
    }
  }

  return {
    currentStock,
    projectedStock,
    unloggedCount: unloggedDates.length,
    unloggedDates,
    sessionsLeft,
    nextBuyDate,
    totalBalls: Math.max(0, projectedStock),
  }
}

// ---------------------------------------------------------------------------
// settleUnloggedSessions — called before saving a new estimated_shuttlecocks
// value. Inserts 'estimated' deduction transactions for every past unlogged
// session using the OLD rate, so history is frozen before the new rate applies.
// Returns the list of inserted rows (or [] if nothing to settle).
// ---------------------------------------------------------------------------

export function buildSettleInserts(shuttleTxns, slots, logs, clubId, oldRate, now = new Date()) {
  const allWeekdays = [...new Set(slots.flatMap((s) => (Array.isArray(s.weekdays) ? s.weekdays : [])))]
  if (!allWeekdays.length || !oldRate) return []

  const restocks = (shuttleTxns || []).filter((t) => t.source === 'restock' || t.source === 'opening')
  if (!restocks.length) return []

  const latestRestock = restocks.reduce((latest, t) => (t.created_at > latest.created_at ? t : latest))
  const anchorDate = new Date(latestRestock.created_at)
  anchorDate.setHours(0, 0, 0, 0)

  const todayStr = localDateStr(now)
  const settledDates = new Set()
  for (const t of shuttleTxns || []) {
    if (t.session_date && t.source !== 'restock' && t.source !== 'opening') {
      settledDates.add(t.session_date)
    }
  }
  for (const l of logs || []) {
    if (l.played_on) settledDates.add(l.played_on)
  }

  const wdSet = new Set(allWeekdays.map(Number))
  const inserts = []
  const d = new Date(anchorDate)
  while (true) {
    const dateStr = localDateStr(d)
    if (dateStr >= todayStr) break
    if (wdSet.has(d.getDay()) && !settledDates.has(dateStr)) {
      inserts.push({
        club_id: clubId,
        delta: -Math.round(oldRate),
        source: 'estimated',
        session_date: dateStr,
        rate_used: oldRate,
        note: 'Auto-settled before rate change',
      })
    }
    d.setDate(d.getDate() + 1)
  }
  return inserts
}

// ---------------------------------------------------------------------------
// buildUpcomingShuttleItems — shared helper used by computePaymentTimeline
// and projectUpcomingCollections to generate shuttle purchase items.
//
// courtDeadlines: array of Date objects from court slots — used to set horizon.
// Generates one item per shuttle cycle, up to (and including) the month of
// the furthest court deadline, then always at least 1 item.
// ---------------------------------------------------------------------------

function buildUpcomingShuttleItems(slots, settings, courtDeadlines, now = new Date()) {
  if (!num(settings.price_per_box) || !num(settings.estimated_shuttlecocks)) return []

  const rate = num(settings.estimated_shuttlecocks)
  const pricePerBox = num(settings.price_per_box)
  const n = Math.max(1, Math.round(num(settings.shuttle_cycle_months)) || 1)
  const anchor = Math.max(1, Math.min(12, Math.round(num(settings.shuttle_cycle_start_month, 1)))) - 1
  const here = mIdx(now.getFullYear(), now.getMonth())
  const off = n === 1 ? 0 : (((now.getMonth() - anchor) % n) + n) % n
  const allWeekdays = [...new Set(slots.flatMap((s) => Array.isArray(s.weekdays) ? s.weekdays : []))]

  const furthest = courtDeadlines.reduce((max, d) => d > max ? d : max, now)
  // Horizon = end of the month of the furthest court deadline
  // (shuttle deadline Jul 31 must not be cut when court deadline is Jul 25)
  const horizonEnd = new Date(furthest.getFullYear(), furthest.getMonth() + 1, 0)
  const msPerDay = 86400000

  const items = []
  let i = 1
  while (i <= 24) {
    const period = makePeriod(n === 1 ? 'month' : 'cycle', here - off + n * i, n)
    const { year: sy, month0: sm0 } = period.months[0]
    const deadline = new Date(sy, sm0, 0) // last day of month before period
    if (deadline > horizonEnd) break
    const totalSessions = allWeekdays.length ? sessionsForPeriod(allWeekdays, period).total : 0
    if (totalSessions > 0) {
      const boxes = Math.ceil((totalSessions * rate) / BALLS_PER_BOX)
      const daysUntil = Math.ceil((deadline - now) / msPerDay)
      items.push({ period, deadline, daysUntil, totalSessions, boxes, cost: boxes * pricePerBox })
    }
    i++
  }
  // Always at least 1
  if (!items.length) {
    const period = makePeriod(n === 1 ? 'month' : 'cycle', here - off + n, n)
    const { year: sy, month0: sm0 } = period.months[0]
    const deadline = new Date(sy, sm0, 0)
    const totalSessions = allWeekdays.length ? sessionsForPeriod(allWeekdays, period).total : 0
    if (totalSessions > 0) {
      const boxes = Math.ceil((totalSessions * rate) / BALLS_PER_BOX)
      const daysUntil = Math.ceil((deadline - now) / msPerDay)
      items.push({ period, deadline, daysUntil, totalSessions, boxes, cost: boxes * pricePerBox })
    }
  }
  return items
}

// ---------------------------------------------------------------------------
// computePaymentTimeline — aggregates all slots into running + upcoming
// ---------------------------------------------------------------------------

export function computePaymentTimeline(slots, settings, memberCount, committedCount = null, now = new Date()) {
  if (!slots || !slots.length) {
    return { running: [], upcoming: [], nextShuttleItem: null, totalUpcomingPerMember: 0, effectiveMemberCount: memberCount }
  }

  const slotResults = slots.map((slot) => computeSlot(slot, now))
  const running = [...slotResults]
  const upcoming = slotResults.filter((r) => r.nextDeadline).sort((a, b) => a.nextDeadline - b.nextDeadline)

  const effectiveMemberCount = resolveFeeMemberCount(settings, memberCount, committedCount)
  const soonCourtCost = upcoming.reduce((sum, r) => sum + r.nextCourtCost, 0)

  const hasEquip = settings._hasEquipment !== false
  const upcomingShuttleItems = hasEquip
    ? buildUpcomingShuttleItems(slots, settings, upcoming.map((r) => r.nextDeadline).filter(Boolean), now)
    : []

  const soonShuttleCost = upcomingShuttleItems[0]?.cost ?? 0
  const totalUpcomingPerMember = effectiveMemberCount > 0 ? Math.ceil((soonCourtCost + soonShuttleCost) / effectiveMemberCount) : 0

  return { running, upcoming, upcomingShuttleItems, totalUpcomingPerMember, soonCourtCost, soonShuttleCost, effectiveMemberCount }
}

// ---------------------------------------------------------------------------
// projectUpcomingCollections — minimal forward-looking list of upcoming
// "đợt thu" items, one per court slot stream + one shuttle stream, WITHOUT
// merging their costs into a single blended number. Walks forward only far
// enough to guarantee every stream (each court slot + shuttle) appears at
// least once — e.g. if court collects every 3 months and shuttle every
// month, the list has 3 entries: shuttle, shuttle, shuttle+court.
// ---------------------------------------------------------------------------

function advancePeriod(period, n) {
  return makePeriod(period.kind, period.startIdx + n, period.len)
}

export function projectUpcomingCollections(slots, settings, now = new Date()) {
  if (!slots || !slots.length) return []

  const slotStreams = slots.map((slot) => {
    const n = Math.max(1, Math.round(num(slot.cycle_months)) || 1)
    const weekdays = Array.isArray(slot.weekdays) ? slot.weekdays : []
    const { next } = resolvePeriodForSlot(slot, now)
    return { kind: 'court', slot, period: next, n, weekdays }
  })

  if (!slotStreams.length) return []

  const firstDeadlines = slotStreams.map((s) => slotCollectionDeadline(s.slot, s.period))
  const validFirstDeadlines = firstDeadlines.filter(Boolean)
  if (!validFirstDeadlines.length) return []
  const monthKey = (d) => d.getFullYear() * 12 + d.getMonth()
  const thresholdKey = Math.max(...validFirstDeadlines.map(monthKey))

  const groups = []
  const MAX_ITER = 36
  for (const s of slotStreams) {
    let period = s.period
    let guard = 0
    while (guard++ < MAX_ITER) {
      const deadline = slotCollectionDeadline(s.slot, period)
      const sessions = sessionsForPeriod(s.weekdays, period).total
      const cost = num(s.slot.price_per_hour) * num(s.slot.hours_per_session) * sessions
      if (!deadline || monthKey(deadline) > thresholdKey) break

      const key = `${deadline.getFullYear()}-${deadline.getMonth()}`
      let group = groups.find((g) => g.key === key)
      if (!group) {
        group = { key, deadline, court: [] }
        groups.push(group)
      }
      if (deadline < group.deadline) group.deadline = deadline
      group.court.push({ slot: s.slot, cost, sessions, period })
      period = advancePeriod(period, s.n)
    }
  }

  // Add shuttle stream — same horizon/merge logic as computePaymentTimeline
  // Use shared helper — same logic as computePaymentTimeline
  const courtDeadlines = groups.map((g) => g.deadline).filter(Boolean)
  const shuttleItems = buildUpcomingShuttleItems(slots, settings, courtDeadlines, now)
  for (const si of shuttleItems) {
    const key = `${si.deadline.getFullYear()}-${si.deadline.getMonth()}`
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, deadline: si.deadline, court: [] }
      groups.push(group)
    }
    if (si.deadline < group.deadline) group.deadline = si.deadline
    group.shuttle = si
  }

  groups.sort((a, b) => a.deadline - b.deadline)
  return groups.map(({ key, ...rest }) => rest)
}

// ---------------------------------------------------------------------------
// Fee member count — thin wrapper kept for backward compat
// ---------------------------------------------------------------------------

export function resolveFeeMemberCount(settings, totalMembers, committedCount = null) {
  return resolveFeeContext({ settings, memberCount: totalMembers, committedCount }).effectiveCount
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

export function formatPeriodLabel(period, lang) {
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US'
  if (period.kind === 'month') {
    const { year, month0 } = period.months[0]
    return new Date(year, month0, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }
  const a = period.months[0],
    b = period.months[period.len - 1]
  const fmt = (m) => new Date(m.year, m.month0, 1).toLocaleDateString(locale, { month: 'short' })
  const yearSuffix = a.year === b.year ? ` ${b.year}` : ` ${a.year}–${b.year}`
  return `${fmt(a)}–${fmt(b)}${yearSuffix}`
}

export function monthName(m1, lang) {
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US'
  return new Date(2000, m1 - 1, 1).toLocaleDateString(locale, { month: 'long' })
}

export function resolveShuttlePeriodLabel(settings, lang, now = new Date()) {
  const n = Math.max(1, Math.round(num(settings.shuttle_cycle_months)) || 1)
  const here = mIdx(now.getFullYear(), now.getMonth())
  const anchor = Math.max(1, Math.min(12, Math.round(num(settings.shuttle_cycle_start_month, 1)))) - 1
  const off = n === 1 ? 0 : (((now.getMonth() - anchor) % n) + n) % n
  const period = makePeriod(n === 1 ? 'month' : 'cycle', here - off, n)
  return formatPeriodLabel(period, lang)
}

// ---------------------------------------------------------------------------
// Membership vote cycle helpers
// ---------------------------------------------------------------------------

/**
 * Compute the minimum allowed cycle for the fixed-roster vote.
 * SSOT: derived entirely from slots + settings — never hardcoded in UI.
 *
 * courtMinMonths = min(slot.cycle_months) across all slots (falls back to
 *   billing_cycle 'quarter'→3 / 'month'→1 when cycle_months is absent)
 * shuttleMonths  = settings.shuttle_cycle_months (default 1)
 * minMonths      = min(courtMinMonths, shuttleMonths)
 */
export function computeMembershipVoteCycle(slots, settings) {
  let courtMinMonths = 1
  if (slots && slots.length) {
    courtMinMonths = slots.reduce((mn, s) => {
      const n = num(s.cycle_months, 0)
      const m = n >= 1 ? n : s.billing_cycle === 'quarter' ? 3 : 1
      return Math.min(mn, m)
    }, Infinity)
    if (!isFinite(courtMinMonths)) courtMinMonths = 1
  } else {
    courtMinMonths = settings?.billing_cycle === 'quarter' ? 3 : 1
  }
  const shuttleMonths = Math.max(1, num(settings?.shuttle_cycle_months, 1))
  const minMonths = Math.min(courtMinMonths, shuttleMonths)
  return { courtMinMonths, shuttleMonths, minMonths }
}

/**
 * Compute the start/end ISO dates for the NEXT cycle period.
 * Starts on the first day of next month, spans fixedMonths months.
 */
export function nextCyclePeriod(fixedMonths, now = new Date()) {
  const n = Math.max(1, Math.round(fixedMonths) || 1)
  const nextIdx = mIdx(now.getFullYear(), now.getMonth()) + 1
  const endIdx = nextIdx + n - 1
  const { year: sy, month0: sm0 } = fromIdx(nextIdx)
  const { year: ey, month0: em0 } = fromIdx(endIdx)
  const daysInLast = new Date(ey, em0 + 1, 0).getDate()
  const start = `${sy}-${String(sm0 + 1).padStart(2, '0')}-01`
  const end = `${ey}-${String(em0 + 1).padStart(2, '0')}-${String(daysInLast).padStart(2, '0')}`
  const period = makePeriod(n === 1 ? 'month' : 'cycle', nextIdx, n)
  return { start, end, period }
}

export function cycleLabelShort(n, lang) {
  const months = Math.max(1, n || 1)
  if (months === 1) return lang === 'vi' ? 'tháng' : 'month'
  return lang === 'vi' ? `${months} tháng một` : `every ${months} months`
}

// ---------------------------------------------------------------------------
// Guest revenue (unchanged)
// ---------------------------------------------------------------------------

export function calcGuestRevenue({ mode, guestMale, guestFemale, feeMale, feeFemale, shuttleCost, courtCost, memberCount }) {
  const gm = Math.round(guestMale) || 0
  const gf = Math.round(guestFemale) || 0
  if (!gm && !gf) return 0
  if (mode === 'fixed_by_gender') return gm * (feeMale || 0) + gf * (feeFemale || 0)
  if (mode === 'split_shuttle') {
    const femalePart = gf * (feeFemale || 0)
    const totalMales = Math.max(1, (memberCount || 1) + gm)
    return femalePart + gm * Math.round((shuttleCost || 0) / totalMales)
  }
  const totalPlayers = Math.max(1, (memberCount || 1) + gm + gf)
  return (gm + gf) * Math.round(((courtCost || 0) + (shuttleCost || 0)) / totalPlayers)
}

// ---------------------------------------------------------------------------
// Migration helper — synthesize court_slots rows from legacy session_configs
// Called once by useClubData when court_slots is empty for a club
// ---------------------------------------------------------------------------

export function synthesizeSlotsFromLegacy(settings) {
  const raw = settings.session_configs
  const configs = Array.isArray(raw) && raw.length ? raw : null

  if (!configs) {
    const weekdays = Array.isArray(settings.play_weekdays) ? settings.play_weekdays : []
    return weekdays.map((wd, i) => ({
      club_id: settings.club_id,
      name: `Sân ${i + 1}`,
      venue_name: null,
      weekdays: [wd],
      price_per_hour: num(settings.court_prices_by_weekday?.[wd]) || num(settings.court_price_per_hour) || 0,
      hours_per_session: num(settings.hours_per_session) || 2,
      payment_mode: settings.court_payment_mode || 'session',
      cycle_months: 1,
      cycle_start_month: 1,
      renewal_day: null,
      sort_order: i,
    }))
  }

  return configs.map((sc, i) => ({
    club_id: settings.club_id,
    name: `Sân ${i + 1}`,
    venue_name: null,
    weekdays: sc.weekday !== null && sc.weekday !== undefined ? [sc.weekday] : [],
    price_per_hour: num(sc.court_price_per_hour) || 0,
    hours_per_session: num(sc.hours_per_session) || 2,
    payment_mode: sc.court_payment_mode || 'session',
    cycle_months: 1,
    cycle_start_month: 1,
    renewal_day: null,
    sort_order: i,
  }))
}

// ---------------------------------------------------------------------------
// Legacy shims — keep old callers working during transition; remove in Phase 6
// ---------------------------------------------------------------------------

export function resolvePeriods(s, now = new Date()) {
  return resolvePeriodForSlot(
    {
      cycle_months: s.cycle_months || 1,
      cycle_start_month: s.cycle_start_month || 1,
    },
    now
  )
}

export function getSessionConfigs(settings) {
  const raw = settings.session_configs
  if (Array.isArray(raw) && raw.length) return raw
  const weekdays = Array.isArray(settings.play_weekdays) ? settings.play_weekdays : []
  const priceMap = settings.court_prices_by_weekday || {}
  const base = {
    court_price_per_hour: num(settings.court_price_per_hour) || 120000,
    hours_per_session: num(settings.hours_per_session) || 2,
    court_payment_mode: settings.court_payment_mode || 'session',
    cycle_months: settings.cycle_months || 1,
    cycle_start_month: settings.cycle_start_month || 1,
  }
  if (!weekdays.length) return [{ ...base, weekday: null }]
  return weekdays.map((wd) => ({
    ...base,
    weekday: wd,
    court_price_per_hour: priceMap[wd] !== undefined ? num(priceMap[wd]) : base.court_price_per_hour,
  }))
}

export function computeAll(settings, memberCount, hasEquipment = true, now = new Date(), actualSlots = null) {
  const slots = actualSlots && actualSlots.length ? actualSlots : synthesizeSlotsFromLegacy(settings)
  const settingsWithEquip = { ...settings, _hasEquipment: hasEquipment }
  const timeline = computePaymentTimeline(slots, settingsWithEquip, memberCount, now)

  const totalMonthlyCourtCost = timeline.running.reduce((s, r) => {
    const divisor = r.slot.cycle_months || 1
    return s + r.courtCost / divisor
  }, 0)
  // Actual period cost — no normalization (quarterly shows full quarter cost)
  const totalPeriodCourtCost = timeline.running.reduce((s, r) => s + r.courtCost, 0)
  const shuttleCost = timeline.shuttleThisMonth?.cost || 0
  const totalMonthlyCost = totalMonthlyCourtCost + shuttleCost
  const totalPeriodCost = totalPeriodCourtCost + shuttleCost
  const fund = num(settings.current_fund)
  const balance = fund - totalMonthlyCost
  const deficit = balance < 0 ? -balance : 0
  const suggestedFee = memberCount > 0 ? Math.ceil(totalPeriodCost / memberCount) : 0
  const perMemberDeficit = memberCount > 0 && deficit > 0 ? Math.ceil(deficit / memberCount) : 0
  const totalHappened = timeline.running.reduce((s, r) => s + r.happened, 0)
  const totalScheduled = timeline.running.reduce((s, r) => s + r.totalSessions, 0)
  // Unique sessions = count distinct play dates (multiple courts same day = 1 session)
  const periodWeekdayMap = new Map()
  for (const r of timeline.running) {
    const key = JSON.stringify(r.period)
    if (!periodWeekdayMap.has(key)) periodWeekdayMap.set(key, { period: r.period, weekdays: new Set() })
    for (const wd of r.slot.weekdays || []) periodWeekdayMap.get(key).weekdays.add(wd)
  }
  let uniqueScheduled = 0,
    uniqueHappened = 0
  for (const { period, weekdays } of periodWeekdayMap.values()) {
    uniqueScheduled += sessionsForPeriod([...weekdays], period).total
    uniqueHappened += sessionsHappenedByNow([...weekdays], period, now)
  }
  const venues = timeline.running.map((r) => ({
    weekday: r.slot.weekdays?.[0] ?? null,
    name: r.slot.name ?? null,
    venue_name: r.slot.venue_name ?? null,
    cycle_months: r.slot.cycle_months || 1,
    court_payment_mode: r.slot.payment_mode,
    period: r.period,
    nextPeriod: r.nextPeriod,
    totalSessions: r.totalSessions,
    nextSessions: r.nextSessions,
    breakdown: r.breakdown,
    courtCost: r.courtCost,
    monthlyCourtCost: r.courtCost / (r.slot.cycle_months || 1),
    nextMonthlyCourtCost: r.nextCourtCost / (r.slot.cycle_months || 1),
    happened: r.happened,
    currentDeadline: r.currentDeadline,
  }))

  return {
    venues,
    totalMonthlyCourtCost,
    totalMonthlySessions: timeline.shuttleThisMonth?.totalSessions || 0,
    shuttleCost,
    boxes: timeline.shuttleThisMonth?.boxes || 0,
    totalMonthlyCost,
    totalPeriodCost,
    fund,
    balance,
    deficit,
    suggestedFee,
    perMemberDeficit,
    nextTotalCost: totalMonthlyCost,
    nextSuggestedFee: suggestedFee,
    nextSessions: timeline.running.reduce((s, r) => s + r.nextSessions, 0),
    totalHappened,
    totalScheduled,
    uniqueScheduled,
    uniqueHappened,
  }
}
