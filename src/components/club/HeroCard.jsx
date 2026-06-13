import { useTranslation } from 'react-i18next'
import { PieChart, Users, Activity, Info } from 'lucide-react'
import { cx, fmtVND } from '../../lib/utils'
import { formatPeriodLabel } from '../../engine/forecast'

export function HeroCard({
  all,
  totalActualSpent,
  totalCollected,
  txCount,
  remainingForecast,
  projectedBalance,
  projectedSurplus,
  sessionProgress,
  show,
  canEdit,
  onSpentTipOpen,
}) {
  const { t, i18n } = useTranslation()
  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-900 bg-grid-dark p-6 sm:p-8 text-white">
      <div
        className={cx(
          'pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full blur-3xl',
          projectedSurplus ? 'bg-lime-400/10' : 'bg-red-500/15'
        )}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-400">
          <PieChart className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">{t('dash_monthly_total')}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {all.venues.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300">
              <Activity className="h-3.5 w-3.5 text-lime-400" />
              {[...new Set(all.venues.map((v) => formatPeriodLabel(v.period, i18n.language)))].join(' · ')}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300">
            <Users className="h-3.5 w-3.5 text-lime-400" /> {all.memberCount ?? ''} {t('members')}
          </span>
        </div>
      </div>

      <div className="relative mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('dash_fund_live')}</p>
        <p
          className={cx(
            'mt-1 font-mono text-4xl sm:text-5xl font-black tabular-nums leading-none',
            all.fund - totalActualSpent >= 0 ? 'text-lime-400' : 'text-red-400'
          )}
        >
          {fmtVND(all.fund - totalActualSpent)}
        </p>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="sm:flex-1 rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_total_collected')}</p>
          <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-yellow-400">{fmtVND(totalCollected)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {txCount} {t('dash_collections')}
          </p>
        </div>
        <div className="sm:flex-1 rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_actual_spent')}</p>
            <button
              onClick={onSpentTipOpen}
              className="grid h-5 w-5 place-items-center rounded-lg text-slate-500 transition hover:text-lime-400 active:scale-95"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-white">{fmtVND(totalActualSpent)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {all.venues.some((v) => v.court_payment_mode === 'cycle') && <span>{t('dash_actual_includes_lump')} · </span>}
            {all.uniqueHappened} {t('dash_sessions_label')} ({all.totalHappened} {t('dash_slots_label')}) {t('dash_sessions_happened')}
          </p>
        </div>
        {show('remaining_forecast') && (
          <div className="sm:flex-1 rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_remaining_forecast')}</p>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-slate-300">~{fmtVND(remainingForecast)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {all.uniqueScheduled - all.uniqueHappened} {t('dash_sessions_future')}
            </p>
          </div>
        )}
        {show('end_of_period') && canEdit && (
          <div className={cx('sm:flex-1 rounded-2xl px-3 py-3 sm:px-4', projectedSurplus ? 'bg-lime-400/15' : 'bg-red-500/20')}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_end_of_period')}</p>
            <p className={cx('mt-1.5 font-mono text-sm sm:text-base font-black', projectedSurplus ? 'text-lime-400' : 'text-red-400')}>
              {projectedSurplus ? '+' : '−'}
              {fmtVND(Math.abs(projectedBalance))}
            </p>
            <span className={cx('mt-0.5 text-[10px] font-bold', projectedSurplus ? 'text-lime-400' : 'text-red-400')}>
              {projectedSurplus ? t('bal_surplus') : t('bal_deficit')}
            </span>
          </div>
        )}
      </div>

      {all.uniqueScheduled > 0 && (
        <div className="relative mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_session_progress')}</span>
            <span className="text-[10px] font-mono text-slate-400">
              {all.uniqueHappened} / {all.uniqueScheduled} {t('dash_sessions')}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${sessionProgress * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
