import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Package, Loader2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, inputCls } from '../ui/Field'
import { cx, num } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { handleError } from '../../lib/handleError'

// Shop records a shuttle delivery to a linked club. Inserts into the
// shuttle_deliveries staging table (confirmed_by_club defaults false). The club
// host later confirms, which posts to the shuttle_transactions ledger (SSOT).
export function DeliveryModal({ open, shopId, club, onClose, onDone, toast }) {
  const { t } = useTranslation()
  const [boxes, setBoxes] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const qty = num(boxes)
    if (qty <= 0 || busy) return
    setBusy(true)
    try {
      const { error } = await supabase.from('shuttle_deliveries').insert({
        shop_id: shopId,
        club_id: club.id,
        boxes: qty,
        note: note.trim() || null,
      })
      if (error) throw error
      toast(t('shop_delivery_recorded'))
      setBoxes('')
      setNote('')
      onClose()
      onDone?.()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-lime-400">
          <Package className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-900">{t('shop_delivery_title')}</h2>
          <p className="text-sm text-slate-500">{club?.name}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Field label={t('shop_delivery_boxes')} icon={Package}>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className={cx(inputCls, 'font-mono')}
            value={boxes}
            onChange={(e) => setBoxes(e.target.value)}
            placeholder={t('shop_delivery_boxes_ph')}
            autoFocus
          />
        </Field>
        <Field label={t('shop_delivery_note')} hint={t('shop_delivery_note_hint')}>
          <input
            className={inputCls}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('shop_delivery_note_ph')}
          />
        </Field>
        <Button variant="primary" className="w-full" onClick={submit} disabled={num(boxes) <= 0 || busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t('shop_delivery_submit')}
        </Button>
      </div>
    </Modal>
  )
}
