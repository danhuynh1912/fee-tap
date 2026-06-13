import { useTranslation } from 'react-i18next'
import { fmtVND } from '../../lib/utils'
import { formatPeriodLabel, resolveShuttlePeriodLabel } from '../../engine/forecast'

export function BaseFeeCard({ all, baseFee, sport, settings }) {
  const { t, i18n } = useTranslation()
  const courtLabel = all.venues[0]?.period ? formatPeriodLabel(all.venues[0].period, i18n.language) : null
  const shuttleLabel = sport?.hasEquipment && all.shuttleCost > 0 ? resolveShuttlePeriodLabel(settings, i18n.language) : null
  const sessionsText = (
    <>
      {all.uniqueScheduled} {t('dash_sessions_label')}
      {all.uniqueScheduled !== all.totalScheduled && (
        <>
          {' '}
          ({all.totalScheduled} {t('dash_slots_label')})
        </>
      )}
    </>
  )

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('dash_cycle_total_est')}</p>
        <p className="font-mono text-3xl font-black text-slate-900">{fmtVND(all.totalPeriodCost ?? all.totalMonthlyCost)}</p>
        {!shuttleLabel || courtLabel === shuttleLabel ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            {courtLabel && <span className="font-semibold text-slate-700">{courtLabel}</span>}
            {courtLabel && <span className="text-slate-300">·</span>}
            <span>{sessionsText}</span>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-400 w-20 shrink-0">{t('dash_label_court_cycle')}</span>
              <span className="font-semibold text-slate-700">{courtLabel}</span>
              <span className="text-slate-300">·</span>
              <span>{sessionsText}</span>
            </div>
            <div className="flex items-center gap-x-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-400 w-20 shrink-0">{t('dash_label_shuttle_cycle')}</span>
              <span className="font-semibold text-slate-700">{shuttleLabel}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 pt-3 border-t border-slate-100">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('dash_base_fee')}</p>
          <p className="font-mono text-2xl font-black text-lime-600">{fmtVND(baseFee)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">/ {t('member')}</p>
        </div>
        {all.venues[0]?.currentDeadline && (
          <p className="text-[11px] font-semibold text-amber-600 text-right shrink-0">
            {t('timeline_deadline')}
            <br />
            {all.venues[0].currentDeadline.toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
          </p>
        )}
      </div>
    </div>
  )
}
