import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Nav, ConfigWarning } from './components/layout/Nav'
import { Toast } from './components/ui/Toast'
import { useAuth } from './hooks/useAuth'
import { usePath, matchPath, navigate } from './router'
import { isConfigured } from './lib/supabase'

import { SignInPage } from './pages/SignInPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ClubPickerPage } from './pages/ClubPickerPage'
import { PreJoinPage } from './pages/PreJoinPage'
import { WelcomeModal } from './pages/WelcomeModal'
import { ClubLayout } from './pages/club/ClubLayout'

import { useState, useRef } from 'react'

export default function App() {
  const { t } = useTranslation()
  const path = usePath()
  const [toastMsg, setToastMsg] = useState(null)
  const [welcomeClubId, setWelcomeClubId] = useState(null)
  const toastTimer = useRef(null)

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }, [])

  const {
    session, authReady, myClubs, resolving, signinBusy,
    signInGoogle, signOut, joinClub, updateClub, addClub,
  } = useAuth()

  // Route parsing
  const clubMatch = matchPath('/club/:id', path)
    || matchPath('/club/:id/settings', path)
    || matchPath('/club/:id/log', path)
    || matchPath('/club/:id/fund', path)
  const joinMatch = matchPath('/join/:id', path)
  const clubId = clubMatch?.params?.id
  const joinClubId = joinMatch?.params?.id
  const isNewPath = path === '/new'
  const activeClub = clubId ? myClubs.find((c) => c.id === clubId) ?? null : null

  // Auto-join effect
  const [joiningId, setJoiningId] = useState(null)
  if (session && joinClubId && !resolving && joiningId !== joinClubId) {
    setJoiningId(joinClubId)
    joinClub(joinClubId).then(() => {
      setWelcomeClubId(joinClubId)
      navigate(`/club/${joinClubId}`)
    }).catch((e) => toast(e.message || t('err_generic')))
  }

  const loading = !authReady || (session && resolving)

  let body
  if (loading) {
    body = (
      <div className="grid flex-1 place-items-center">
        <div className="flex items-center gap-3 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}</div>
      </div>
    )
  } else if (!session) {
    body = joinClubId
      ? <PreJoinPage clubId={joinClubId} onGoogle={signInGoogle} busy={signinBusy} />
      : <SignInPage onGoogle={signInGoogle} busy={signinBusy} />
  } else if (isNewPath) {
    body = (
      <OnboardingPage
        session={session}
        toast={toast}
        onClubReady={(c) => {
          addClub({ ...c, userRole: 'host' })
          navigate(`/club/${c.id}`)
        }}
      />
    )
  } else if (clubId) {
    if (activeClub) {
      body = (
        <ClubLayout
          session={session}
          club={activeClub}
          setClub={updateClub}
          path={path}
          toast={toast}
        />
      )
    } else {
      body = (
        <div className="grid flex-1 place-items-center">
          {resolving
            ? <div className="flex items-center gap-3 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}</div>
            : <div className="text-center">
                <p className="text-slate-400 mb-4">{t('club_not_found')}</p>
                <button onClick={() => navigate('/')} className="text-sm font-medium text-slate-600 underline">{t('club_back')}</button>
              </div>
          }
        </div>
      )
    }
  } else {
    body = <ClubPickerPage myClubs={myClubs} onSelect={(c) => navigate(`/club/${c.id}`)} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50 text-slate-900 antialiased">
      <Nav
        session={session}
        myClubs={myClubs}
        activeClub={activeClub}
        onSignOut={signOut}
        onSelectClub={(c) => c === 'new' ? navigate('/new') : navigate(`/club/${c.id}`)}
      />
      {!isConfigured && <ConfigWarning />}
      {body}
      {welcomeClubId && (
        <WelcomeModal clubId={welcomeClubId} myClubs={myClubs} onClose={() => setWelcomeClubId(null)} />
      )}
      <Toast toast={toastMsg} />
    </div>
  )
}
