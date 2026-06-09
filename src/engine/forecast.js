import { num } from '../lib/utils'
import { BALLS_PER_BOX } from '../constants'

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
  const courtCost = num(s.court_price_per_hour) * num(s.hours_per_session) * totalSessions
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
