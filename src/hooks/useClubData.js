import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { DEFAULT_SETTINGS } from '../constants'
import { synthesizeSlotsFromLegacy } from '../engine/forecast'
import { buildPollTally } from '../lib/pollTally'

export function useClubData(clubId) {
  const [settings, setSettings] = useState(null)
  const [slots, setSlots] = useState([])
  const [members, setMembers] = useState([])
  const membersRef = useRef([])
  const [logs, setLogs] = useState([])
  const [fundTxns, setFundTxns] = useState([])
  const [shuttleTxns, setShuttleTxns] = useState([])
  const [collections, setCollections] = useState([])
  const [memberPayments, setMemberPayments] = useState([])
  const [payosConfig, setPayosConfig] = useState(null)
  const [pollTally, setPollTally] = useState(null)
  const [loading, setLoading] = useState(true)

  // Keep a ref so fetchPollTally (useCallback) can access latest members without re-creating
  useEffect(() => { membersRef.current = members }, [members])

  // ── granular fetchers (used by realtime subscriptions) ───────────────────────
  // Each one only queries and updates its own slice of state.

  const fetchSettings = useCallback(async () => {
    const { data: s } = await supabase.from('club_settings').select('*').eq('club_id', clubId).maybeSingle()
    const merged = s
      ? { ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null)) }
      : { club_id: clubId, ...DEFAULT_SETTINGS }
    setSettings(merged)
  }, [clubId])

  const fetchSlots = useCallback(async () => {
    const { data: sl } = await supabase.from('court_slots').select('*').eq('club_id', clubId).order('sort_order')
    setSlots(sl || [])
  }, [clubId])

  const fetchMembers = useCallback(async () => {
    const { data: m } = await supabase.from('club_members').select('*').eq('club_id', clubId).order('created_at', { ascending: true })
    const userIds = (m || []).filter((r) => r.user_id).map((r) => r.user_id)
    let profileMap = {}
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, avatar_url').in('id', userIds)
      profileMap = Object.fromEntries((profs || []).map((p) => [p.id, p]))
    }
    setMembers((m || []).map((r) => ({ ...r, avatar_url: profileMap[r.user_id]?.avatar_url || null })))
  }, [clubId])

  const fetchLogs = useCallback(async () => {
    const { data: lg } = await supabase.from('session_logs').select('*').eq('club_id', clubId).order('played_on', { ascending: false })
    setLogs(lg || [])
  }, [clubId])

  const fetchFundTxns = useCallback(async () => {
    const { data: ft } = await supabase.from('fund_transactions').select('*').eq('club_id', clubId).order('created_at', { ascending: false })
    setFundTxns(ft || [])
  }, [clubId])

  const fetchShuttleTxns = useCallback(async () => {
    const { data: st } = await supabase.from('shuttle_transactions').select('*').eq('club_id', clubId).order('created_at', { ascending: true })
    setShuttleTxns(st || [])
  }, [clubId])

  const fetchCollections = useCallback(async () => {
    const { data: cols } = await supabase.from('payment_collections').select('*').eq('club_id', clubId).order('period_start', { ascending: false })
    setCollections(cols || [])
  }, [clubId])

  const fetchPollTally = useCallback(async () => {
    const { data: v } = await supabase
      .from('votes')
      .select('id, cycle_period_start, cycle_period_end')
      .eq('club_id', clubId)
      .eq('vote_type', 'membership_cycle')
      .order('created_at', { ascending: false })
      .limit(1)
    if (v && v.length) {
      const { data: rs } = await supabase
        .from('responses')
        .select('attending, guests, anonymous_user_id')
        .eq('vote_id', v[0].id)
        .order('created_at', { ascending: true })
      setPollTally(buildPollTally(v[0], rs, membersRef.current))
    } else {
      setPollTally(null)
    }
  }, [clubId])

  const fetchMemberPayments = useCallback(async () => {
    const { data: mpr } = await supabase.from('member_payment_records').select('*').eq('club_id', clubId)
    setMemberPayments(mpr || [])
  }, [clubId])

  // ── full initial load ────────────────────────────────────────────────────────
  // Runs once on mount (and on manual reload). Fetches everything in parallel,
  // then handles the legacy slot migration and poll tally sequentially.

  const loadAll = useCallback(async () => {
    if (!clubId) return
    const [{ data: s }, { data: sl }, { data: m }, { data: lg }, { data: ft }, { data: st }, { data: cols }, { data: mpr }, { data: pc }] = await Promise.all([
      supabase.from('club_settings').select('*').eq('club_id', clubId).maybeSingle(),
      supabase.from('court_slots').select('*').eq('club_id', clubId).order('sort_order'),
      supabase.from('club_members').select('*').eq('club_id', clubId).order('created_at', { ascending: true }),
      supabase.from('session_logs').select('*').eq('club_id', clubId).order('played_on', { ascending: false }),
      supabase.from('fund_transactions').select('*').eq('club_id', clubId).order('created_at', { ascending: false }),
      supabase.from('shuttle_transactions').select('*').eq('club_id', clubId).order('created_at', { ascending: true }),
      supabase.from('payment_collections').select('*').eq('club_id', clubId).order('period_start', { ascending: false }),
      supabase.from('member_payment_records').select('*').eq('club_id', clubId),
      // SECURITY DEFINER fn — safe for members to call, never exposes API keys
      supabase.rpc('club_has_payos', { p_club_id: clubId }),
    ])

    const mergedSettings = s
      ? { ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null)) }
      : { club_id: clubId, ...DEFAULT_SETTINGS }
    setSettings(mergedSettings)

    // Auto-migrate: if no court_slots exist yet, synthesize from legacy session_configs
    let resolvedSlots = sl || []
    if (!resolvedSlots.length && (mergedSettings.session_configs?.length || mergedSettings.play_weekdays?.length)) {
      const synthesized = synthesizeSlotsFromLegacy(mergedSettings)
      if (synthesized.length) {
        const { data: inserted } = await supabase.from('court_slots').insert(synthesized).select()
        resolvedSlots = inserted || synthesized
      }
    }
    setSlots(resolvedSlots)

    // Enrich members with avatar
    const userIds = (m || []).filter((r) => r.user_id).map((r) => r.user_id)
    let profileMap = {}
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, avatar_url').in('id', userIds)
      profileMap = Object.fromEntries((profs || []).map((p) => [p.id, p]))
    }
    setMembers((m || []).map((r) => ({ ...r, avatar_url: profileMap[r.user_id]?.avatar_url || null })))
    setLogs(lg || [])
    setFundTxns(ft || [])
    setShuttleTxns(st || [])
    setCollections(cols || [])
    setMemberPayments(mpr || [])
    setPayosConfig(pc === true ? true : null)

    // Cross-query membership_cycle tally — SSOT for committedCount + committedUserIds
    const { data: v } = await supabase
      .from('votes')
      .select('id, cycle_period_start, cycle_period_end')
      .eq('club_id', clubId)
      .eq('vote_type', 'membership_cycle')
      .order('created_at', { ascending: false })
      .limit(1)
    if (v && v.length) {
      const { data: rs } = await supabase
        .from('responses')
        .select('attending, guests, anonymous_user_id')
        .eq('vote_id', v[0].id)
        .order('created_at', { ascending: true })
      setPollTally(buildPollTally(v[0], rs, m || []))
    } else {
      setPollTally(null)
    }
    setLoading(false)
  }, [clubId])

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    loadAll()
    const ch = supabase
      .channel(`club-${clubId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_settings', filter: `club_id=eq.${clubId}` }, fetchSettings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'court_slots', filter: `club_id=eq.${clubId}` }, fetchSlots)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_members', filter: `club_id=eq.${clubId}` }, fetchMembers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs', filter: `club_id=eq.${clubId}` }, fetchLogs)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_transactions', filter: `club_id=eq.${clubId}` }, fetchFundTxns)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shuttle_transactions', filter: `club_id=eq.${clubId}` }, fetchShuttleTxns)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_collections', filter: `club_id=eq.${clubId}` }, fetchCollections)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_payment_records', filter: `club_id=eq.${clubId}` }, fetchMemberPayments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `club_id=eq.${clubId}` }, fetchPollTally)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, fetchPollTally)
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [clubId, loadAll, fetchSettings, fetchSlots, fetchMembers, fetchLogs, fetchFundTxns, fetchShuttleTxns, fetchCollections, fetchMemberPayments, fetchPollTally])

  return {
    settings,
    setSettings,
    slots,
    setSlots,
    members,
    logs,
    fundTxns,
    shuttleTxns,
    collections,
    memberPayments,
    payosConfig,
    pollTally,
    loading,
    reload: loadAll,
  }
}
