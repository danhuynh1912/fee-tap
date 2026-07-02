export const cx = (...c) => c.filter(Boolean).join(' ')

export const fmtVND = (n) => new Intl.NumberFormat('en-US').format(Math.round(Number(n) || 0)) + ' ₫'

export const fmtNum = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0)

export function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export const num = (v, fallback = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

// SSOT for shuttle stock notes (dashboard widget + shop screen): switches to box unit
// once the count crosses a full box, falls back to loose shuttles below that.
export function shuttleStockSummary(totalBalls, t, ballsPerBox) {
  const boxes = Math.floor(totalBalls / ballsPerBox)
  const balls = totalBalls % ballsPerBox
  if (boxes > 0 && balls > 0) return t('shop_stock_summary_mixed', { boxes, balls })
  if (boxes > 0) return t('shop_stock_summary_full', { boxes })
  return t('shop_stock_summary_balls', { balls: totalBalls })
}

// SSOT for "tổng đã thu": sums only positive fund_transactions (deductions must never offset it).
// Optional { start, end } (ISO date strings) restricts to a period; end is inclusive of the whole day.
export function sumCollected(fundTxns, { start, end } = {}) {
  return (fundTxns || []).reduce((s, tx) => {
    const amt = num(tx.amount)
    if (amt <= 0) return s
    if (start && tx.created_at < start) return s
    if (end && tx.created_at > end + 'T23:59:59') return s
    return s + amt
  }, 0)
}

// For number inputs: format with thousand separators, strip leading zeros
// Usage:
//   value={fmtInputNum(raw)}
//   onChange={(e) => setRaw(parseInputNum(e.target.value))}
export function fmtInputNum(value) {
  const n = String(value ?? '').replace(/[^\d]/g, '')
  if (!n) return ''
  return Number(n).toLocaleString('en-US')
}

// Returns a plain integer string (no commas) — store this in state
export function parseInputNum(formatted) {
  return formatted.replace(/[^\d]/g, '').replace(/^0+(\d)/, '$1')
}
