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

import { useState, useRef, useEffect } from 'react'

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

  const { session, authReady, myClubs, resolving, signinBusy, signInGoogle, signOut, joinClub, updateClub, addClub } = useAuth()

  // Route parsing
  const clubMatch =
    matchPath('/club/:id', path) || matchPath('/club/:id/settings', path) || matchPath('/club/:id/log', path) || matchPath('/club/:id/fund', path)
  const joinMatch = matchPath('/join/:id', path)
  const clubId = clubMatch?.params?.id
  const joinClubId = joinMatch?.params?.id
  const isNewPath = path === '/new'
  const activeClub = clubId ? (myClubs.find((c) => c.id === clubId) ?? null) : null

  // Auto-join: run in useEffect so it fires exactly once, not during render
  const [joining, setJoining] = useState(false)
  const joinedRef = useRef(null)
  const alreadyHost = joinClubId ? myClubs.some((c) => c.id === joinClubId && c.userRole === 'host') : false
  const alreadyMember = joinClubId ? myClubs.some((c) => c.id === joinClubId && c.userRole === 'member') : false

  useEffect(() => {
    if (!session || !joinClubId || resolving) return
    // Already a member → go straight to club
    if (alreadyMember) {
      navigate(`/club/${joinClubId}`)
      return
    }
    // Host of this club → block, show message
    if (alreadyHost) return
    if (joinedRef.current === joinClubId) return
    joinedRef.current = joinClubId
    setJoining(true)
    joinClub(joinClubId)
      .then(() => {
        setWelcomeClubId(joinClubId)
        navigate(`/club/${joinClubId}`)
      })
      .catch((e) => toast(e.message || t('err_generic')))
      .finally(() => setJoining(false))
  }, [session, joinClubId, resolving, alreadyHost, alreadyMember])

  const loading = !authReady || (session && resolving)

  let body
  if (loading) {
    body = (
      <div className="grid flex-1 place-items-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
        </div>
      </div>
    )
  } else if (!session) {
    body = joinClubId ? (
      <PreJoinPage clubId={joinClubId} onGoogle={signInGoogle} busy={signinBusy} />
    ) : (
      <SignInPage onGoogle={signInGoogle} busy={signinBusy} />
    )
  } else if (joinClubId) {
    body = alreadyHost ? (
      <div className="grid flex-1 place-items-center px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-600">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <p className="text-lg font-bold text-slate-900">{t('join_already_host')}</p>
          <button
            onClick={() => navigate(`/club/${joinClubId}`)}
            className="mt-5 rounded-2xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition active:scale-[0.98]"
          >
            {t('join_go_to_club')}
          </button>
        </div>
      </div>
    ) : (
      <div className="grid flex-1 place-items-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
        </div>
      </div>
    )
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
      body = <ClubLayout session={session} club={activeClub} setClub={updateClub} path={path} toast={toast} onSignOut={signOut} />
    } else {
      body = (
        <div className="grid flex-1 place-items-center">
          {resolving ? (
            <div className="flex items-center gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-slate-400 mb-4">{t('club_not_found')}</p>
              <button onClick={() => navigate('/')} className="text-sm font-medium text-slate-600 underline">
                {t('club_back')}
              </button>
            </div>
          )}
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
        onSelectClub={(c) => (c === 'new' ? navigate('/new') : navigate(`/club/${c.id}`))}
      />
      {!isConfigured && <ConfigWarning />}
      {body}
      {welcomeClubId && <WelcomeModal clubId={welcomeClubId} myClubs={myClubs} onClose={() => setWelcomeClubId(null)} />}
      <Toast toast={toastMsg} />
    </div>
  )
}
