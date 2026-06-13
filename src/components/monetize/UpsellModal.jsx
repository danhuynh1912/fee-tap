import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, Check, ArrowRight, Loader2, Receipt, Lock } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { MockQR } from '../charts/MockQR'
import { supabase } from '../../lib/supabase'

export function UpsellModal({ open, onClose, onUpgraded, clubId, toast }) {
  const { t } = useTranslation()
  const [stage, setStage] = useState('offer') // offer | qr | processing | success
  const timer = useRef(null)

  useEffect(() => {
    if (!open) {
      setStage('offer')
      clearTimeout(timer.current)
    }
    return () => clearTimeout(timer.current)
  }, [open])

  async function pay() {
    setStage('processing')
    timer.current = setTimeout(async () => {
      try {
        await supabase.from('clubs').update({ plan: 'pro' }).eq('id', clubId)
      } catch {}
      setStage('success')
      onUpgraded()
      timer.current = setTimeout(() => {
        onClose()
      }, 1600)
    }, 3000)
  }

  return (
    <Modal open={open} onClose={stage === 'processing' ? () => {} : onClose} maxW="max-w-lg">
      {stage === 'success' ? (
        <div className="py-6 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-lime-400 animate-pop-in">
            <Crown className="h-8 w-8 text-slate-900" />
          </span>
          <h3 className="mt-5 text-2xl font-black text-slate-900">{t('upsell_success')}</h3>
        </div>
      ) : stage === 'offer' ? (
        <>
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-lime-400">
              <Crown className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-xl font-black text-slate-900">{t('upsell_title')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('upsell_body')}</p>
          </div>

          <div className="mt-6 space-y-2.5">
            {['upsell_feature_1', 'upsell_feature_2', 'upsell_feature_3'].map((k) => (
              <div key={k} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-lime-400 text-slate-900">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <span className="text-sm font-semibold text-slate-700">{t(k)}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-end justify-between rounded-2xl bg-slate-900 px-5 py-4">
            <div>
              <p className="text-xs font-medium text-slate-400">SPOFUND Pro</p>
              <p className="font-mono text-2xl font-black text-white">
                {t('upsell_price')}
                <span className="ml-1 text-sm font-medium text-slate-500">{t('upsell_price_cycle')}</span>
              </p>
            </div>
            <Button variant="volt" onClick={() => setStage('qr')}>
              {t('upsell_pay')} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <button onClick={onClose} className="mt-3 w-full text-center text-sm font-medium text-slate-400 hover:text-slate-600">
            {t('upsell_maybe_later')}
          </button>
        </>
      ) : (
        <div className="text-center">
          <h3 className="text-xl font-black text-slate-900">{t('upsell_pay')}</h3>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">{t('upsell_price')}</p>
          <div className="mt-5 inline-block rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/5">
            <MockQR />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
            {stage === 'processing' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-700" /> {t('upsell_processing')}
              </>
            ) : (
              <>
                <Receipt className="h-4 w-4" /> {t('upsell_scan')}
              </>
            )}
          </div>
          {stage === 'qr' && (
            <Button variant="primary" size="lg" className="mt-5 w-full" onClick={pay}>
              {t('upsell_pay')} <ArrowRight className="h-5 w-5 text-lime-400" />
            </Button>
          )}
        </div>
      )}
    </Modal>
  )
}
