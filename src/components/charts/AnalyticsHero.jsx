import { TrendingUp } from 'lucide-react'
import { cx } from '../../lib/utils'

export function AnalyticsHero({ className = '' }) {
  const line = 'M0 180 L60 150 L120 162 L180 120 L240 132 L300 78 L360 92 L420 40 L460 30'
  const area = line + ' L460 220 L0 220 Z'
  return (
    <div className={cx('relative overflow-hidden rounded-3xl bg-slate-900 bg-grid-dark', className)}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-10 left-1/3 h-56 w-72 rounded-full bg-lime-400/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Projected fund balance</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">+ 4,820,000 ₫</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-400">
            <TrendingUp className="h-3.5 w-3.5" /> +18.4%
          </span>
        </div>

        <svg viewBox="0 0 460 220" className="mt-5 w-full" fill="none" aria-hidden>
          <defs>
            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ccff00" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ccff00" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 90, 140, 190].map((y) => (
            <line key={y} x1="0" y1={y} x2="460" y2={y} stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
          ))}
          <path d={area} fill="url(#fillGrad)" />
          <path
            d={line}
            stroke="#ccff00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="1000" className="animate-draw-line"
          />
          <circle cx="460" cy="30" r="5" fill="#ccff00" />
          <circle cx="460" cy="30" r="10" fill="#ccff00" fillOpacity="0.2" />
        </svg>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Court', val: '62%', w: '62%' },
            { label: 'Shuttle', val: '28%', w: '28%' },
            { label: 'Buffer', val: '10%', w: '10%' },
          ].map((b, i) => (
            <div key={b.label} className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3">
              <p className="text-[11px] font-medium text-slate-400">{b.label}</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-white">{b.val}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full origin-left rounded-full bg-lime-400 animate-rise"
                  style={{ width: b.w, animationDelay: `${i * 150 + 400}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
