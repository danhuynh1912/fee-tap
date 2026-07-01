/**
 * Resolves effective member count + commit status for a payment group.
 *
 * Single source of truth — replaces three previously scattered computations:
 *   • resolveFeeMemberCount()             in forecast.js
 *   • `effective` inline                  in useSettingsForm.js
 *   • effectiveCountFor/matchesVotePeriod in PaymentTimeline.jsx
 *
 * Behavior by context:
 *   — periodStart + pollTally provided  → strict: validates vote covers this period
 *   — periodStart omitted               → preview: committed_only uses committedCount directly
 *
 * Return shape:
 *   effectiveCount   — divisor used when splitting costs across members
 *   totalMembers     — denominator for "X/Y paid" display; may differ from effectiveCount
 *                      (e.g. fixed_count: cost splits across fixedCount slots but display
 *                      shows only how many actually committed)
 *   hasCommitted     — true when committed_only mode and vote applies to this period
 *   isFixed          — true when fixed_count mode
 *   fixedCount       — the fixed number (only when isFixed)
 *   committedCount   — raw committed vote count (0 when null)
 *   votePeriodMatch  — true when the active vote covers this period (regardless of split mode)
 *                      used by total_members mode to show open-slot warnings
 */
export function resolveFeeContext({ settings, memberCount, committedCount, pollTally = null, periodStart = null }) {
  // Compute period-vote match once; used by both committed_only billing and open-spot display
  const votePeriodMatch = !!(
    periodStart &&
    pollTally?.cyclePeriodStart &&
    committedCount != null &&
    committedCount > 0 &&
    (() => {
      const d = new Date(periodStart)
      const start = new Date(pollTally.cyclePeriodStart)
      const end = pollTally.cyclePeriodEnd ? new Date(pollTally.cyclePeriodEnd) : start
      return d >= start && d <= end
    })()
  )

  if (settings.fee_split_mode === 'fixed_count' && (settings.fee_split_fixed_count ?? 0) > 0) {
    const resolved = committedCount ?? 0
    return {
      effectiveCount: settings.fee_split_fixed_count,
      // Display denominator: how many actually committed (not the slot cap)
      totalMembers: resolved > 0 ? resolved : settings.fee_split_fixed_count,
      hasCommitted: false,
      isFixed: true,
      fixedCount: settings.fee_split_fixed_count,
      committedCount: resolved,
      votePeriodMatch,
    }
  }

  if (settings.fee_split_mode === 'committed_only' && committedCount != null && committedCount > 0) {
    // No period context = settings preview → always treat vote as applicable
    const applies = periodStart ? votePeriodMatch : true

    if (applies) {
      return {
        effectiveCount: committedCount,
        totalMembers: committedCount,
        hasCommitted: true,
        isFixed: false,
        fixedCount: null,
        committedCount,
        votePeriodMatch,
      }
    }
  }

  return {
    effectiveCount: memberCount,
    totalMembers: memberCount,
    hasCommitted: false,
    isFixed: false,
    fixedCount: null,
    committedCount: committedCount ?? 0,
    votePeriodMatch,
  }
}
