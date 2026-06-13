import { useTranslation } from 'react-i18next'
import { cx } from '../../../lib/utils'

export function SlotsHero({ filledSlots, maxSlots }) {
  const { t } = useTranslation()
  const remaining = maxSlots - filledSlots
  const full = remaining === 0
  const pct = maxSlots > 0 ? filledSlots / maxSlots : 0
  const isCritical = !full && remaining <= Math.max(1, Math.ceil(maxSlots * 0.2))
  const isWarning = !full && !isCritical && pct >= 0.5

  const accent = full
    ? { text: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', label: t('vote_filled'), sub: t('vote_slots_full_sub') }
    : isCritical
      ? {
          text: 'text-red-500',
          bg: 'bg-red-50',
          border: 'border-red-100',
          label: remaining,
          sub: t(remaining > 1 ? 'vote_slots_critical_plural' : 'vote_slots_critical', { n: remaining }),
        }
      : isWarning
        ? {
            text: 'text-amber-500',
            bg: 'bg-amber-50',
            border: 'border-amber-100',
            label: remaining,
            sub: t(remaining > 1 ? 'vote_slots_warning_plural' : 'vote_slots_warning', { n: remaining }),
          }
        : {
            text: 'text-lime-500',
            bg: 'bg-lime-50',
            border: 'border-lime-100',
            label: remaining,
            sub: t(remaining > 1 ? 'vote_slots_open_plural' : 'vote_slots_open', { n: remaining }),
          }

  return (
    <div className={cx('relative overflow-hidden rounded-2xl border p-5', accent.bg, accent.border)}>
      {!full && (
        <div
          className={cx(
            'pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl opacity-40',
            isCritical ? 'bg-red-300' : isWarning ? 'bg-amber-300' : 'bg-lime-300'
          )}
        />
      )}
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <p
            className={cx(
              'font-black tabular-nums leading-none tracking-tighter transition-all duration-500',
              full ? 'text-4xl' : 'text-6xl',
              accent.text,
              isCritical && 'animate-pulse'
            )}
          >
            {accent.label}
          </p>
          <p className={cx('mt-1.5 text-sm font-semibold opacity-70', accent.text)}>{accent.sub}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-black tabular-nums text-3xl text-slate-900">
            {filledSlots}
            <span className="text-lg font-medium text-slate-400">/{maxSlots}</span>
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('vote_slots_filled_label')}</p>
        </div>
      </div>
      <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className={cx(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-700',
            full ? 'bg-slate-400' : isCritical ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-lime-400'
          )}
          style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
        />
      </div>
    </div>
  )
}
