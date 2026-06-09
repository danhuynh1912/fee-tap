import { cx } from '../../lib/utils'

export function Card({ className = '', children }) {
  return (
    <div className={cx('rounded-3xl border border-slate-100 bg-white/80 p-6 sm:p-7 shadow-xl shadow-slate-900/[0.03] backdrop-blur-xl', className)}>
      {children}
    </div>
  )
}
