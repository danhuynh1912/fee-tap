/**
 * buildPollTally — compute member-aware poll tally from raw DB rows.
 *
 * Uses the same member lookup as CycleVoteInline avatar rendering:
 *   responseMap[member.user_id] ?? responseMap[member.id]
 * This correctly handles both authenticated members (user_id match) and
 * manually-added members (id match via anonymous_user_id).
 *
 * Responses must be pre-sorted ascending by created_at so the latest
 * response per user wins in fromEntries.
 */
export function buildPollTally(vote, responses, members) {
  const responseMap = Object.fromEntries(
    (responses || []).map((r) => [r.anonymous_user_id, r])
  )
  const committedUserIds = new Set(
    Object.values(responseMap).filter((r) => r.attending).map((r) => r.anonymous_user_id)
  )
  const count = (members || []).filter((member) => {
    const r = responseMap[member.user_id] ?? responseMap[member.id] ?? null
    return r?.attending === true
  }).length
  return {
    count,
    source: 'poll',
    committedUserIds,
    voteId: vote.id,
    cyclePeriodStart: vote.cycle_period_start,
    cyclePeriodEnd: vote.cycle_period_end,
  }
}
