export function MockQR({ size = 168 }) {
  const cells = 21
  const seed = 7
  const isDark = (r, c) => {
    const inFinder = (R, C) =>
      (R < 7 && C < 7) || (R < 7 && C >= cells - 7) || (R >= cells - 7 && C < 7)
    if (inFinder(r, c)) {
      const inRing =
        (r === 0 || r === 6 || c === 0 || c === 6 ||
         r === cells - 7 || r === cells - 1 ||
         c === cells - 7 || c === cells - 1) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
        (r >= 2 && r <= 4 && c >= cells - 5 && c <= cells - 3) ||
        (r >= cells - 5 && r <= cells - 3 && c >= 2 && c <= 4)
      return inRing
    }
    return ((r * 31 + c * 17 + seed * (r ^ c)) % 5) < 2
  }
  const px = size / cells
  const rects = []
  for (let r = 0; r < cells; r++)
    for (let c = 0; c < cells; c++)
      if (isDark(r, c))
        rects.push(<rect key={`${r}-${c}`} x={c * px} y={r * px} width={px} height={px} rx={px * 0.18} fill="#0f172a" />)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-xl">
      <rect width={size} height={size} fill="#ffffff" />
      {rects}
    </svg>
  )
}
