import { useState } from 'react'
import { Check, X, ChevronDown, ChevronUp, Loader2, Users, Pin, PinOff, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { cx } from '../../../lib/utils'

// Stable anonymous ID: Google user_id if linked, otherwise club_members.id
const aid = (m) => m.user_id || m.id

function MemberRow({ m, mId, isFixed, res, saving, savingAll, togglingPin, canEdit, onVote, onTogglePin, t }) {
  const isSaving = saving === mId || (savingAll && isFixed && !res)
  const voted = res != null

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span
        className={cx(
          'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold',
          isFixed ? 'bg-lime-100 text-lime-700' : 'bg-slate-100 text-slate-500'
        )}
      >
        {m.name?.[0]?.toUpperCase() || '?'}
      </span>

      <span className={cx('flex-1 truncate text-sm font-medium', voted ? 'text-slate-400' : 'text-slate-700')}>
        {m.name}
      </span>

      {isSaving ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : voted ? (
        <div className="flex items-center gap-1.5">
          <span
            className={cx(
              'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold',
              res.attending ? 'bg-lime-50 text-lime-700' : 'bg-slate-100 text-slate-500'
            )}
          >
            {res.attending ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
            {res.attending ? t('vote_yes') : t('vote_no')}
          </span>
          <button
            onClick={() => onVote(m, !res.attending)}
            className="grid h-6 w-6 place-items-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
            title={t('proxy_vote_change')}
          >
            {res.attending ? <X className="h-3 w-3" strokeWidth={3} /> : <Check className="h-3 w-3" strokeWidth={3} />}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onVote(m, true)}
            className="flex items-center gap-1 rounded-lg border border-lime-200 bg-lime-50 px-2.5 py-1.5 text-xs font-semibold text-lime-700 transition hover:bg-lime-100 active:scale-95"
          >
            <Check className="h-3 w-3" strokeWidth={3} /> {t('vote_yes')}
          </button>
          <button
            onClick={() => onVote(m, false)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95"
          >
            <X className="h-3 w-3" strokeWidth={3} /> {t('vote_no')}
          </button>
        </div>
      )}

      {canEdit && (
        <button
          onClick={() => onTogglePin(m)}
          disabled={togglingPin === mId}
          className={cx(
            'grid h-6 w-6 shrink-0 place-items-center rounded-lg transition',
            isFixed
              ? 'text-lime-400 hover:bg-lime-50 hover:text-lime-600'
              : 'text-slate-300 hover:bg-lime-50 hover:text-lime-500'
          )}
          title={isFixed ? t('proxy_fixed_remove') : t('proxy_fixed_set')}
        >
          {togglingPin === mId ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isFixed ? (
            <PinOff className="h-3 w-3" />
          ) : (
            <Pin className="h-3 w-3" />
          )}
        </button>
      )}
    </li>
  )
}

export function ProxyVotePanel({ vote, members, responses, userId, canEdit, toast, onChanged }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(null)
  const [togglingPin, setTogglingPin] = useState(null)

  const [pinnedSet, setPinnedSet] = useState(
    () => new Set((members || []).filter((m) => m.proxy_delegate).map(aid))
  )

  const responseMap = Object.fromEntries(responses.map((r) => [r.anonymous_user_id, r]))

  // All members except the current user — includes manually-added (user_id = null)
  const others = (members || []).filter((m) => aid(m) !== userId)

  const fixedMembers = others.filter((m) => pinnedSet.has(aid(m)))
  const regularMembers = others
    .filter((m) => !pinnedSet.has(aid(m)))
    .sort((a, b) => (responseMap[aid(a)] != null) - (responseMap[aid(b)] != null))

  const unvotedFixed = fixedMembers.filter((m) => !responseMap[aid(m)])
  const totalUnvoted = others.filter((m) => !responseMap[aid(m)]).length

  async function proxyVote(member, attending) {
    const mId = aid(member)
    setSaving(mId)
    try {
      const { error } = await supabase.from('responses').upsert(
        {
          vote_id: vote.id,
          anonymous_user_id: mId,
          name: member.name,
          attending,
          guests: 0,
          guest_male_count: 0,
          guest_female_count: 0,
          member_id: member.user_id || null,
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

  async function voteAllFixed() {
    if (!unvotedFixed.length) return
    setSaving('__all_fixed__')
    try {
      const results = await Promise.all(
        unvotedFixed.map((m) =>
          supabase.from('responses').upsert(
            {
              vote_id: vote.id,
              anonymous_user_id: aid(m),
              name: m.name,
              attending: true,
              guests: 0,
              guest_male_count: 0,
              guest_female_count: 0,
              member_id: aid(m),
            },
            { onConflict: 'vote_id,anonymous_user_id' }
          )
        )
      )
      const err = results.find((r) => r.error)
      if (err) throw err.error
      onChanged()
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setSaving(null)
    }
  }

  async function togglePin(member) {
    const mId = aid(member)
    const newVal = !pinnedSet.has(mId)
    setPinnedSet((prev) => {
      const next = new Set(prev)
      newVal ? next.add(mId) : next.delete(mId)
      return next
    })
    setTogglingPin(mId)
    try {
      const { error } = await supabase
        .from('club_members')
        .update({ proxy_delegate: newVal })
        .eq('id', member.id)
      if (error) throw error
    } catch (e) {
      setPinnedSet((prev) => {
        const next = new Set(prev)
        newVal ? next.delete(mId) : next.add(mId)
        return next
      })
      toast(e.message || t('err_generic'))
    } finally {
      setTogglingPin(null)
    }
  }

  if (!others.length) return null

  const savingAll = saving === '__all_fixed__'
  const showFixedSection = canEdit && fixedMembers.length > 0

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <Users className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1 text-sm font-semibold text-slate-700">{t('proxy_vote_title')}</span>
        {totalUnvoted > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
            {totalUnvoted} {t('proxy_vote_pending')}
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {showFixedSection && (
            <div>
              <div className="flex items-center justify-between bg-lime-50 px-5 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-lime-700">
                  <Pin className="h-3 w-3" /> {t('proxy_fixed_section')}
                </span>
                {unvotedFixed.length > 0 && (
                  <button
                    onClick={voteAllFixed}
                    disabled={savingAll}
                    className="flex items-center gap-1 rounded-lg bg-lime-500 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-lime-600 active:scale-95 disabled:opacity-50"
                  >
                    {savingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                    {t('proxy_fixed_vote_all')}
                  </button>
                )}
              </div>
              <ul className="divide-y divide-slate-50">
                {fixedMembers.map((m) => (
                  <MemberRow
                    key={aid(m)}
                    m={m}
                    mId={aid(m)}
                    isFixed
                    res={responseMap[aid(m)]}
                    saving={saving}
                    savingAll={savingAll}
                    togglingPin={togglingPin}
                    canEdit={canEdit}
                    onVote={proxyVote}
                    onTogglePin={togglePin}
                    t={t}
                  />
                ))}
              </ul>
            </div>
          )}

          {regularMembers.length > 0 && (
            <div className={cx(showFixedSection && 'border-t border-slate-100')}>
              {showFixedSection && (
                <div className="px-5 py-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {t('proxy_vote_title')}
                  </span>
                </div>
              )}
              <ul className="divide-y divide-slate-50">
                {regularMembers.map((m) => (
                  <MemberRow
                    key={aid(m)}
                    m={m}
                    mId={aid(m)}
                    isFixed={false}
                    res={responseMap[aid(m)]}
                    saving={saving}
                    savingAll={false}
                    togglingPin={togglingPin}
                    canEdit={canEdit}
                    onVote={proxyVote}
                    onTogglePin={togglePin}
                    t={t}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
