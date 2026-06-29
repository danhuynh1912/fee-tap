import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Store, Phone, MapPin, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, inputCls } from '../../components/ui/Field'
import { Footer } from '../../components/layout/Nav'
import { supabase } from '../../lib/supabase'

export function ShopOnboardingPage({ session, onShopReady, toast }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)

  async function createShop(e) {
    e.preventDefault()
    if (name.trim().length < 2 || busy) return
    setBusy(true)
    try {
      const { data: shop, error } = await supabase
        .from('shops')
        .insert({
          owner_id: session.user.id,
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
        })
        .select('*')
        .single()
      if (error) throw error
      onShopReady(shop)
    } catch (err) {
      toast(err.message || t('err_generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="bg-grid flex-1">
      <div className="mx-auto max-w-xl px-5 py-16">
        <div className="animate-scale-in">
          <div className="mb-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-900 text-lime-400">
              <Store className="h-8 w-8" />
            </span>
            <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">{t('shop_onb_title')}</h2>
            <p className="mt-2 text-slate-500">{t('shop_onb_sub')}</p>
          </div>
          <Card>
            <form onSubmit={createShop} className="space-y-5">
              <Field label={t('shop_onb_name')} icon={Store}>
                <input className={inputCls} placeholder={t('shop_onb_name_ph')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </Field>
              <Field label={t('shop_onb_phone')} icon={Phone}>
                <input className={inputCls} placeholder={t('shop_onb_phone_ph')} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
              </Field>
              <Field label={t('shop_onb_address')} icon={MapPin}>
                <input className={inputCls} placeholder={t('shop_onb_address_ph')} value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={name.trim().length < 2 || busy}>
                {busy ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> {t('shop_onb_creating')}</>
                ) : (
                  <>{t('shop_onb_create')} <ArrowRight className="h-5 w-5 text-lime-400" /></>
                )}
              </Button>
            </form>
          </Card>
        </div>
      </div>
      <Footer />
    </main>
  )
}
