import { useTranslation } from 'react-i18next'

export function SessionBreakdown({ breakdown }) {
  const { t } = useTranslation()
  const order = [1, 2, 3, 4, 5, 6, 0]
  const items = order.filter((d) => breakdown[d])
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((d) => (
        <span key={d} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          <span className="font-mono font-bold text-slate-900">{breakdown[d]}</span> × {t(`wd_${d}`)}
        </span>
      ))}
    </div>
  )
}
