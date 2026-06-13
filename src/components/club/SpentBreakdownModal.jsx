import { useTranslation } from 'react-i18next'
import { Receipt, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { fmtVND } from '../../lib/utils'

export function SpentBreakdownModal({ open, onClose, spentBreakdown, totalActualSpent }) {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900">
            <Receipt className="h-4 w-4 text-lime-400" />
          </span>
          <div>
            <p className="font-black text-slate-900 text-base leading-tight">{t('dash_actual_spent')}</p>
            <p className="text-xs text-slate-400">{t('dash_breakdown')}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {spentBreakdown.map((b, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="font-bold text-slate-800 mb-3 text-sm">{b.label}</p>
            <div className="space-y-2">
              {b.isCycle ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t('dash_court_lump')}</span>
                    <span className="font-mono font-semibold text-slate-900">{fmtVND(b.courtCost)}</span>
                  </div>
                  {b.loggedCount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('dash_shuttle_logged', { n: b.loggedCount })}</span>
                      <span className="font-mono font-semibold text-slate-900">{fmtVND(b.shuttleActual)}</span>
                    </div>
                  )}
                  {b.estimatedCount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('dash_shuttle_est', { n: b.estimatedCount })}</span>
                      <span className="font-mono font-semibold text-slate-500">{fmtVND(b.shuttleEst)}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {b.loggedCount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('dash_session_logged', { n: b.loggedCount })}</span>
                      <span className="font-mono font-semibold text-slate-900">{fmtVND(b.costActual)}</span>
                    </div>
                  )}
                  {b.estimatedCount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('dash_session_est', { n: b.estimatedCount })}</span>
                      <span className="font-mono font-semibold text-slate-500">{fmtVND(b.costEst)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-slate-200">
              <span className="text-sm font-semibold text-slate-700">{t('subtotal')}</span>
              <span className="font-mono font-bold text-slate-900">{fmtVND(b.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-5 pt-4 border-t-2 border-slate-100">
        <span className="font-black text-slate-900">{t('total')}</span>
        <span className="font-mono text-xl font-black text-slate-900">{fmtVND(totalActualSpent)}</span>
      </div>
    </Modal>
  )
}
