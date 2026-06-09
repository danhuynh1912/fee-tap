import { cx } from '../../lib/utils'

export function Button({ as = 'button', variant = 'primary', size = 'md', className = '', children, ...p }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.98]'
  const sizes = {
    sm: 'text-sm px-4 py-2',
    md: 'text-[15px] px-5 py-3',
    lg: 'text-base px-7 py-4',
  }
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10',
    volt: 'bg-lime-400 text-slate-900 hover:bg-lime-300 shadow-lg shadow-lime-400/30',
    ghost: 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50',
    subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
    darkSubtle: 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700',
  }
  const Comp = as
  return (
    <Comp className={cx(base, sizes[size], variants[variant], className)} {...p}>
      {children}
    </Comp>
  )
}
