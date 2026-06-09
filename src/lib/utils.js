export const cx = (...c) => c.filter(Boolean).join(' ')

export const fmtVND = (n) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + ' ₫'

export const fmtNum = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0)

export function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

export const num = (v, fallback = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}
