import { cx } from '../../lib/utils'

export function Modal({ open, onClose, children, maxW = 'max-w-md' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-md" onClick={onClose} />
      <div className={cx('relative w-full animate-scale-in rounded-3xl border border-slate-100 bg-white/95 p-7 shadow-2xl shadow-slate-900/10 backdrop-blur-xl', maxW)}>
        {children}
      </div>
    </div>
  )
}
