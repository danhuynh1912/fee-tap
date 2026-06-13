import { num } from '../lib/utils'
import { BALLS_PER_BOX } from '../constants'

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

function sessionsForPeriod(weekdays, period) {
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
  // cost = amount that still needs to be paid (0 if stock is sufficient)
  const cost = refillCost

  return { boxesLeft, sessionsLeft, estimatedEmptyDate, refillBoxes, refillCost, cost }
}

// ---------------------------------------------------------------------------
// computePaymentTimeline — aggregates all slots into running + upcoming
// ---------------------------------------------------------------------------

export function computePaymentTimeline(slots, settings, memberCount, now = new Date()) {
  if (!slots || !slots.length) {
    return { running: [], upcoming: [], shuttleThisMonth: null, totalUpcomingPerMember: 0, effectiveMemberCount: memberCount }
  }

  const slotResults = slots.map((slot) => computeSlot(slot, now))
  const running = [...slotResults]
  const upcoming = slotResults.filter((r) => r.nextDeadline).sort((a, b) => a.nextDeadline - b.nextDeadline)

  const hasEquipment = settings._hasEquipment !== false
  let shuttleThisMonth = null
  if (hasEquipment) {
    shuttleThisMonth =
      settings.shuttle_mode === 'inventory'
        ? { mode: 'inventory', ...inventoryStatus(settings.shuttle_stock, slots, settings, now) }
        : { mode: 'estimate', ...estimateShuttle(slots, settings, now) }
  }

  const effectiveMemberCount = resolveFeeMemberCount(settings, memberCount)
  const soonCourtCost = upcoming.reduce((sum, r) => sum + r.nextCourtCost, 0)

  // Next shuttle period item — independent from court cycle
  let nextShuttleItem = null
  let soonShuttleCost = 0
  if (hasEquipment && settings.shuttle_mode !== 'inventory') {
    const n = Math.max(1, Math.round(num(settings.shuttle_cycle_months)) || 1)
    const here = mIdx(now.getFullYear(), now.getMonth())
    const anchor = Math.max(1, Math.min(12, Math.round(num(settings.shuttle_cycle_start_month, 1)))) - 1
    const off = n === 1 ? 0 : (((now.getMonth() - anchor) % n) + n) % n
    const nextShuttlePeriod = makePeriod(n === 1 ? 'month' : 'cycle', here - off + n, n)
    const sessions = slots.reduce((sum, slot) => {
      return sum + sessionsForPeriod(Array.isArray(slot.weekdays) ? slot.weekdays : [], nextShuttlePeriod).total
    }, 0)
    const boxes = Math.ceil((sessions * num(settings.estimated_shuttlecocks)) / BALLS_PER_BOX)
    const cost = boxes * num(settings.price_per_box)
    soonShuttleCost = cost
    if (cost > 0) {
      // deadline = last day of the CURRENT shuttle cycle (collect before next period starts)
      const currentEnd = fromIdx(here - off + n - 1)
      const shuttleDeadline = new Date(currentEnd.year, currentEnd.month0 + 1, 0)
      const msPerDay = 86400000
      const daysUntil = Math.ceil((shuttleDeadline - now) / msPerDay)
      nextShuttleItem = { period: nextShuttlePeriod, sessions, boxes, cost, deadline: shuttleDeadline, daysUntil }
    }
  }
  const totalUpcomingPerMember = effectiveMemberCount > 0 ? Math.ceil((soonCourtCost + soonShuttleCost) / effectiveMemberCount) : 0

  return { running, upcoming, shuttleThisMonth, nextShuttleItem, totalUpcomingPerMember, soonCourtCost, soonShuttleCost, effectiveMemberCount }
}

// ---------------------------------------------------------------------------
// Fee member count — respects fee_split_mode + committed vote
// ---------------------------------------------------------------------------

export function resolveFeeMemberCount(settings, totalMembers, committedCount = null) {
  if (settings.fee_split_mode === 'committed_only' && committedCount !== null) {
    return committedCount
  }
  return totalMembers
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
