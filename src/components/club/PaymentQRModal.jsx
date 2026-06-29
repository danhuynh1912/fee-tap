import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { QrCode, CheckCircle2, Loader2, ExternalLink, RefreshCw, Globe } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { cx, fmtVND } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { createPaymentQR } from '../../lib/paymentService'
import { handleError } from '../../lib/handleError'

// dl.vietqr.io app IDs — confirmed: icb (VietinBank), bidv, acb. Others best-effort.
// If app= is wrong, redirect_url brings user back to PayOS web checkout.
const BH = 'https://img.bankhub.dev/rounded'
const BANKS = [
  // Auto-fill banks (strictNote = uppercase alphanumeric only for tn param)
  { id: 'icb',  label: 'VTB',  fullName: 'VietinBank',     appId: 'icb',   color: '#1A4F9F', logo: `${BH}/vietinbank.png`, autoFill: true, strictNote: true },
  { id: 'bidv', label: 'BIDV', fullName: 'BIDV',           appId: 'bidv',  color: '#005BAA', logo: `${BH}/bidv.png`,       autoFill: true, strictNote: true },
  { id: 'ocb',  label: 'OCB',  fullName: 'OCB',            appId: 'ocb',   color: '#FF6600', logo: `${BH}/ocb.png`,        autoFill: true, strictNote: true },
  { id: 'acb',  label: 'ACB',  fullName: 'ACB',            appId: 'acb',   color: '#1A3C8F', logo: `${BH}/acb.png`,        autoFill: true, strictNote: true },
  // Standard banks
  { id: 'vcb',  label: 'VCB',  fullName: 'Vietcombank',    appId: 'vcb',   color: '#007B40', logo: `${BH}/vietcombank.png` },
  { id: 'mb',   label: 'MB',   fullName: 'MB Bank',        appId: 'mb',    color: '#5B2D8E', logo: `${BH}/mbbank.png` },
  { id: 'tcb',  label: 'TCB',  fullName: 'Techcombank',    appId: 'tcb',   color: '#EE0033', logo: `${BH}/techcombank.png` },
  { id: 'vpb',  label: 'VPB',  fullName: 'VPBank NEO',     appId: 'vpb',   color: '#00A651', logo: `${BH}/vpbank.png` },
  { id: 'agr',  label: 'AGR',  fullName: 'Agribank',       appId: 'agr',   color: '#C8102E', logo: `${BH}/agribank.png` },
  { id: 'stb',  label: 'STB',  fullName: 'Sacombank',      appId: 'stb',   color: '#0066CC', logo: `${BH}/sacombank.png` },
  { id: 'tpb',  label: 'TP',   fullName: 'TPBank',         appId: 'tpb',   color: '#6B0000', logo: `${BH}/tpbank.png` },
  { id: 'hdb',  label: 'HDB',  fullName: 'HDBank',         appId: 'hdb',   color: '#003366', logo: `${BH}/hdbank.png` },
  { id: 'shb',  label: 'SHB',  fullName: 'SHB',            appId: 'shb',   color: '#D4001B', logo: `${BH}/shb.png` },
  { id: 'msb',  label: 'MSB',  fullName: 'MSB',            appId: 'msb',   color: '#E30613', logo: `${BH}/msb.png` },
  { id: 'sea',  label: 'SeA',  fullName: 'SeABank',        appId: 'seab',  color: '#00AEEF', logo: `${BH}/seabank.png` },
  { id: 'vib',  label: 'VIB',  fullName: 'VIB',            appId: 'vib',   color: '#5C0F8B', logo: `${BH}/vib.png` },
  { id: 'lpb',  label: 'LPB',  fullName: 'LienViet24h',    appId: 'lpb',   color: '#CC0000', logo: `${BH}/lpbank.png` },
  { id: 'scb',  label: 'SCB',  fullName: 'SCB',            appId: 'scb',   color: '#003087', logo: `${BH}/scb.png` },
  { id: 'cake', label: 'CAKE', fullName: 'CAKE by VPBank', appId: 'cake',  color: '#FF69B4', logo: `${BH}/cake.png` },
]

// Build dl.vietqr.io deep link for a specific bank app.
// ba = accountNumber@bin (e.g. VQRQAJVHC9722@mb) — same virtual account, only app= changes.
function buildVietQRLink({ appId, accountNumber, bin, accountName, amount, description, checkoutUrl, strictNote }) {
  const ba = `${accountNumber}@${bin.toLowerCase()}`
  const tn = strictNote ? description.toUpperCase().replace(/[^A-Z0-9]/g, '') : description
  const p = new URLSearchParams({
    app: appId,
    ba,
    bn: accountName,
    am: String(amount),
    tn,
    redirect_url: checkoutUrl,
  })
  return `https://dl.vietqr.io/pay?${p.toString()}`
}

function openUrl(url) {
  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(url)
  } else {
    window.location.href = url
  }
}

export function PaymentQRModal({ open, onClose, record, memberName, liveAmount, toast }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [localRecord, setLocalRecord] = useState(record)
  const [justPaid, setJustPaid] = useState(false)
  // Extra fields from PayOS API needed for dl.vietqr.io links
  const [vietQRMeta, setVietQRMeta] = useState(null) // { accountNumber, accountName, bin, description }
  const [showAllBanks, setShowAllBanks] = useState(false)

  const isMobile = /android|iphone|ipad/i.test(navigator.userAgent)

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

  useEffect(() => {
    if (!open || !localRecord || localRecord.status !== 'pending') return
    const amountChanged = liveAmount && liveAmount !== localRecord.amount
    if (!localRecord.payos_order_code || amountChanged) generateQR()
  }, [open, localRecord?.id, liveAmount]) // eslint-disable-line

  async function generateQR() {
    if (!localRecord || loading) return
    setLoading(true)
    try {
      if (liveAmount && liveAmount !== localRecord.amount) {
        await supabase
          .from('member_payment_records')
          .update({ amount: liveAmount, payos_order_code: null, payos_checkout_url: null, payos_qr_code: null })
          .eq('id', localRecord.id)
        setLocalRecord(r => ({ ...r, amount: liveAmount, payos_order_code: null, payos_checkout_url: null, payos_qr_code: null }))
        setVietQRMeta(null)
      }
      const { data: { session } } = await supabase.auth.getSession()
      const json = await createPaymentQR(localRecord.id, liveAmount ?? localRecord.amount, session?.access_token)

      setLocalRecord(r => ({
        ...r,
        payos_order_code: json.orderCode,
        payos_checkout_url: json.checkoutUrl,
        payos_qr_code: json.qrCode,
      }))
      // Store extra fields for building bank deep links
      if (json.accountNumber && json.bin) {
        setVietQRMeta({
          accountNumber: json.accountNumber,
          accountName: json.accountName,
          bin: json.bin,
          description: json.description,
        })
      }
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setLoading(false)
    }
  }

  const handleBankClick = useCallback(async (bank) => {
    const checkoutUrl = localRecord?.payos_checkout_url
    if (!checkoutUrl) return

    const openBank = () => {
      if (isMobile && vietQRMeta) {
        openUrl(buildVietQRLink({
          appId: bank.appId,
          accountNumber: vietQRMeta.accountNumber,
          bin: vietQRMeta.bin,
          accountName: vietQRMeta.accountName,
          amount: liveAmount ?? localRecord?.amount,
          description: vietQRMeta.description,
          checkoutUrl,
          strictNote: bank.strictNote,
        }))
      } else {
        openUrl(checkoutUrl)
      }
    }

    const qrImg = localRecord?.payos_qr_code
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(localRecord.payos_qr_code)}`
      : null
    if (!bank.autoFill && qrImg) {
      try {
        const res = await fetch(qrImg)
        const blob = await res.blob()
        const file = new File([blob], 'vietqr.png', { type: 'image/png' })

        if (navigator.canShare?.({ files: [file] })) {
          // iOS/Android: native share sheet → user taps "Save Image" → vào Photos library
          await navigator.share({ files: [file], title: 'VietQR' })
        } else {
          // Desktop fallback: download to Downloads folder
          const blobUrl = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = blobUrl
          a.download = 'vietqr.png'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(blobUrl)
        }
      } catch {
        // User cancelled share or fetch failed — still redirect
      }
      openBank()
    } else {
      openBank()
    }
  }, [vietQRMeta, localRecord?.payos_checkout_url, localRecord?.payos_qr_code, localRecord?.amount, liveAmount, isMobile])

  const openWeb = useCallback(() => {
    if (localRecord?.payos_checkout_url) openUrl(localRecord.payos_checkout_url)
  }, [localRecord?.payos_checkout_url])

  const isPaid = localRecord?.status === 'paid' || localRecord?.status === 'manual'
  const hasQR = !!localRecord?.payos_qr_code
  const hasCheckout = !!localRecord?.payos_checkout_url
  const qrImageUrl = hasQR
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(localRecord.payos_qr_code)}`
    : null

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', isPaid ? 'bg-lime-400 text-slate-900' : 'bg-slate-900 text-lime-400')}>
            {isPaid ? <CheckCircle2 className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-black text-slate-900">{t('payment_qr_title')}</p>
            <p className="text-xs text-slate-500">{memberName}</p>
          </div>
        </div>

        {/* Paid state */}
        {isPaid && (
          <div className={cx('rounded-3xl border p-8 text-center space-y-3 transition-all duration-500', justPaid ? 'bg-lime-400 border-lime-400 scale-[1.02]' : 'bg-lime-50 border-lime-200')}>
            <CheckCircle2 className={cx('mx-auto transition-all duration-500', justPaid ? 'h-16 w-16 text-slate-900 animate-bounce' : 'h-12 w-12 text-lime-500')} />
            <p className="font-black text-xl text-slate-900">{justPaid ? t('payment_qr_just_paid') : t('payment_qr_success')}</p>
            <p className={cx('font-mono text-3xl font-black', justPaid ? 'text-slate-900' : 'text-lime-600')}>{fmtVND(liveAmount ?? localRecord?.amount ?? 0)}</p>
            {justPaid && <p className="text-sm text-slate-700">{t('payment_qr_closing')}</p>}
          </div>
        )}

        {/* QR + bank picker */}
        {!isPaid && (
          <>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">{t('payment_qr_amount')}</p>
              <p className="font-mono text-3xl font-black text-slate-900">{fmtVND(liveAmount ?? localRecord?.amount ?? 0)}</p>
            </div>

            <div className="flex justify-center">
              {loading && (
                <div className="flex h-60 w-60 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                </div>
              )}
              {!loading && qrImageUrl && (
                <div className="rounded-2xl border-2 border-slate-200 p-3 bg-white">
                  <img src={qrImageUrl} alt="VietQR" width={240} height={240} className="rounded-xl" />
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

            {/* Mobile: bank picker | Desktop: web button */}
            {(hasQR || hasCheckout) && (
              isMobile ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">
                    {t('payment_qr_pick_bank')}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {(showAllBanks ? BANKS : BANKS.slice(0, 7)).map((bank) => (
                      <button
                        key={bank.id}
                        onClick={() => handleBankClick(bank)}
                        className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-slate-50 py-3 transition active:scale-95 hover:bg-slate-100"
                      >
                        <span className="relative shrink-0">
                          <img
                            src={bank.logo}
                            alt={bank.fullName}
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-xl object-cover"
                            onError={e => {
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.nextSibling.style.display = 'grid'
                            }}
                          />
                          <span
                            className="h-8 w-8 rounded-xl place-items-center text-white text-[9px] font-black hidden"
                            style={{ backgroundColor: bank.color }}
                          >
                            {bank.label}
                          </span>
                          {bank.autoFill && (
                            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white" />
                          )}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 leading-tight text-center px-0.5">
                          {bank.label}
                        </span>
                      </button>
                    ))}
                    {!showAllBanks && (
                      <button
                        onClick={() => setShowAllBanks(true)}
                        className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-slate-50 py-3 transition active:scale-95 hover:bg-slate-100"
                      >
                        <span className="h-8 w-8 rounded-xl bg-slate-200 grid place-items-center shrink-0">
                          <span className="text-slate-500 text-lg leading-none">···</span>
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 leading-tight text-center px-0.5">
                          {t('see_more')}
                        </span>
                      </button>
                    )}
                  </div>

                  {hasCheckout && (
                    <button onClick={openWeb} className="flex items-center justify-center gap-1.5 w-full text-xs text-slate-400 hover:text-slate-600 transition py-1">
                      <Globe className="h-3 w-3" />
                      {t('payment_qr_open_web')}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {qrImageUrl && <p className="text-center text-xs text-slate-400">{t('payment_qr_scan')}</p>}
                  {hasCheckout && (
                    <a href={localRecord.payos_checkout_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-lime-400 hover:bg-slate-800 transition active:scale-[0.98]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t('payment_qr_open_bank')}
                    </a>
                  )}
                </>
              )
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
