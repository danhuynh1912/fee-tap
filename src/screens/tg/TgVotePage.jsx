import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cx } from '../../lib/utils'

// ─── Telegram WebApp SDK helper ──────────────────────────────────────────────
const tg = window.Telegram?.WebApp
const tgUser = tg?.initDataUnsafe?.user   // { id, first_name, last_name, username }

function getTgAnonId(voteId) {
  // Deterministic anonymous_user_id from tg user + vote (so upsert works)
  if (tgUser?.id) {
    const raw = `tg:${tgUser.id}:${voteId}`
    // Encode into UUID-shaped string (16 hex bytes)
    let hash = 0
    for (let i = 0; i < raw.length; i++) hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0
    const h = Math.abs(hash).toString(16).padStart(8, '0')
    const id2 = String(tgUser.id).padStart(12, '0').slice(-12)
    return `${h}-0000-4000-8000-${id2}`
  }
  // Fallback: per-device localStorage
  const key = `tg_anon_${voteId}`
  let id = localStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }
  return id
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}
function fmtDeadline(iso) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function TgVotePage({ voteId }) {
  const [vote, setVote]         = useState(null)
  const [club, setClub]         = useState(null)
  const [members, setMembers]   = useState([])
  const [responses, setResponses] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [guests, setGuests]         = useState(0)
  const [myResponse, setMyResponse] = useState(null)   // 'yes' | 'no' | null
  const [myGuests, setMyGuests]     = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]         = useState(false)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const anonId = useRef(getTgAnonId(voteId))

  // Expand Telegram viewport
  useEffect(() => { tg?.expand() }, [])

  // Load data
  useEffect(() => {
    if (!voteId) return
    load()
  }, [voteId])

  async function load() {
    setLoading(true)
    try {
      // Vote row
      const { data: v, error: ve } = await supabase
        .from('votes')
        .select('id, club_id, title, match_date, deadline, is_closed, max_slots')
        .eq('id', voteId)
        .single()
      if (ve) throw ve
      setVote(v)

      // Club + members + responses in parallel
      const [{ data: c }, { data: m }, { data: r }] = await Promise.all([
        supabase.from('clubs').select('name, sport_type').eq('id', v.club_id).single(),
        supabase.from('club_members').select('id, name').eq('club_id', v.club_id).order('name'),
        supabase.from('responses').select('anonymous_user_id, name, attending').eq('vote_id', voteId),
      ])

      setClub(c)
      setMembers(m ?? [])
      setResponses(r ?? [])

      // Check if this device already voted
      const mine = (r ?? []).find(x => x.anonymous_user_id === anonId.current)
      if (mine) {
        setMyResponse(mine.attending ? 'yes' : 'no')
        setMyGuests(mine.guests ?? 0)
        setDone(true)
      }

      // Try auto-select member linked to this telegram_id
      if (tgUser?.id) {
        const { data: linked } = await supabase.rpc('resolve_telegram_member', {
          p_telegram_id: tgUser.id,
          p_club_id: v.club_id,
        })
        if (linked?.[0]) setSelectedId(linked[0].member_id)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitVote(attending) {
    if (!selectedId) return
    const member = members.find(m => m.id === selectedId)
    if (!member) return

    setSubmitting(true)
    try {
      const guestCount = attending ? guests : 0
      const { error } = await supabase.from('responses').upsert({
        vote_id:           voteId,
        anonymous_user_id: anonId.current,
        name:              member.name,
        attending,
        guests:            guestCount,
        voted_via:         'telegram',
      }, { onConflict: 'vote_id,anonymous_user_id' })
      if (error) throw error

      setMyResponse(attending ? 'yes' : 'no')
      setMyGuests(guestCount)
      setDone(true)
      // Refresh responses
      const { data: r } = await supabase
        .from('responses').select('anonymous_user_id, name, attending, guests').eq('vote_id', voteId)
      setResponses(r ?? [])

      // Close mini app after short delay
      setTimeout(() => tg?.close(), 1500)
    } catch (e) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render states ──
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <p className="text-center text-sm text-red-500">{error}</p>
    </div>
  )

  const attending = responses.filter(r => r.attending)
  const notAttending = responses.filter(r => !r.attending)
  const totalAttending = attending.reduce((sum, r) => sum + 1 + (r.guests ?? 0), 0)
  const isClosed = vote.is_closed || new Date() > new Date(vote.deadline)
  const sport = club?.sport_type === 'football' ? '⚽' : '🏸'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Header ── */}
      <div className="bg-slate-900 px-5 pt-8 pb-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">{club?.name}</p>
        <h1 className="text-xl font-black text-white leading-tight">{vote.title}</h1>

        <div className="mt-4 flex flex-col gap-1.5 text-sm text-slate-400">
          {vote.match_date && (
            <div className="flex items-center gap-2">
              <span>{sport}</span>
              <span className="text-white font-medium">{fmtDate(vote.match_date)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span>⏰</span>
            <span>Deadline: <span className={cx(isClosed ? 'text-red-400' : 'text-slate-300')}>{fmtDeadline(vote.deadline)}</span></span>
          </div>
        </div>

        {/* Tally bar */}
        <div className="mt-5 flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-bold text-lime-400">
            <CheckCircle2 className="h-4 w-4" /> {totalAttending} tham gia
          </span>
          <span className="text-slate-600">·</span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <XCircle className="h-4 w-4" /> {notAttending.length} vắng
          </span>
          {vote.max_slots > 0 && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-500">Tối đa {vote.max_slots}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-5 py-6 space-y-5">

        {isClosed ? (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-slate-500">Vote đã đóng</p>
          </div>
        ) : done ? (
          /* ── Voted state ── */
          <div className={cx(
            'rounded-2xl border px-4 py-5 text-center animate-fade-in',
            myResponse === 'yes'
              ? 'bg-lime-50 border-lime-200'
              : 'bg-red-50 border-red-200'
          )}>
            {myResponse === 'yes'
              ? <CheckCircle2 className="h-8 w-8 text-lime-500 mx-auto mb-2" />
              : <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            }
            <p className="font-bold text-slate-800">
              {myResponse === 'yes'
                ? `✅ Tham gia${myGuests > 0 ? ` (+${myGuests} khách)` : '!'}`
                : '❌ Bạn đã báo vắng'}
            </p>
            <button
              className="mt-3 text-xs text-slate-400 underline"
              onClick={() => { setDone(false); setMyResponse(null) }}
            >
              Đổi câu trả lời
            </button>
          </div>
        ) : (
          /* ── Vote form ── */
          <div className="space-y-4 animate-fade-in">
            {/* Member select */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                Bạn là ai?
              </label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 transition"
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
              >
                <option value="">— Chọn tên của bạn —</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Guests input — chỉ hiện khi đã chọn tên */}
            {selectedId && (
              <div className="animate-fade-in">
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                  Dẫn theo khách? (tuỳ chọn)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 text-lg font-bold flex items-center justify-center active:scale-95 transition"
                    onClick={() => setGuests(g => Math.max(0, g - 1))}
                  >−</button>
                  <span className="text-lg font-bold text-slate-800 w-8 text-center">{guests}</span>
                  <button
                    className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 text-lg font-bold flex items-center justify-center active:scale-95 transition"
                    onClick={() => setGuests(g => g + 1)}
                  >+</button>
                  <span className="text-sm text-slate-400">người</span>
                </div>
              </div>
            )}

            {/* Yes / No buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                disabled={!selectedId || submitting}
                onClick={() => submitVote(true)}
                className={cx(
                  'flex flex-col items-center justify-center gap-2 rounded-2xl py-5 font-bold text-slate-900 transition active:scale-[0.97]',
                  'bg-lime-400 hover:bg-lime-300 disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <span className="text-2xl">✅</span>}
                <span className="text-base">Tham gia</span>
              </button>
              <button
                disabled={!selectedId || submitting}
                onClick={() => submitVote(false)}
                className={cx(
                  'flex flex-col items-center justify-center gap-2 rounded-2xl py-5 font-bold text-white transition active:scale-[0.97]',
                  'bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <span className="text-2xl">❌</span>}
                <span className="text-base">Vắng</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Response list ── */}
        {responses.length > 0 && (
          <div className="space-y-3 pt-2">
            {attending.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Tham gia ({attending.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {attending.map(r => (
                    <span key={r.anonymous_user_id} className="rounded-full bg-lime-50 border border-lime-200 px-3 py-1 text-xs font-semibold text-lime-700">
                      {r.name}{r.guests > 0 ? ` +${r.guests}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {notAttending.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Vắng ({notAttending.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {notAttending.map(r => (
                    <span key={r.anonymous_user_id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                      {r.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
