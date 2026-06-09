import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { navigate } from '../router'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [myClubs, setMyClubs] = useState([])
  const [resolving, setResolving] = useState(false)
  const [signinBusy, setSigninBusy] = useState(false)

  // ── auth session ────────────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, incoming) => {
      // Only update session when the user identity actually changes.
      // Supabase fires TOKEN_REFRESHED on tab-refocus, which produces a new
      // session object with the same user ID — that would re-trigger all data
      // fetches unnecessarily.
      setSession((prev) => {
        const prevId = prev?.user?.id
        const nextId = incoming?.user?.id
        if (prevId === nextId && !!prev === !!incoming) return prev
        return incoming
      })
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // ── load all clubs (owned + member) ─────────────────────────────
  const loadClubs = useCallback(async (sess, currentPath = window.location.pathname) => {
    if (!sess) { setMyClubs([]); return }
    let cancelled = false
    setResolving(true)
    try {
      const uid = sess.user.id
      const [{ data: owned }, { data: memRows }] = await Promise.all([
        supabase.from('clubs').select('*').eq('owner_id', uid).order('created_at', { ascending: true }),
        supabase.from('club_members').select('club_id').eq('user_id', uid),
      ])

      const ownedClubs = (owned || []).map((c) => ({ ...c, userRole: 'host' }))
      const ownedIds = new Set(ownedClubs.map((c) => c.id))

      const memberOnlyIds = (memRows || []).map((r) => r.club_id).filter((id) => !ownedIds.has(id))
      let memberClubs = []
      if (memberOnlyIds.length) {
        const { data: mclubs } = await supabase.from('clubs').select('*').in('id', memberOnlyIds)
        const ownerIds = [...new Set((mclubs || []).map((c) => c.owner_id))]
        const { data: ownerProfiles } = await supabase
          .from('profiles').select('id, full_name, avatar_url').in('id', ownerIds)
        const profileMap = Object.fromEntries((ownerProfiles || []).map((p) => [p.id, p]))
        memberClubs = (mclubs || []).map((c) => ({
          ...c,
          owner: profileMap[c.owner_id] || null,
          userRole: 'member',
        }))
      }

      if (cancelled) return
      const all = [...ownedClubs, ...memberClubs]
      setMyClubs(all)

      // Auto-redirect: exactly 1 club → go straight to it
      if (currentPath === '/' && all.length === 1) {
        navigate(`/club/${all[0].id}`)
        return
      }
      // No clubs → onboarding
      if (all.length === 0 && currentPath !== '/new' && !currentPath.startsWith('/join/')) {
        navigate('/new')
      }
    } finally {
      if (!cancelled) setResolving(false)
    }
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (session) {
      loadClubs(session)
    } else {
      setMyClubs([])
    }
  }, [session, loadClubs])

  function updateClub(updated) {
    setMyClubs((prev) => prev.map((c) => c.id === updated.id ? updated : c))
  }

  function addClub(club) {
    setMyClubs((prev) => [...prev, club])
  }

  async function signInGoogle() {
    setSigninBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    } catch (e) {
      setSigninBusy(false)
      throw e
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setMyClubs([])
    navigate('/')
  }

  async function joinClub(clubId, sess = session) {
    if (!sess || !clubId) return
    const { error } = await supabase.from('club_members').upsert(
      { club_id: clubId, user_id: sess.user.id, name: sess.user.user_metadata?.full_name || sess.user.email },
      { onConflict: 'club_id,user_id', ignoreDuplicates: true }
    )
    if (error) throw error
    const { data: clubData } = await supabase.from('clubs').select('*').eq('id', clubId).single()
    if (clubData) {
      const newClub = { ...clubData, userRole: 'member' }
      setMyClubs((prev) => prev.some((c) => c.id === clubId) ? prev : [...prev, newClub])
    }
  }

  return {
    session,
    authReady,
    myClubs,
    resolving,
    signinBusy,
    signInGoogle,
    signOut,
    joinClub,
    updateClub,
    addClub,
    reloadClubs: loadClubs,
  }
}
