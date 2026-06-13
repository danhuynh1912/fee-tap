import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useNextVote(clubId) {
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

    const now = new Date().toISOString()
    const { data: votes } = await supabase
      .from('votes')
      .select('*')
      .eq('club_id', clubId)
      .gte('match_date', now)
      .order('match_date', { ascending: true })
      .limit(1)

    const nextVote = votes?.[0] ?? null
    setVote(nextVote)

    if (nextVote) {
      const { data: r } = await supabase.from('responses').select('*').eq('vote_id', nextVote.id).order('created_at', { ascending: true })
      setResponses(r || [])
    } else {
      setResponses([])
    }

    setLoading(false)
  }, [clubId])

  useEffect(() => {
    if (!clubId) return
    setLoading(true)
    fetchData()
  }, [clubId, fetchData])

  // Subscribe realtime once we have a vote id
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (!vote?.id) return

    const ch = supabase
      .channel(`next-vote-${vote.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'responses',
          filter: `vote_id=eq.${vote.id}`,
        },
        fetchData
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `id=eq.${vote.id}`,
        },
        fetchData
      )
      .subscribe()

    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [vote?.id, fetchData])

  return { vote, responses, loading, reload: fetchData }
}
