import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useCycleVote(clubId, periodStart) {
  const [vote, setVote] = useState(undefined) // undefined = loading, null = no vote
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  const fetchData = useCallback(async () => {
    if (!clubId) {
      setVote(null)
      setLoading(false)
      return
    }

    let query = supabase
      .from('votes')
      .select('*')
      .eq('club_id', clubId)
      .eq('vote_type', 'membership_cycle')
      .order('created_at', { ascending: false })
      .limit(1)

    if (periodStart) {
      query = query.eq('cycle_period_start', periodStart)
    }

    const { data: votes } = await query
    const latestVote = votes?.[0] ?? null
    setVote(latestVote)

    if (latestVote) {
      const { data: r } = await supabase
        .from('responses')
        .select('*')
        .eq('vote_id', latestVote.id)
        .order('created_at', { ascending: true })
      setResponses(r || [])
    } else {
      setResponses([])
    }

    setLoading(false)
  }, [clubId, periodStart])

  useEffect(() => {
    if (!clubId) return
    setLoading(true)
    fetchData()
  }, [clubId, fetchData])

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (!vote?.id) return

    const ch = supabase
      .channel(`cycle-vote-${vote.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses', filter: `vote_id=eq.${vote.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `id=eq.${vote.id}` }, fetchData)
      .subscribe()

    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [vote?.id, fetchData])

  return { vote, responses, loading, reload: fetchData }
}
