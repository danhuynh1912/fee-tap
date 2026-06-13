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
