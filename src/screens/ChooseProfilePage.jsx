import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Store, ArrowRight, Loader2 } from 'lucide-react'
import { cx } from '../lib/utils'

// First-run identity picker: shown once after sign-in when the user has no
// profile yet. Routes to the club onboarding or the shop onboarding.
export function ChooseProfilePage({ onChoose }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(null) // 'club' | 'shop' | null

  async function pick(type) {
    if (busy) return
    setBusy(type)
    try {
      await onChoose(type)
    } finally {
      setBusy(null)
    }
  }

  const options = [
    { type: 'club', icon: Building2, titleKey: 'choose_club_title', descKey: 'choose_club_desc' },
    { type: 'shop', icon: Store, titleKey: 'choose_shop_title', descKey: 'choose_shop_desc' },
  ]

  return (
    <main className="bg-grid flex-1">
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="animate-scale-in">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">{t('choose_title')}</h2>
            <p className="mt-2 text-slate-500">{t('choose_sub')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {options.map(({ type, icon: Icon, titleKey, descKey }) => (
              <button
                key={type}
                type="button"
                onClick={() => pick(type)}
                disabled={!!busy}
                className={cx(
                  'group flex flex-col items-start gap-4 rounded-3xl border-2 border-slate-200 bg-white p-7 text-left transition',
                  'hover:border-slate-900 hover:shadow-xl hover:shadow-slate-900/[0.05] active:scale-[0.98]',
                  busy && busy !== type && 'opacity-40'
                )}
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-lime-400">
                  {busy === type ? <Loader2 className="h-7 w-7 animate-spin" /> : <Icon className="h-7 w-7" />}
                </span>
                <div>
                  <p className="text-lg font-extrabold tracking-tight text-slate-900">{t(titleKey)}</p>
                  <p className="mt-1 text-sm text-slate-500">{t(descKey)}</p>
                </div>
                <span className="mt-auto flex items-center gap-1 text-sm font-semibold text-slate-400 group-hover:text-slate-900 transition">
                  {t('choose_continue')} <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
