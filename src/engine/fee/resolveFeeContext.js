/**
 * Resolves effective member count + commit status for a payment group.
 *
 * Single source of truth — replaces three previously scattered computations:
 *   • resolveFeeMemberCount()           in forecast.js
 *   • `effective` inline                in useSettingsForm.js
 *   • effectiveCountFor/matchesVotePeriod in PaymentTimeline.jsx
 *
 * Behavior by context:
 *   — periodStart + pollTally provided  → strict: validates vote covers this period
 *   — periodStart omitted               → preview: committed_only uses committedCount directly
 */
export function resolveFeeContext({ settings, memberCount, committedCount, pollTally = null, periodStart = null }) {
  if (settings.fee_split_mode === 'fixed_count' && (settings.fee_split_fixed_count ?? 0) > 0) {
    return {
      effectiveCount: settings.fee_split_fixed_count,
      hasCommitted: false,
      isFixed: true,
      fixedCount: settings.fee_split_fixed_count,
      committedCount: committedCount ?? 0,
    }
  }

  if (settings.fee_split_mode === 'committed_only' && committedCount != null && committedCount > 0) {
    const matchesPeriod = periodStart && pollTally?.cyclePeriodStart
      ? (() => {
          const d = new Date(periodStart)
          const start = new Date(pollTally.cyclePeriodStart)
          const end = pollTally.cyclePeriodEnd ? new Date(pollTally.cyclePeriodEnd) : start
          return d >= start && d <= end
        })()
      : !periodStart // no period context = settings preview → always apply

    if (matchesPeriod) {
      return {
        effectiveCount: committedCount,
        hasCommitted: true,
        isFixed: false,
        fixedCount: null,
        committedCount,
      }
    }
  }

  return {
    effectiveCount: memberCount,
    hasCommitted: false,
    isFixed: false,
    fixedCount: null,
    committedCount: committedCount ?? 0,
  }
}
