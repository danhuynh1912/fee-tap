import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Store, Phone, MapPin, Check, Loader2, Copy, Link2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Field, inputCls } from '../../components/ui/Field'
import { supabase } from '../../lib/supabase'
import { handleError } from '../../lib/handleError'

function PartnerCodeBlock({ shopId, t }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(shopId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t('shop_partner_code_label')}</span>
      </div>
      <p className="mb-3 text-sm text-slate-500">{t('shop_partner_code_hint')}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all truncate rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs text-slate-700">
          {shopId}
        </code>
        <button
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white transition active:scale-95 hover:bg-slate-700"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-lime-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? t('shop_partner_code_copied') : t('shop_partner_code_copy')}
        </button>
      </div>
    </div>
  )
}

export function ShopSettingsPage({ shop, setShop, toast }) {
  const { t } = useTranslation()
  const [name, setName] = useState(shop?.name ?? '')
  const [phone, setPhone] = useState(shop?.phone ?? '')
  const [address, setAddress] = useState(shop?.address ?? '')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (name.trim().length < 2 || busy) return
    setBusy(true)
    try {
      const payload = { name: name.trim(), phone: phone.trim() || null, address: address.trim() || null }
      const { error } = await supabase.from('shops').update(payload).eq('id', shop.id)
      if (error) throw error
      setShop((s) => ({ ...s, ...payload }))
      toast(t('set_saved'))
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-6 py-8">
      <h1 className="mb-8 text-2xl font-black tracking-tight text-slate-900">{t('shop_settings_title')}</h1>

      <PartnerCodeBlock shopId={shop.id} t={t} />

      <div className="space-y-5">
        <Field label={t('shop_onb_name')} icon={Store}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('shop_onb_phone')} icon={Phone}>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        <Field label={t('shop_onb_address')} icon={MapPin}>
          <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Button variant="primary" className="w-full" onClick={save} disabled={name.trim().length < 2 || busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5 text-lime-400" /> {t('save')}</>}
        </Button>
      </div>
    </div>
  )
}
