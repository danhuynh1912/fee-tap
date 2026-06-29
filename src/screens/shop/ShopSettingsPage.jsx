import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Store, Phone, MapPin, Check, Loader2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, inputCls } from '../../components/ui/Field'
import { supabase } from '../../lib/supabase'
import { handleError } from '../../lib/handleError'

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
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
      <h1 className="mb-6 text-2xl font-black tracking-tight text-slate-900">{t('shop_settings_title')}</h1>
      <Card>
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
      </Card>
    </main>
  )
}
