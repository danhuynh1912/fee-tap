import { cx } from '../../lib/utils'

export function Badge({ tone = 'slate', icon: Icon, children, className = '' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    volt: 'bg-lime-400 text-slate-900',
    cyan: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
    red: 'bg-red-50 text-red-600 ring-1 ring-red-200',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    dark: 'bg-slate-900 text-lime-300',
  }
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', tones[tone], className)}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  )
}
