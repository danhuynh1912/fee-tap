import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { navigate } from '../router'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [myClubs, setMyClubs] = useState([])
  const [resolving, setResolving] = useState(false)
  const [signinBusy, setSigninBusy] = useState(false)
  // profileType: undefined = chưa load, null = chưa chọn, 'club' | 'shop'
  const [profileType, setProfileType] = useState(undefined)
  const [shop, setShop] = useState(null)

  // ── auth session ────────────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured) {
      setAuthReady(true)
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session
      // If access token is expired (or about to expire in <60s), refresh immediately
      if (s && s.expires_at && s.expires_at * 1000 < Date.now() + 60_000) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        setSession(refreshed.session)
      } else {
        setSession(s)
      }
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

  // ── load user profile (club host vs shop owner) ─────────────────
  const loadShop = useCallback(async (sess = session) => {
    if (!sess) return null
    const { data: sh } = await supabase.from('shops').select('*').eq('owner_id', sess.user.id).maybeSingle()
    setShop(sh || null)
    return sh || null
  }, [session])

  useEffect(() => {
    if (!session) {
      setProfileType(undefined)
      setShop(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('profile_type')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      const type = prof?.profile_type ?? null
      setProfileType(type)
      if (type === 'shop') await loadShop(session)
    })()
    return () => { cancelled = true }
  }, [session, loadShop])

  async function chooseProfile(type) {
    if (!session) return
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ user_id: session.user.id, profile_type: type }, { onConflict: 'user_id' })
    if (error) throw error
    setProfileType(type)
  }

  // ── load all clubs (owned + member) ─────────────────────────────
  const loadClubs = useCallback(async (sess, currentPath = window.location.pathname) => {
    if (!sess) {
      setMyClubs([])
      return
    }
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
        const { data: ownerProfiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ownerIds)
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
      // No clubs: brand-new users land on ChooseProfilePage (handled in App).
      // Existing club users (legacy, no profile row) keep working since clubs > 0.
      // Only auto-route to /new when already a confirmed club host with no clubs.
      if (all.length === 0 && profileType === 'club' && currentPath !== '/new' && !currentPath.startsWith('/join/')) {
        navigate('/new')
      }
    } finally {
      if (!cancelled) setResolving(false)
    }
    return () => {
      cancelled = true
    }
  }, [profileType])

  useEffect(() => {
    if (!session) {
      setMyClubs([])
      return
    }
    // Wait for profile to resolve; skip club loading entirely for shop owners.
    if (profileType === undefined || profileType === 'shop') return
    loadClubs(session)
  }, [session, profileType, loadClubs])

  function updateClub(updated) {
    setMyClubs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  function addClub(club) {
    setMyClubs((prev) => [...prev, club])
  }

  async function signInGoogle(redirectPath = '') {
    setSigninBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + (redirectPath || '') },
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
    const { error } = await supabase
      .from('club_members')
      .upsert(
        { club_id: clubId, user_id: sess.user.id, name: sess.user.user_metadata?.full_name || sess.user.email },
        { onConflict: 'club_id,user_id', ignoreDuplicates: true }
      )
    if (error) throw error

    // Auto-enroll into any open payment collections
    const { data: newMember } = await supabase.from('club_members').select('id').eq('club_id', clubId).eq('user_id', sess.user.id).single()
    if (newMember) {
      const { data: openCols } = await supabase.from('payment_collections').select('id, amount_per_member').eq('club_id', clubId).eq('status', 'open')
      if (openCols?.length) {
        // Only insert records that don't already exist (idempotent)
        const { data: existing } = await supabase.from('member_payment_records').select('collection_id').eq('member_id', newMember.id)
        const existingIds = new Set((existing || []).map((r) => r.collection_id))
        const toInsert = openCols
          .filter((c) => !existingIds.has(c.id))
          .map((c) => ({ collection_id: c.id, club_id: clubId, member_id: newMember.id, amount: c.amount_per_member }))
        if (toInsert.length) await supabase.from('member_payment_records').insert(toInsert)
      }
    }

    const { data: clubData } = await supabase.from('clubs').select('*').eq('id', clubId).single()
    if (clubData) {
      const { data: ownerProfile } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', clubData.owner_id).maybeSingle()
      const newClub = { ...clubData, userRole: 'member', owner: ownerProfile || null }
      setMyClubs((prev) => (prev.some((c) => c.id === clubId) ? prev : [...prev, newClub]))
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
    // shop portal
    profileType,
    chooseProfile,
    shop,
    setShop,
    reloadShop: loadShop,
  }
}
