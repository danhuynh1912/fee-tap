import { num } from '../lib/utils'
import { BALLS_PER_BOX, DEFAULT_SESSION_CONFIG } from '../constants'

const mIdx = (y, m0) => y * 12 + m0
const fromIdx = (i) => ({ year: Math.floor(i / 12), month0: ((i % 12) + 12) % 12 })

function countWeekdays(year, month0, weekdays) {
  const set = new Set(weekdays)
  const last = new Date(year, month0 + 1, 0).getDate()
  const breakdown = {}
  let total = 0
  for (let d = 1; d <= last; d++) {
    const wd = new Date(year, month0, d).getDay()
    if (set.has(wd)) { total++; breakdown[wd] = (breakdown[wd] || 0) + 1 }
  }
  return { total, breakdown }
}

function makePeriod(kind, startIdx, len) {
  const months = []
  for (let k = 0; k < len; k++) months.push(fromIdx(startIdx + k))
  return { kind, startIdx, len, months }
}

export function resolvePeriods(s, now = new Date()) {
  const cycle = s.billing_cycle === 'quarter' ? 'quarter' : 'month'
  const here = mIdx(now.getFullYear(), now.getMonth())
  if (cycle === 'month') {
    return { cycle, current: makePeriod('month', here, 1), next: makePeriod('month', here + 1, 1) }
  }
  const anchor = Math.min(12, Math.max(1, Math.round(num(s.quarter_start_month, 1)))) - 1
  const off = (((now.getMonth() - anchor) % 3) + 3) % 3
  const start = here - off
  return { cycle, current: makePeriod('quarter', start, 3), next: makePeriod('quarter', start + 3, 3) }
}

export function sessionsForPeriod(s, period) {
  const wds = Array.isArray(s.play_weekdays) ? s.play_weekdays : []
  if (!wds.length) {
    return { total: Math.round(num(s.sessions_per_week) * 4 * period.len), breakdown: {}, fallback: true }
  }
  let total = 0
  const breakdown = {}
  for (const { year, month0 } of period.months) {
    const c = countWeekdays(year, month0, wds)
    total += c.total
    for (const k in c.breakdown) breakdown[k] = (breakdown[k] || 0) + c.breakdown[k]
  }
  return { total, breakdown, fallback: false }
}

export function sessionsHappenedByNow(s, period, today = new Date()) {
  const wds = Array.isArray(s.play_weekdays) ? s.play_weekdays.map(Number) : []
  const { year: sy, month0: sm0 } = period.months[0]
  const lastM = period.months[period.months.length - 1]
  const periodEnd = new Date(lastM.year, lastM.month0 + 1, 0)
  const cutoff = today <= periodEnd ? today : periodEnd

  if (!wds.length) {
    const periodStart = new Date(sy, sm0, 1)
    const totalDays = (periodEnd - periodStart) / 86400000 + 1
    const elapsedDays = Math.max(0, Math.floor((cutoff - periodStart) / 86400000) + 1)
    const totalSess = Math.round(num(s.sessions_per_week) * 4 * period.len)
    return Math.min(totalSess, Math.floor((elapsedDays / totalDays) * totalSess))
  }

  const wdSet = new Set(wds)
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

export function computeCycle(s, period, memberCount, hasEquipment = true) {
  const sess = sessionsForPeriod(s, period)
  const totalSessions = sess.total
  const priceMap = s.court_prices_by_weekday || {}
  const defaultPrice = num(s.court_price_per_hour)
  const hours = num(s.hours_per_session)
  let courtCost = 0
  if (sess.fallback || !Object.keys(sess.breakdown).length) {
    courtCost = defaultPrice * hours * totalSessions
  } else {
    for (const [wd, count] of Object.entries(sess.breakdown)) {
      const price = priceMap[wd] !== undefined ? num(priceMap[wd]) : defaultPrice
      courtCost += price * hours * count
    }
  }
  const boxes = hasEquipment ? Math.ceil((totalSessions * num(s.estimated_shuttlecocks)) / BALLS_PER_BOX) : 0
  const shuttleCost = hasEquipment ? boxes * num(s.price_per_box) : 0
  const totalCost = courtCost + shuttleCost
  const fund = num(s.current_fund)
  const balance = fund - totalCost
  const deficit = balance < 0 ? -balance : 0
  const perMemberDeficit = memberCount > 0 ? Math.ceil(deficit / memberCount) : 0
  const suggestedFee = memberCount > 0 ? Math.ceil(totalCost / memberCount) : 0
  return {
    period, totalSessions, breakdown: sess.breakdown, fallback: sess.fallback,
    courtCost, boxes, shuttleCost, totalCost, fund, balance, deficit,
    perMemberDeficit, suggestedFee,
  }
}

export function formatPeriodLabel(period, lang) {
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US'
  if (period.kind === 'month') {
    const { year, month0 } = period.months[0]
    return new Date(year, month0, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }
  const a = period.months[0], b = period.months[period.len - 1]
  const fmt = (m) => new Date(m.year, m.month0, 1).toLocaleDateString(locale, { month: 'short' })
  return `${fmt(a)}–${fmt(b)} ${b.year}`
}

export function monthName(m1, lang) {
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US'
  return new Date(2000, m1 - 1, 1).toLocaleDateString(locale, { month: 'long' })
}

// Returns an array of per-weekday session configs.
// If session_configs is populated (new format), use that.
// Otherwise synthesise from legacy flat fields for backward compat.
export function calcGuestRevenue({ mode, guestMale, guestFemale, feeMale, feeFemale, shuttleCost, courtCost, memberCount }) {
  const gm = Math.round(guestMale) || 0
  const gf = Math.round(guestFemale) || 0
  if (!gm && !gf) return 0

  if (mode === 'fixed_by_gender')
    return gm * (feeMale || 0) + gf * (feeFemale || 0)

  if (mode === 'split_shuttle') {
    const femalePart = gf * (feeFemale || 0)
    const totalMales = Math.max(1, (memberCount || 1) + gm)
    const perMale = Math.round((shuttleCost || 0) / totalMales)
    return femalePart + gm * perMale
  }

  // split_all
  const totalPlayers = Math.max(1, (memberCount || 1) + gm + gf)
  const perHead = Math.round(((courtCost || 0) + (shuttleCost || 0)) / totalPlayers)
  return (gm + gf) * perHead
}

export function getSessionConfigs(settings) {
  const raw = settings.session_configs
  if (Array.isArray(raw) && raw.length > 0) return raw

  const weekdays = Array.isArray(settings.play_weekdays) ? settings.play_weekdays : []
  const priceMap = settings.court_prices_by_weekday || {}
  const base = {
    court_price_per_hour: num(settings.court_price_per_hour) || DEFAULT_SESSION_CONFIG.court_price_per_hour,
    hours_per_session: num(settings.hours_per_session) || DEFAULT_SESSION_CONFIG.hours_per_session,
    court_payment_mode: settings.court_payment_mode || DEFAULT_SESSION_CONFIG.court_payment_mode,
    billing_cycle: settings.billing_cycle || DEFAULT_SESSION_CONFIG.billing_cycle,
    quarter_start_month: num(settings.quarter_start_month) || DEFAULT_SESSION_CONFIG.quarter_start_month,
  }

  if (!weekdays.length) return [{ ...base, weekday: null }]

  return weekdays.map((wd) => ({
    ...base,
    weekday: wd,
    court_price_per_hour:
      priceMap[wd] !== undefined ? num(priceMap[wd]) : base.court_price_per_hour,
  }))
}

// Computes full forecast across all session configs, normalised to monthly.
// Returns per-venue results plus aggregated monthly totals.
export function computeAll(settings, memberCount, hasEquipment = true, now = new Date()) {
  const configs = getSessionConfigs(settings)

  const venues = configs.map((sc) => {
    const wds = sc.weekday !== null && sc.weekday !== undefined ? [sc.weekday] : []
    const scWithDays = { ...sc, play_weekdays: wds, sessions_per_week: 1 }
    const periods = resolvePeriods(sc, now)
    const sess = sessionsForPeriod(scWithDays, periods.current)
    const nextSess = sessionsForPeriod(scWithDays, periods.next)
    const price = num(sc.court_price_per_hour)
    const hours = num(sc.hours_per_session)
    const courtCost = price * hours * sess.total
    const nextCourtCost = price * hours * nextSess.total
    // Normalise to monthly so mixed cycles are comparable
    const divisor = sc.billing_cycle === 'quarter' ? 3 : 1
    const monthlyCourtCost = courtCost / divisor
    const nextMonthlyCourtCost = nextCourtCost / divisor
    const happened = sessionsHappenedByNow(scWithDays, periods.current, now)
    return {
      weekday: sc.weekday,
      billing_cycle: sc.billing_cycle,
      court_payment_mode: sc.court_payment_mode,
      period: periods.current,
      nextPeriod: periods.next,
      totalSessions: sess.total,
      nextSessions: nextSess.total,
      breakdown: sess.breakdown,
      courtCost,
      monthlyCourtCost,
      nextMonthlyCourtCost,
      happened,
    }
  })

  const totalMonthlyCourtCost = venues.reduce((s, v) => s + v.monthlyCourtCost, 0)
  // Monthly-equivalent session count drives shuttle calculation
  const totalMonthlySessions = venues.reduce((s, v) => {
    return s + v.totalSessions / (v.billing_cycle === 'quarter' ? 3 : 1)
  }, 0)

  const boxes = hasEquipment
    ? Math.ceil((totalMonthlySessions * num(settings.estimated_shuttlecocks)) / BALLS_PER_BOX)
    : 0
  const shuttleCost = hasEquipment ? boxes * num(settings.price_per_box) : 0
  const totalMonthlyCost = totalMonthlyCourtCost + shuttleCost

  const fund = num(settings.current_fund)
  const balance = fund - totalMonthlyCost
  const deficit = balance < 0 ? -balance : 0
  const suggestedFee = memberCount > 0 ? Math.ceil(totalMonthlyCost / memberCount) : 0
  const perMemberDeficit = memberCount > 0 && deficit > 0 ? Math.ceil(deficit / memberCount) : 0

  const nextMonthlyCourtCost = venues.reduce((s, v) => s + v.nextMonthlyCourtCost, 0)
  const nextMonthlySessions = venues.reduce((s, v) => {
    return s + v.nextSessions / (v.billing_cycle === 'quarter' ? 3 : 1)
  }, 0)
  const nextBoxes = hasEquipment
    ? Math.ceil((nextMonthlySessions * num(settings.estimated_shuttlecocks)) / BALLS_PER_BOX)
    : 0
  const nextShuttleCost = hasEquipment ? nextBoxes * num(settings.price_per_box) : 0
  const nextTotalCost = nextMonthlyCourtCost + nextShuttleCost
  const nextSuggestedFee = memberCount > 0 ? Math.ceil(nextTotalCost / memberCount) : 0

  const totalHappened = venues.reduce((s, v) => s + v.happened, 0)
  const totalScheduled = venues.reduce((s, v) => s + v.totalSessions, 0)

  return {
    venues,
    totalMonthlyCourtCost,
    totalMonthlySessions,
    shuttleCost,
    boxes,
    totalMonthlyCost,
    fund,
    balance,
    deficit,
    suggestedFee,
    perMemberDeficit,
    nextTotalCost,
    nextSuggestedFee,
    nextSessions: venues.reduce((s, v) => s + v.nextSessions, 0),
    totalHappened,
    totalScheduled,
  }
}
