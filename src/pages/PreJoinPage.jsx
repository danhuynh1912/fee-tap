import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import { Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'

const SITE_URL = 'https://spofund.vercel.app'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og.png`

export function PreJoinPage({ clubId, onGoogle, busy }) {
  const { t } = useTranslation()
  const [clubName, setClubName] = useState(null)

  useEffect(() => {
    if (!clubId) return
    supabase.from('clubs').select('name').eq('id', clubId).single().then(({ data }) => {
      if (data?.name) setClubName(data.name)
    })
  }, [clubId])

  function handleSignIn() {
    localStorage.setItem('feetap_pending_join', clubId)
    onGoogle(`/join/${clubId}`)
  }

  const title = clubName ? `Join ${clubName} — SPOFUND` : 'Join a club — SPOFUND'
  const description = clubName
    ? `You've been invited to ${clubName}. Sign in to view the schedule, costs, and manage the club fund together.`
    : 'Sign in to join the club, view the court schedule, and manage the fund with your group.'

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`${SITE_URL}/join/${clubId}`} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Helmet>

      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="w-full max-w-sm animate-fade-in rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-900/[0.06] text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-slate-900 text-3xl">🏅</div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 mb-1">
            {clubName ? `Tham gia ${clubName}` : t('join_pre_title')}
          </h1>
          <p className="text-slate-500 text-sm mb-6">{t('join_pre_sub')}</p>
          <Button variant="volt" className="w-full" onClick={handleSignIn} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('join_signin')}
          </Button>
        </div>
      </div>
    </>
  )
}
