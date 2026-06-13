import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'

export function PreJoinPage({ clubId, onGoogle, busy }) {
  const { t } = useTranslation()

  function handleSignIn() {
    localStorage.setItem('feetap_pending_join', clubId)
    onGoogle(`/join/${clubId}`)
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm animate-fade-in rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-900/[0.06] text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-slate-900 text-3xl">🏅</div>
        <h1 className="text-xl font-black tracking-tight text-slate-900 mb-1">{t('join_pre_title')}</h1>
        <p className="text-slate-500 text-sm mb-6">{t('join_pre_sub')}</p>
        <Button variant="volt" className="w-full" onClick={handleSignIn} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('join_signin')}
        </Button>
      </div>
    </div>
  )
}
