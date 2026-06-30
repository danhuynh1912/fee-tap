import { useState } from 'react'
import { Check, X, Users2, Loader2, Lock, UserPlus, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCycleVote } from '../../../hooks/useCycleVote'
import { useCountdown } from '../../../hooks/useCountdown'
import { nextCyclePeriod, formatPeriodLabel, computeMembershipVoteCycle } from '../../../engine/forecast'
import { cx, fmtVND } from '../../../lib/utils'
import { supabase } from '../../../lib/supabase'

// ── Compact member avatar with vote status ────────────────────────────────────
function MemberDot({ member, attending }) {
  const base = 'relative h-8 w-8 rounded-full shrink-0'
  return (
    <div className="relative shrink-0">
      {member.avatar_url ? (
        <img src={member.avatar_url} alt={member.name} title={member.name} className={cx(base, 'object-cover', attending == null && 'opacity-40')} />
      ) : (
        <div
          title={member.name}
          className={cx(base, 'grid place-items-center bg-slate-700', attending == null && 'opacity-40')}
        >
          <span className="text-[10px] font-black text-lime-400">{member.name[0]?.toUpperCase()}</span>
        </div>
      )}
      {attending === true && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-lime-400">
          <Check className="h-2.5 w-2.5 text-slate-900" strokeWidth={3} />
        </span>
      )}
      {attending === false && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-slate-600">
          <X className="h-2.5 w-2.5 text-slate-300" strokeWidth={3} />
        </span>
      )}
    </div>
  )
}

// ── My vote quick buttons ─────────────────────────────────────────────────────
function MyVoteButtons({ vote, myResponse, userId, userName, toast, onChanged }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const attending = myResponse ? myResponse.attending : null

  async function choose(yes) {
    if (!userId || saving || attending === yes) return
    setSaving(true)
    try {
      const { error } = await supabase.from('responses').upsert(
        { vote_id: vote.id, anonymous_user_id: userId, name: userName, attending: yes, guests: 0, guest_male_count: 0, guest_female_count: 0 },
        { onConflict: 'vote_id,anonymous_user_id' }
      )
      if (error) throw error
      onChanged()
    } catch (e) {
      toast?.(e.message || t('err_generic'))
    } finally {
      setSaving(false)
    }
  }

  if (!userId) return null

  return (
    <div className="flex gap-2">
      <button
        onClick={() => choose(true)}
        disabled={saving}
        className={cx(
          'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50',
          attending === true
            ? 'border-white/30 bg-white/10 text-white'
            : 'border-slate-600 text-slate-300 hover:border-white hover:text-white'
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
        {t('vote_yes')}
      </button>
      <button
        onClick={() => choose(false)}
        disabled={saving}
        className={cx(
          'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50',
          attending === false
            ? 'border-slate-400 bg-slate-600 text-white'
            : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
        )}
      >
        <X className="h-3.5 w-3.5" strokeWidth={3} />
        {t('vote_no')}
      </button>
    </div>
  )
}

// ── Main inline component ─────────────────────────────────────────────────────
export function CycleVoteInline({ club, members, settings, slots, canEdit, user, guestRecruitment }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { vote, responses, loading, reload } = useCycleVote(club.id)
  const countdown = useCountdown(vote?.deadline)
  const closed = !!vote && (vote.is_closed || countdown.closed)
  const [creating, setCreating] = useState(false)
  const [guestOpen, setGuestOpen] = useState(false)

  const { minMonths } = computeMembershipVoteCycle(slots, settings)
  const fixedCycleMonths = settings?.fixed_cycle_months ?? minMonths

  const myResponse = responses.find((r) => r.anonymous_user_id === user?.id)
  const userName = user?.user_metadata?.full_name || user?.email || ''

  const responseMap = Object.fromEntries(responses.map((r) => [r.anonymous_user_id, r]))
  const committedCount = responses.filter((r) => r.attending).length

  async function createVote() {
    if (creating) return
    setCreating(true)
    try {
      const cyclePeriod = nextCyclePeriod(fixedCycleMonths)
      const periodLabel = formatPeriodLabel(cyclePeriod.period, lang)
      const now = new Date()
      const deadline = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 0)
      const { error } = await supabase.from('votes').insert({
        club_id: club.id,
        title: `${t('cycle_vote_title_prefix')} ${periodLabel}`,
        vote_type: 'membership_cycle',
        deadline: deadline.toISOString(),
        max_slots: members.length,
        is_closed: false,
        cycle_period_start: cyclePeriod.start,
        cycle_period_end: cyclePeriod.end,
      })
      if (error) throw error
      reload()
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  if (loading) return null

  // ── No vote: host sees create button, members see nothing ──
  if (!vote) {
    if (!canEdit) return null
    return (
      <div className="border-t border-slate-700 bg-slate-900 px-5 py-3">
        <button
          onClick={createVote}
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-600 py-2 text-xs font-semibold text-slate-300 transition hover:border-lime-400 hover:text-lime-400 active:scale-[0.98] disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users2 className="h-3.5 w-3.5" />}
          {t('open_cycle_vote')}
        </button>
      </div>
    )
  }

  // ── Vote exists: show minimal inline panel ──
  return (
    <div className="border-t border-slate-700 bg-slate-900 px-5 pt-3 pb-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users2 className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-300">{t('cycle_vote_committed_title')}</span>
          {closed && <Lock className="h-3 w-3 text-slate-500" />}
        </div>
        <span className="text-xs font-semibold text-white">
          {committedCount}/{members.length}
        </span>
      </div>

      {/* Member avatar dots */}
      {members.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => {
            const r = responseMap[m.user_id] ?? responseMap[m.id] ?? null
            return <MemberDot key={m.id} member={m} attending={r ? r.attending : null} />
          })}
        </div>
      )}

      {/* My vote buttons — only when vote is open */}
      {!closed && (
        <MyVoteButtons
          vote={vote}
          myResponse={myResponse}
          userId={user?.id}
          userName={userName}
          onChanged={reload}
        />
      )}

      {closed && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Lock className="h-3 w-3" />
          {t('vote_closed_label')}
        </div>
      )}

      {/* Guest recruitment — collapsible, closed by default */}
      {guestRecruitment && (
        <div className="border-t border-slate-800 pt-2 -mx-5 px-5">
          <button
            onClick={() => setGuestOpen((v) => !v)}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <UserPlus className="h-3 w-3 text-slate-600 shrink-0" />
            <span className="text-[11px] text-slate-600 flex-1">{t('guest_recruit_title')}</span>
            <ChevronDown className={cx('h-3 w-3 text-slate-600 transition-transform', guestOpen && 'rotate-180')} />
          </button>
          {guestOpen && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {guestRecruitment.combinations.length === 0 ? (
                <span className="text-[11px] text-red-400 italic">{t('guest_recruit_impossible')}</span>
              ) : (
                <>
                  {guestRecruitment.combinations.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      <span className="bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        {c.genderless
                          ? t('guest_recruit_n_total', { n: c.total })
                          : [
                              c.males > 0 && t('guest_recruit_males', { n: c.males }),
                              c.females > 0 && t('guest_recruit_females', { n: c.females }),
                            ].filter(Boolean).join(' + ')}
                      </span>
                      {i < guestRecruitment.combinations.length - 1 && (
                        <span className="text-[10px] text-slate-600">{t('guest_recruit_or')}</span>
                      )}
                    </span>
                  ))}
                  <span className="text-[10px] text-slate-600 font-mono ml-auto">
                    {t('guest_recruit_shortfall', { amount: fmtVND(Math.ceil(guestRecruitment.perSessionShortfall)) })}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
