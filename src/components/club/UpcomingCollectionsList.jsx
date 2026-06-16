import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fmtVND, fmtDate } from '../../lib/utils'
import { formatPeriodLabel } from '../../engine/forecast'

function Row({ label, cost, effective }) {
  const { t } = useTranslation()
  const perMember = effective > 0 ? Math.ceil(cost / effective) : 0
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">
        <span className="font-mono font-semibold text-slate-900">{fmtVND(cost)}</span>
        {effective > 0 && (
          <span className="ml-1.5 font-mono text-[11px] text-slate-400">
            · {fmtVND(perMember)}/{t('members')}
          </span>
        )}
      </span>
    </div>
  )
}

export function UpcomingCollectionsList({ items, effective }) {
  const { t, i18n } = useTranslation()

  if (!items.length) {
    return <p className="text-sm text-slate-400 text-center py-4">{t('slot_empty')}</p>
  }

  return (
    <div className="space-y-2">
      {items.map((g, i) => {
        const periodSource = g.court[0]?.period || g.shuttle?.period
        const periodLabel = periodSource ? formatPeriodLabel(periodSource, i18n.language) : ''
        return (
          <div key={i} className="rounded-xl border border-slate-100 px-3.5 py-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> {fmtDate(g.deadline)}
              </span>
              <span>{periodLabel}</span>
            </div>
            <div className="mt-2 space-y-1">
              {g.court.map((c, j) => (
                <Row key={j} label={t('timeline_court_cost')} cost={c.cost} effective={effective} />
              ))}
              {g.shuttle && <Row label={t('set_cost_shuttle')} cost={g.shuttle.cost} effective={effective} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}
