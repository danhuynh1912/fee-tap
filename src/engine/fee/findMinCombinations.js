/**
 * Find the minimum number of guests (by gender combination) to cover
 * a per-session shortfall.
 *
 * maleFee   — fixed number OR (g_male: number) => number for variable fees
 *             (e.g. split_shuttle where male fee depends on group size)
 * femaleFee — fixed number per female guest per session
 * shortfall — amount to cover per session
 *
 * Returns all (m, n) combinations at the minimum total guest count.
 * Empty array = impossible within maxGuests.
 */
export function findMinCombinations({ maleFee, femaleFee, shortfall, maxGuests = 12 }) {
  if (shortfall <= 0) return [{ males: 0, females: 0, total: 0 }]
  const getFee = typeof maleFee === 'function' ? maleFee : (_m) => maleFee

  for (let total = 1; total <= maxGuests; total++) {
    const valid = []
    for (let m = 0; m <= total; m++) {
      const f = total - m
      if (m * getFee(m) + f * femaleFee >= shortfall) {
        valid.push({ males: m, females: f, total })
      }
    }
    if (valid.length > 0) return valid
  }
  return []
}
