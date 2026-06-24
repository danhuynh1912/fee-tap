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

  const Y = shuttleCost + courtCostForPeriod - perMember * committedCount
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
    // Each guest pays same shuttle share as a member slot + court per session
    const guestFee = perMember / numSessions + courtPerSession
    if (guestFee <= 0) return []
    const total = Math.ceil(perSessionShortfall / guestFee)
    return [{ males: null, females: null, total, genderless: true }]
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
