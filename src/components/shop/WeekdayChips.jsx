import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/utils'

// Renders a club's fixed play weekdays as compact chips. Weekdays come from the
// court_slots schedule (engine SSOT), passed in already-deduped + sorted.
export function WeekdayChips({ weekdays, className }) {
  const { t } = useTranslation()
  if (!weekdays?.length) return <span className="text-xs text-slate-400">{t('shop_no_schedule')}</span>
  return (
    <div className={cx('flex flex-wrap gap-1', className)}>
      {weekdays.map((wd) => (
        <span
          key={wd}
          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
        >
          {t(`wd_${wd}`)}
        </span>
      ))}
    </div>
  )
}
