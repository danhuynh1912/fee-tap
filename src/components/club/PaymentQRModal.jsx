import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { QrCode, CheckCircle2, Loader2, ExternalLink, RefreshCw } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { cx, fmtVND } from '../../lib/utils'
import { supabase } from '../../lib/supabase'

export function PaymentQRModal({ open, onClose, record, memberName, liveAmount, toast }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [localRecord, setLocalRecord] = useState(record)
  const [justPaid, setJustPaid] = useState(false)

  // Sync record from parent (realtime updates flow through here)
  // Detect transition to paid → trigger celebration then auto-close
  useEffect(() => {
    const wasPending = localRecord?.status === 'pending'
    const nowPaid = record?.status === 'paid' || record?.status === 'manual'
    if (wasPending && nowPaid) {
      setJustPaid(true)
      toast?.(t('payment_qr_success'))
      setTimeout(() => { setJustPaid(false); onClose() }, 7000)
    }
    setLocalRecord(record)
  }, [record?.status]) // eslint-disable-line

  // Auto-generate QR when modal opens, no QR yet, or amount has changed
  useEffect(() => {
    if (!open || !localRecord || localRecord.status !== 'pending') return
    const amountChanged = liveAmount && liveAmount !== localRecord.amount
    if (!localRecord.payos_order_code || amountChanged) {
      generateQR()
    }
  }, [open, localRecord?.id, liveAmount]) // eslint-disable-line

  async function generateQR() {
    if (!localRecord || loading) return
    setLoading(true)
    try {
      // Sync live-computed fee to DB; if amount changed, invalidate cached QR so a new one is created
      if (liveAmount && liveAmount !== localRecord.amount) {
        await supabase
          .from('member_payment_records')
          .update({ amount: liveAmount, payos_order_code: null, payos_checkout_url: null, payos_qr_code: null })
          .eq('id', localRecord.id)
        setLocalRecord((r) => ({ ...r, amount: liveAmount, payos_order_code: null, payos_checkout_url: null, payos_qr_code: null }))
      }

      const { data: { session } } = await supabase.auth.getSession()
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

      const res = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ record_id: localRecord.id, amount: liveAmount ?? localRecord.amount }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Lỗi tạo QR')

      setLocalRecord((r) => ({
        ...r,
        payos_order_code: json.orderCode,
        payos_checkout_url: json.checkoutUrl,
        payos_qr_code: json.qrCode,
      }))
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setLoading(false)
    }
  }

  const isPaid = localRecord?.status === 'paid' || localRecord?.status === 'manual'
  const qrImageUrl = localRecord?.payos_qr_code
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(localRecord.payos_qr_code)}`
    : null

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className={cx(
            'grid h-10 w-10 shrink-0 place-items-center rounded-2xl',
            isPaid ? 'bg-lime-400 text-slate-900' : 'bg-slate-900 text-lime-400'
          )}>
            {isPaid ? <CheckCircle2 className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-black text-slate-900">{t('payment_qr_title')}</p>
            <p className="text-xs text-slate-500">{memberName}</p>
          </div>
        </div>

        {/* Paid state */}
        {isPaid && (
          <div className={cx(
            'rounded-3xl border p-8 text-center space-y-3 transition-all duration-500',
            justPaid ? 'bg-lime-400 border-lime-400 scale-[1.02]' : 'bg-lime-50 border-lime-200'
          )}>
            <CheckCircle2 className={cx(
              'mx-auto transition-all duration-500',
              justPaid ? 'h-16 w-16 text-slate-900 animate-bounce' : 'h-12 w-12 text-lime-500'
            )} />
            <p className={cx('font-black text-xl', justPaid ? 'text-slate-900' : 'text-slate-900')}>
              {justPaid ? t('payment_qr_just_paid') : t('payment_qr_success')}
            </p>
            <p className={cx('font-mono text-3xl font-black', justPaid ? 'text-slate-900' : 'text-lime-600')}>
              {fmtVND(liveAmount ?? localRecord?.amount ?? 0)}
            </p>
            {justPaid && (
              <p className="text-sm text-slate-700">{t('payment_qr_closing')}</p>
            )}
          </div>
        )}

        {/* Generating / QR state */}
        {!isPaid && (
          <>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">{t('payment_qr_amount')}</p>
              <p className="font-mono text-3xl font-black text-slate-900">{fmtVND(liveAmount ?? localRecord?.amount ?? 0)}</p>
            </div>

            {/* QR image */}
            <div className="flex justify-center">
              {loading && (
                <div className="flex h-60 w-60 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                </div>
              )}
              {!loading && qrImageUrl && (
                <div className="rounded-2xl border-2 border-slate-200 p-3 bg-white">
                  <img
                    src={qrImageUrl}
                    alt="VietQR"
                    width={240}
                    height={240}
                    className="rounded-xl"
                  />
                </div>
              )}
              {!loading && !qrImageUrl && (
                <div className="flex h-60 w-60 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                  <QrCode className="h-10 w-10 text-slate-300" />
                  <Button variant="ghost" size="sm" onClick={generateQR}>
                    <RefreshCw className="h-4 w-4" /> {t('payment_qr_retry')}
                  </Button>
                </div>
              )}
            </div>

            {qrImageUrl && (
              <p className="text-center text-xs text-slate-400">{t('payment_qr_scan')}</p>
            )}

            {/* Open bank app button */}
            {localRecord?.payos_checkout_url && (
              <a
                href={localRecord.payos_checkout_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-lime-400 hover:bg-slate-800 transition active:scale-[0.98]"
              >
                <ExternalLink className="h-4 w-4" />
                {t('payment_qr_open_bank')}
              </a>
            )}
          </>
        )}

        <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>
          {t('close')}
        </Button>
      </div>
    </Modal>
  )
}
