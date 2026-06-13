import { useTranslation } from 'react-i18next'
import { Wallet } from 'lucide-react'
import { num, fmtVND } from '../../lib/utils'
import { cycleLabelShort, periodDateRange } from '../../engine/forecast'
import { BALLS_PER_BOX } from '../../constants'

export function CostByCycleBreakdown({ all, logs, settings, hasEquipment }) {
  const { t, i18n } = useTranslation()
  const shuttlePerSession = hasEquipment ? (num(settings.estimated_shuttlecocks) * num(settings.price_per_box)) / BALLS_PER_BOX : 0

  const venueRows = all.venues.map((v) => {
    const { start, end } = periodDateRange(v.period)
    const wd = v.weekday !== null && v.weekday !== undefined ? Number(v.weekday) : null
    const venueLogs =
      wd !== null ? (logs || []).filter((l) => l.played_on >= start && l.played_on <= end && new Date(l.played_on + 'T12:00:00').getDay() === wd) : []
    const happenedCount = v.happened
    const futureCount = Math.max(0, v.totalSessions - happenedCount)
    const shuttleHappened = hasEquipment
      ? venueLogs.reduce((s, l) => s + num(l.shuttle_cost), 0) + Math.max(0, happenedCount - venueLogs.length) * shuttlePerSession
      : 0
    const shuttleFuture = hasEquipment ? futureCount * shuttlePerSession : 0
    const shuttleCost = shuttleHappened + shuttleFuture
    const shuttleBoxes = hasEquipment ? Math.ceil((v.totalSessions * num(settings.estimated_shuttlecocks)) / BALLS_PER_BOX) : 0
    return { ...v, shuttleCost, shuttleBoxes, shuttleHappened, shuttleFuture, happenedCount, futureCount, total: v.courtCost + shuttleCost }
  })
  const grandTotal = venueRows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-400">
        <Wallet className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{t('dash_cost_by_cycle')}</span>
      </div>
      <p className="mt-1 mb-4 text-xs text-slate-400 italic">{t('dash_cost_by_cycle_note')}</p>
      <div className="space-y-4">
        {venueRows.map((v, i) => {
          const dayLabel = v.weekday !== null && v.weekday !== undefined ? t(`wd_${v.weekday}`) : null
          const cycleLabel = cycleLabelShort(v.cycle_months || 1, i18n.language)
          return (
            <div key={v.weekday ?? i}>
              <div className="flex items-center gap-2 mb-2">
                {dayLabel && <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{dayLabel}</span>}
                <span className="text-xs text-slate-400">{cycleLabel}</span>
              </div>
              <div className="space-y-1.5 pl-2 border-l-2 border-slate-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{t('dash_court_cost')}</span>
                  <span className="font-mono font-semibold text-slate-900">{fmtVND(v.courtCost)}</span>
                </div>
                {hasEquipment && v.happenedCount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{t('dash_shuttle_actual_line', { n: v.happenedCount })}</span>
                    <span className="font-mono font-semibold text-slate-900">{fmtVND(v.shuttleHappened)}</span>
                  </div>
                )}
                {hasEquipment && v.futureCount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 italic">{t('dash_shuttle_est_line', { n: v.futureCount })}</span>
                    <span className="font-mono font-semibold text-slate-400 italic">{fmtVND(v.shuttleFuture)}</span>
                  </div>
                )}
                {hasEquipment && v.happenedCount === 0 && v.futureCount === 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{t('dash_shuttle_cost')}</span>
                    <span className="font-mono font-semibold text-slate-900">{fmtVND(0)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-100">
                  <span className="font-semibold text-slate-700">{t('subtotal')}</span>
                  <span className="font-mono font-bold text-slate-900">{fmtVND(v.total)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between border-t-2 border-slate-100 pt-3 mt-4">
        <span className="font-bold text-slate-900">{t('dash_total_cycle')}</span>
        <span className="font-mono text-lg font-black text-slate-900">{fmtVND(grandTotal)}</span>
      </div>
    </div>
  )
}
