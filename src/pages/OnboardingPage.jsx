import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, ArrowRight, Loader2, Zap } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, inputCls } from '../components/ui/Field'
import { Footer } from '../components/layout/Nav'
import { cx } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { navigate } from '../router'
import { SPORT_LIST } from '../constants'

export function OnboardingPage({ session, onClubReady, toast }) {
  const { t } = useTranslation()
  const [sport, setSport] = useState('badminton')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function createClub(e) {
    e.preventDefault()
    if (name.trim().length < 2 || busy) return
    setBusy(true)
    try {
      const { data: club, error } = await supabase
        .from('clubs')
        .insert({ name: name.trim(), owner_id: session.user.id, plan: 'free', sport_type: sport })
        .select('*')
        .single()
      if (error) throw error
      await supabase.from('club_settings').insert({ club_id: club.id })
      onClubReady(club)
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
              <Building2 className="h-8 w-8" />
            </span>
            <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">{t('onb_title')}</h2>
            <p className="mt-2 text-slate-500">{t('onb_sub')}</p>
          </div>
          <Card>
            <form onSubmit={createClub} className="space-y-6">
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Zap className="h-4 w-4 text-slate-400" /> {t('onb_sport')}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SPORT_LIST.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSport(s.id)}
                      className={cx(
                        'flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3 text-center transition active:scale-[0.97]',
                        sport === s.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      )}
                    >
                      <span className="text-2xl leading-none">{s.emoji}</span>
                      <span className="text-xs font-semibold leading-tight">{t(s.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Field label={t('onb_club_name')} icon={Building2}>
                <input
                  className={inputCls}
                  placeholder={t('onb_club_ph')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={name.trim().length < 2 || busy}>
                {busy
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> {t('onb_creating')}</>
                  : <>{t('onb_create')} <ArrowRight className="h-5 w-5 text-lime-400" /></>}
              </Button>
            </form>
          </Card>
          <p className="mt-6 text-center text-sm text-slate-400">{t('onb_no_club')}</p>
        </div>
      </div>
      <Footer />
    </main>
  )
}
