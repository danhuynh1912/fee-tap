import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Package } from 'lucide-react'
import { fmtDate, cx } from '../../lib/utils'

export function DeliveryHistory({ deliveries, onConfirm }) {
  const { t } = useTranslation()
  const [confirmingId, setConfirmingId] = useState(null)

  if (!deliveries?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-300">
          <Package className="h-5 w-5" />
        </span>
        <p className="text-sm text-slate-400">{t('shop_no_deliveries')}</p>
      </div>
    )
  }

  async function confirm(id) {
    if (confirmingId) return
    setConfirmingId(id)
    try { await onConfirm(id) }
    finally { setConfirmingId(null) }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {deliveries.map((d, i) => (
        <div
          key={d.id}
          className={cx(
            'flex items-center gap-3 px-4 py-3.5',
            i > 0 && 'border-t border-slate-100'
          )}
        >
          {/* Date + boxes */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-base font-bold tabular-nums text-slate-900">
                {d.boxes}
              </span>
              <span className="text-xs text-slate-400">{t('shuttle_box_unit')}</span>
              {d.note && (
                <span className="truncate text-xs text-slate-400">· {d.note}</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{fmtDate(d.delivered_at)}</p>
          </div>

          {/* Status */}
          {d.confirmed_by_club ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-lime-50 px-2.5 py-1 text-xs font-semibold text-lime-700">
              <Check className="h-3 w-3" /> {t('shop_delivery_confirmed')}
            </span>
          ) : onConfirm ? (
            <button
              onClick={() => confirm(d.id)}
              disabled={!!confirmingId}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95',
                confirmingId && 'opacity-50'
              )}
            >
              {confirmingId === d.id
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Check className="h-3 w-3" />}
              {t('shop_delivery_confirm')}
            </button>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
              {t('shop_delivery_pending')}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
