import { useState, useEffect, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { DEFAULT_SETTINGS } from '../constants'

export function useClubData(clubId) {
  const [settings, setSettings] = useState(null)
  const [members, setMembers] = useState([])
  const [logs, setLogs] = useState([])
  const [fundTxns, setFundTxns] = useState([])
  const [pollTally, setPollTally] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    if (!clubId) return
    const [{ data: s }, { data: m }, { data: lg }, { data: ft }] = await Promise.all([
      supabase.from('club_settings').select('*').eq('club_id', clubId).maybeSingle(),
      supabase.from('club_members').select('*').eq('club_id', clubId).order('created_at', { ascending: true }),
      supabase.from('session_logs').select('*').eq('club_id', clubId).order('played_on', { ascending: false }),
      supabase.from('fund_transactions').select('*').eq('club_id', clubId).order('created_at', { ascending: false }),
    ])

    setSettings(s ? { ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null)) } : { club_id: clubId, ...DEFAULT_SETTINGS })

    // Enrich members with avatar from profiles (only for members who joined via OAuth)
    const userIds = (m || []).filter((r) => r.user_id).map((r) => r.user_id)
    let profileMap = {}
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('profiles').select('id, avatar_url').in('id', userIds)
      profileMap = Object.fromEntries((profs || []).map((p) => [p.id, p]))
    }
    setMembers((m || []).map((r) => ({ ...r, avatar_url: profileMap[r.user_id]?.avatar_url || null })))
    setLogs(lg || [])
    setFundTxns(ft || [])

    // Cross-query PollTap membership_cycle tally
    const { data: v } = await supabase
      .from('votes').select('id').eq('club_id', clubId).eq('vote_type', 'membership_cycle')
      .order('created_at', { ascending: false }).limit(1)
    if (v && v.length) {
      const { data: rs } = await supabase
        .from('responses').select('attending,guests').eq('vote_id', v[0].id).eq('attending', true)
      const count = (rs || []).reduce((sum, r) => sum + 1 + (r.guests || 0), 0)
      setPollTally({ count, source: 'poll' })
    } else {
      setPollTally(null)
    }
    setLoading(false)
  }, [clubId])

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    loadAll()
    const ch = supabase
      .channel(`club-${clubId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_settings', filter: `club_id=eq.${clubId}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_members', filter: `club_id=eq.${clubId}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs', filter: `club_id=eq.${clubId}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_transactions', filter: `club_id=eq.${clubId}` }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [clubId, loadAll])

  return { settings, setSettings, members, logs, fundTxns, pollTally, loading, reload: loadAll }
}
