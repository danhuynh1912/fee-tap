import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cx } from '../../lib/utils'

export function Modal({ open, onClose, children, maxW = 'max-w-md' }) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop — only visible on desktop */}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-md sm:block" onClick={onClose} />
      <div
        className={cx(
          'relative w-full animate-scale-in bg-white/95 backdrop-blur-xl overflow-y-auto',
          // Mobile: full screen, no radius, no shadow
          'h-full sm:h-auto',
          'rounded-none sm:rounded-3xl',
          'border-0 sm:border sm:border-slate-100',
          'shadow-none sm:shadow-2xl sm:shadow-slate-900/10',
          'p-5 sm:p-7',
          'sm:max-h-[90vh]',
          maxW
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}
