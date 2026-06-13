import { UserPlus } from 'lucide-react'
import { cx } from '../../lib/utils'

export function Toggle({ checked, onChange, label }) {
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
        <UserPlus className="h-4 w-4" />
        {label}
      </span>
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-lime-400' : 'bg-slate-200')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  )
}
