import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Package, Check, Loader2 } from 'lucide-react'
import { fmtDate, cx } from '../../lib/utils'
import { Badge } from '../ui/Badge'

// Shared delivery list used by both the shop view (read-only status) and the
// club view (with a confirm action). Pass `onConfirm(id)` to enable confirming.
export function DeliveryHistory({ deliveries, onConfirm }) {
  const { t } = useTranslation()
  const [confirmingId, setConfirmingId] = useState(null)

  if (!deliveries?.length) {
    return <p className="text-sm text-slate-400">{t('shop_no_deliveries')}</p>
  }

  async function confirm(id) {
    if (confirmingId) return
    setConfirmingId(id)
    try {
      await onConfirm(id)
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <ul className="space-y-2">
      {deliveries.map((d) => (
        <li
          key={d.id}
          className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <Package className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">
              {d.boxes} {t('shuttle_box_unit')}
              {d.note && <span className="font-normal text-slate-500"> · {d.note}</span>}
            </p>
            <p className="text-xs text-slate-400">{fmtDate(d.delivered_at)}</p>
          </div>
          {d.confirmed_by_club ? (
            <Badge tone="volt">{t('shop_delivery_confirmed')}</Badge>
          ) : onConfirm ? (
            <button
              onClick={() => confirm(d.id)}
              disabled={!!confirmingId}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95',
                confirmingId && 'opacity-50'
              )}
            >
              {confirmingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {t('shop_delivery_confirm')}
            </button>
          ) : (
            <Badge tone="amber">{t('shop_delivery_pending')}</Badge>
          )}
        </li>
      ))}
    </ul>
  )
}
