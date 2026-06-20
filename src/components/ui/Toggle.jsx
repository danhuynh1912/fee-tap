import { cx } from '../../lib/utils'

// Switch — inline pill toggle (label + switch on one row)
export function Switch({ checked, onChange, label, hint, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={cx(
        'flex w-full items-center justify-between gap-3 text-left',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {hint && <span className="text-xs text-slate-400 mt-0.5">{hint}</span>}
      </span>
      <span
        className={cx(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-lime-400' : 'bg-slate-300'
        )}
      >
        <span
          className={cx(
            'inline-block h-5 w-5 self-center rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  )
}

// Toggle — full-width card-style toggle (kept for backward compat)
export function Toggle({ checked, onChange, label, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cx(
        'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition',
        checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </span>
      <span className={cx('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-lime-400' : 'bg-slate-300')}>
        <span className={cx('inline-block h-5 w-5 self-center rounded-full bg-white shadow-sm transition-transform duration-200', checked ? 'translate-x-5' : 'translate-x-0.5')} />
      </span>
    </button>
  )
}
