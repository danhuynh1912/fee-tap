import { cx } from '../../lib/utils'

export function GraphGlyph({ className = '' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden>
      <path d="M10 90 L40 70 L60 80 L85 45 L110 25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="110" cy="25" r="4" fill="currentColor" />
      {[20, 50, 80].map((y) => (
        <line key={y} x1="10" y1={y} x2="110" y2={y} stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
      ))}
    </svg>
  )
}
