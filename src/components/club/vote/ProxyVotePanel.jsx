import { useState } from 'react'
import { Check, X, ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { cx } from '../../../lib/utils'

/**
 * Minimal "vote on behalf" panel.
 * Shows members who haven't voted yet — each row has Có / Không buttons.
 * Members who already voted show their answer (read-only, dimmed).
 */
export function ProxyVotePanel({ vote, members, responses, userId, toast, onChanged }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(null) // memberId being saved

  // Build response map: member_id → response
  const responseByMemberId = Object.fromEntries(responses.map((r) => [r.anonymous_user_id, r]))

  // Only show members that have a user_id (linked accounts)
  // exclude myself — I vote via VotePanel
  // unvoted members first
  const otherMembers = (members || [])
    .filter((m) => m.user_id && m.user_id !== userId)
    .sort((a, b) => {
      const aVoted = responseByMemberId[a.user_id] != null
      const bVoted = responseByMemberId[b.user_id] != null
      return aVoted - bVoted
    })

  const unvotedCount = otherMembers.filter((m) => !responseByMemberId[m.user_id]).length

  async function proxyVote(member, attending) {
    setSaving(member.user_id)
    try {
      const { error } = await supabase.from('responses').upsert(
        {
          vote_id: vote.id,
          anonymous_user_id: member.user_id,
          name: member.name,
          attending,
          guests: 0,
          guest_male_count: 0,
          guest_female_count: 0,
          member_id: member.user_id,
          proxy_by: userId,
        },
        { onConflict: 'vote_id,anonymous_user_id' }
      )
      if (error) throw error
      onChanged()
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setSaving(null)
    }
  }

  if (!otherMembers.length) return null

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-xl overflow-hidden">
      {/* Header — always visible, toggles collapse */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
      >
        <Users className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1 text-sm font-semibold text-slate-700">{t('proxy_vote_title')}</span>
        {unvotedCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
            {unvotedCount} {t('proxy_vote_pending')}
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {/* Member list */}
      {open && (
        <ul className="border-t border-slate-100 divide-y divide-slate-50">
          {otherMembers.map((m) => {
            const res = responseByMemberId[m.user_id]
            const isSaving = saving === m.user_id
            const voted = res != null

            return (
              <li key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                {/* Avatar initial */}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                  {m.name?.[0]?.toUpperCase() || '?'}
                </span>

                {/* Name */}
                <span className={cx('flex-1 text-sm font-medium truncate', voted ? 'text-slate-400' : 'text-slate-700')}>
                  {m.name}
                </span>

                {/* State */}
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : voted ? (
                  // Already voted — show badge, allow changing
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cx(
                        'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold',
                        res.attending ? 'bg-lime-50 text-lime-700' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {res.attending ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                      {res.attending ? t('vote_yes') : t('vote_no')}
                      {res.proxy_by && <span className="ml-0.5 opacity-60">·{t('proxy_vote_tag')}</span>}
                    </span>
                    {/* Allow flipping */}
                    <button
                      onClick={() => proxyVote(m, !res.attending)}
                      className="grid h-6 w-6 place-items-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition"
                      title={t('proxy_vote_change')}
                    >
                      {res.attending ? <X className="h-3 w-3" strokeWidth={3} /> : <Check className="h-3 w-3" strokeWidth={3} />}
                    </button>
                  </div>
                ) : (
                  // Not voted yet
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => proxyVote(m, true)}
                      className="flex items-center gap-1 rounded-lg border border-lime-200 bg-lime-50 px-2.5 py-1.5 text-xs font-semibold text-lime-700 hover:bg-lime-100 transition active:scale-95"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} /> {t('vote_yes')}
                    </button>
                    <button
                      onClick={() => proxyVote(m, false)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95"
                    >
                      <X className="h-3 w-3" strokeWidth={3} /> {t('vote_no')}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
