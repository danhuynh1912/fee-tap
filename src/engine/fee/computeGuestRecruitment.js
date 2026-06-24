import { num } from '../../lib/utils'
import { sessionsForPeriod } from '../forecast'
import { findMinCombinations } from './findMinCombinations'

/**
 * Computes minimum guest recruitment per session to cover the cost shortfall
 * when fee_split_mode = 'fixed_count' and committedCount < fixedCount.
 *
 * Committed members pay perMember (shuttle only, as shown in UI).
 * Guests must cover the remaining shuttle shortfall PLUS all court costs
 * for the period (guests pay court even when members pay court via cycle).
 *
 * Y = (shuttleCost + courtCostForPeriod) − perMember × committedCount
 * perSessionShortfall = Y / numSessions
 *
 * Returns null when guest recruitment is not applicable.
 */
export function computeGuestRecruitment({ feeCtx, perMember, shuttleCost, period, slots, settings }) {
  if (!feeCtx.isFixed) return null

  const { fixedCount, committedCount } = feeCtx
  if (!committedCount || committedCount >= fixedCount) return null
  if (!period || !shuttleCost || !slots?.length) return null

  // Court cost + total sessions for the shuttle period, computed per-slot
  // (independent of which collection deadline court falls under)
  let courtCostForPeriod = 0
  let numSessions = 0
  for (const slot of slots) {
    const wds = Array.isArray(slot.weekdays) ? slot.weekdays : []
    const sess = sessionsForPeriod(wds, period).total
    courtCostForPeriod += num(slot.price_per_hour) * num(slot.hours_per_session) * sess
    numSessions += sess
  }

  if (numSessions === 0) return null

  const courtPerSession = courtCostForPeriod / numSessions
  const shuttlePerSession = shuttleCost / numSessions

  // totalPerMember = what each person (member + guest) owes if cost split by fixedCount
  // committed members only paid perMember (shuttle share from their collection);
  // court is collected separately — so we compute the full per-person cost here
  const totalCost = shuttleCost + courtCostForPeriod
  const totalPerMember = Math.ceil(totalCost / fixedCount)
  const Y = totalCost - totalPerMember * committedCount
  if (Y <= 0) return null

  const perSessionShortfall = Y / numSessions

  const combinations = resolveCombinations({
    settings,
    perSessionShortfall,
    committedCount,
    courtPerSession,
    shuttlePerSession,
    perMember,
    numSessions,
  })

  return { perSessionShortfall, courtPerSession, shuttlePerSession, numSessions, combinations }
}

function resolveCombinations({ settings, perSessionShortfall, committedCount, courtPerSession, shuttlePerSession, perMember, numSessions }) {
  const { guest_fee_mode, guest_fee_male, guest_fee_female } = settings

  if (guest_fee_mode === 'split_all') {
    // Total cost split equally among all players (committed + guests).
    // Revenue from g guests = g × totalPerSession / (committedCount + g)
    // Find minimum g where that revenue >= perSessionShortfall.
    const totalPerSession = shuttlePerSession + courtPerSession
    if (totalPerSession <= 0) return []
    for (let g = 1; g <= 20; g++) {
      const revenue = (g * totalPerSession) / (committedCount + g)
      if (revenue >= perSessionShortfall) {
        return [{ males: null, females: null, total: g, genderless: true }]
      }
    }
    return []
  }

  if (guest_fee_mode === 'split_shuttle') {
    // Female: fixed fee per session
    // Male (worst case — all committed treated as male):
    //   courtPerSession + shuttlePerSession / (committedCount + g_male)
    return findMinCombinations({
      maleFee: (g_male) => courtPerSession + shuttlePerSession / (committedCount + g_male),
      femaleFee: num(guest_fee_female),
      shortfall: perSessionShortfall,
    })
  }

  // fixed_by_gender (default)
  return findMinCombinations({
    maleFee: num(guest_fee_male),
    femaleFee: num(guest_fee_female),
    shortfall: perSessionShortfall,
  })
}
