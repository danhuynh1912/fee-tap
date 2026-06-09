import { cx } from '../../lib/utils'

export function Segmented({ value, onChange, options, disabled }) {
  return (
    <div className={cx('inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1', disabled && 'opacity-50 pointer-events-none')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-xl px-4 py-2 text-sm font-semibold transition',
            value === o.value ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
