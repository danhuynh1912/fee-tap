import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// "Current" vote = most recently created next-session vote, regardless of match_date —
// it only stops being votable once its own deadline passes, not when the session date arrives.
// The previous one (now superseded) is kept around so the UI can show it as a minimal recap card.
export function useNextVote(clubId) {
  const [vote, setVote] = useState(undefined) // undefined = loading, null = no vote
  const [previousVote, setPreviousVote] = useState(null)
  const [responses, setResponses] = useState([])
  const [previousCount, setPreviousCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  const fetchData = useCallback(async () => {
    if (!clubId) {
      setVote(null)
      setPreviousVote(null)
      setLoading(false)
      return
    }

    // vote_type is null for legacy next-session votes (never set on insert) — match
    // both null and the explicit 'next_session' value, but exclude membership_cycle votes.
    const { data: votes } = await supabase
      .from('votes')
      .select('*')
      .eq('club_id', clubId)
      .or('vote_type.is.null,vote_type.eq.next_session')
      .order('created_at', { ascending: false })
      .limit(2)

    const currentVote = votes?.[0] ?? null
    const prevVote = votes?.[1] ?? null
    setVote(currentVote)
    setPreviousVote(prevVote)

    if (currentVote) {
      const { data: r } = await supabase.from('responses').select('*').eq('vote_id', currentVote.id).order('created_at', { ascending: true })
      setResponses(r || [])
    } else {
      setResponses([])
    }

    if (prevVote) {
      const { count } = await supabase
        .from('responses')
        .select('*', { count: 'exact', head: true })
        .eq('vote_id', prevVote.id)
        .eq('attending', true)
      setPreviousCount(count || 0)
    } else {
      setPreviousCount(0)
    }

    setLoading(false)
  }, [clubId])

  useEffect(() => {
    if (!clubId) return
    setLoading(true)
    fetchData()
  }, [clubId, fetchData])

  // Subscribe club-wide — a new vote (promotion) or any response change should refresh
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (!clubId) return

    const ch = supabase
      .channel(`next-vote-${clubId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `club_id=eq.${clubId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, fetchData)
      .subscribe()

    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [clubId, fetchData])

  return { vote, previousVote, previousCount, responses, loading, reload: fetchData }
}
