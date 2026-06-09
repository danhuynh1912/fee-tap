import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/utils'

export function WeekdayPicker({ value, onChange, disabled }) {
  const { t } = useTranslation()
  const order = [1, 2, 3, 4, 5, 6, 0]
  const set = new Set(value || [])
  const toggle = (d) => {
    const n = new Set(set)
    n.has(d) ? n.delete(d) : n.add(d)
    onChange([...n].sort((a, b) => a - b))
  }
  return (
    <div className={cx('flex flex-wrap gap-2', disabled && 'pointer-events-none opacity-60')}>
      {order.map((d) => {
        const on = set.has(d)
        return (
          <button
            key={d} type="button" onClick={() => toggle(d)}
            className={cx(
              'h-11 min-w-[3.25rem] rounded-2xl border-2 px-3 text-sm font-bold transition active:scale-[0.97]',
              on ? 'border-slate-900 bg-slate-900 text-lime-400' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            )}
          >
            {t(`wd_${d}`)}
          </button>
        )
      })}
    </div>
  )
}
