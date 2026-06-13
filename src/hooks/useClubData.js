import { useState, useEffect, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { DEFAULT_SETTINGS } from '../constants'
import { synthesizeSlotsFromLegacy } from '../engine/forecast'

export function useClubData(clubId) {
  const [settings, setSettings] = useState(null)
  const [slots, setSlots] = useState([])
  const [members, setMembers] = useState([])
  const [logs, setLogs] = useState([])
  const [fundTxns, setFundTxns] = useState([])
  const [collections, setCollections] = useState([])
  const [memberPayments, setMemberPayments] = useState([])
  const [payosConfig, setPayosConfig] = useState(null)
  const [pollTally, setPollTally] = useState(null)
  const [loading, setLoading] = useState(true)

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

  const fetchCollections = useCallback(async () => {
    const { data: cols } = await supabase.from('payment_collections').select('*').eq('club_id', clubId).order('period_start', { ascending: false })
    setCollections(cols || [])
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
    const [{ data: s }, { data: sl }, { data: m }, { data: lg }, { data: ft }, { data: cols }, { data: mpr }, { data: pc }] = await Promise.all([
      supabase.from('club_settings').select('*').eq('club_id', clubId).maybeSingle(),
      supabase.from('court_slots').select('*').eq('club_id', clubId).order('sort_order'),
      supabase.from('club_members').select('*').eq('club_id', clubId).order('created_at', { ascending: true }),
      supabase.from('session_logs').select('*').eq('club_id', clubId).order('played_on', { ascending: false }),
      supabase.from('fund_transactions').select('*').eq('club_id', clubId).order('created_at', { ascending: false }),
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
    setCollections(cols || [])
    setMemberPayments(mpr || [])
    setPayosConfig(pc === true ? true : null)

    // Cross-query PollTap membership_cycle tally
    const { data: v } = await supabase
      .from('votes')
      .select('id')
      .eq('club_id', clubId)
      .eq('vote_type', 'membership_cycle')
      .order('created_at', { ascending: false })
      .limit(1)
    if (v && v.length) {
      const { data: rs } = await supabase.from('responses').select('attending,guests').eq('vote_id', v[0].id).eq('attending', true)
      const count = (rs || []).reduce((sum, r) => sum + 1 + (r.guests || 0), 0)
      setPollTally({ count, source: 'poll' })
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_collections', filter: `club_id=eq.${clubId}` }, fetchCollections)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_payment_records', filter: `club_id=eq.${clubId}` }, fetchMemberPayments)
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [clubId, loadAll, fetchSettings, fetchSlots, fetchMembers, fetchLogs, fetchFundTxns, fetchCollections, fetchMemberPayments])

  return {
    settings,
    setSettings,
    slots,
    setSlots,
    members,
    logs,
    fundTxns,
    collections,
    memberPayments,
    payosConfig,
    pollTally,
    loading,
    reload: loadAll,
  }
}
