import { useState, useEffect } from 'react'
import { Check, X, Plus, Minus, Shield, Lock, Loader2, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { cx } from '../../../lib/utils'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { Toggle } from '../../ui/Toggle'
import { inputCls } from '../../ui/Field'

// Identity is the authenticated FeeTap user — no localStorage needed.
// hideSlots: true for cycle votes (no slot counting, no guest section)
// pickerProps: optional { members, selectedId, onSelect } for public (unauthenticated) vote page
export function VotePanel({ vote, closed, filledSlots, myResponse, userId, userName, toast, onChanged, hideSlots = false, pickerProps }) {
  const { t } = useTranslation()
  const [attending, setAttending] = useState(myResponse ? myResponse.attending : null)
  const [withGuests, setWithGuests] = useState((myResponse?.guests || 0) > 0)
  const [guestMale, setGuestMale] = useState(myResponse?.guest_male_count || 0)
  const [guestFemale, setGuestFemale] = useState(myResponse?.guest_female_count || 0)
  const [saving, setSaving] = useState(false)
  // For unauthenticated members (edge-case guard)
  const [nameModal, setNameModal] = useState(false)
  const [guestName, setGuestName] = useState('')

  const guests = guestMale + guestFemale

  useEffect(() => {
    if (myResponse) {
      setAttending(myResponse.attending)
      const gm = myResponse.guest_male_count || 0
      const gf = myResponse.guest_female_count || 0
      setGuestMale(gm)
      setGuestFemale(gf)
      setWithGuests(gm + gf > 0)
    } else {
      setAttending(null)
      setGuestMale(0)
      setGuestFemale(0)
      setWithGuests(false)
    }
  }, [myResponse?.id, myResponse?.attending, myResponse?.guest_male_count, myResponse?.guest_female_count])

  const otherSlots = hideSlots ? 0 : filledSlots - (myResponse?.attending ? 1 + (myResponse.guests || 0) : 0)
  const remainingForMe = hideSlots ? 99 : (vote.max_slots || 0) - otherSlots
  const maxGuestsForMe = Math.max(0, remainingForMe - 1)
  const canAddGuest = guests < maxGuestsForMe

  async function persist(nextAttending, nextGuestMale, nextGuestFemale) {
    if (!userId) {
      setNameModal(true)
      return
    }
    setSaving(true)
    try {
      const totalGuests = nextAttending ? nextGuestMale + nextGuestFemale : 0
      const { error } = await supabase.from('responses').upsert(
        {
          vote_id: vote.id,
          anonymous_user_id: userId,
          name: userName,
          attending: nextAttending,
          guests: totalGuests,
          guest_male_count: nextAttending ? nextGuestMale : 0,
          guest_female_count: nextAttending ? nextGuestFemale : 0,
          member_id: userId,
        },
        { onConflict: 'vote_id,anonymous_user_id' }
      )
      if (error) throw error
      toast(nextAttending ? t('vote_saved_yes') : t('vote_saved_no'))
      onChanged()
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setSaving(false)
    }
  }

  function choose(yes) {
    if (closed) return
    setAttending(yes)
    if (!yes) {
      setWithGuests(false)
      setGuestMale(0)
      setGuestFemale(0)
      persist(false, 0, 0)
    } else {
      persist(true, withGuests ? guestMale : 0, withGuests ? guestFemale : 0)
    }
  }

  function adjustMale(delta) {
    const next = Math.max(0, Math.min(guestMale + delta, maxGuestsForMe - guestFemale))
    setGuestMale(next)
    persist(true, next, guestFemale)
  }
  function adjustFemale(delta) {
    const next = Math.max(0, Math.min(guestFemale + delta, maxGuestsForMe - guestMale))
    setGuestFemale(next)
    persist(true, guestMale, next)
  }

  const yesFull = !hideSlots && otherSlots >= (vote.max_slots || 0) && !myResponse?.attending

  if (closed) {
    return (
      <div className="rounded-3xl border border-slate-100 bg-white/80 p-7 text-center backdrop-blur-xl">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50">
          <Lock className="h-6 w-6 text-red-500" />
        </span>
        <h3 className="mt-4 text-lg font-bold text-slate-900">{t('vote_closed_title')}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {myResponse
            ? `${t('vote_your_answer')}: ${
                myResponse.attending
                  ? `${t('vote_attending')}${guests > 0 ? ` (+${guestMale}M +${guestFemale}F)` : ''}`
                  : t('vote_not_attending_answer')
              }.`
            : t('vote_closed_hint')}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-7 backdrop-blur-xl">
      <h3 className="text-lg font-bold text-slate-900">{hideSlots ? t('cycle_vote_register_q') : t('vote_will_you_play')}</h3>
      {!pickerProps && (
        <p className="mt-1 text-sm text-slate-500">
          {userName ? (
            <>{t('vote_voting_as')} <strong className="text-slate-700">{userName}</strong></>
          ) : (
            t('vote_no_identity')
          )}
        </p>
      )}

      {pickerProps && (
        <div className="mt-4 space-y-1">
          <label className="text-xs font-semibold text-slate-500">{t('vote_who_are_you')}</label>
          <div className="relative">
            <select
              value={pickerProps.selectedId}
              onChange={(e) => pickerProps.onSelect(e.target.value)}
              className={cx(
                'w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm font-semibold text-slate-900',
                'focus:border-lime-400 focus:outline-none focus:ring-0',
                !pickerProps.selectedId && 'text-slate-400'
              )}
            >
              <option value="">{t('vote_select_member')}</option>
              {pickerProps.members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => choose(true)}
          disabled={saving || yesFull || !userId}
          className={cx(
            'group flex items-center justify-center gap-2.5 rounded-2xl border-2 px-4 py-3 transition disabled:opacity-50',
            'sm:flex-col sm:items-start sm:p-5',
            attending === true ? 'border-lime-400 bg-lime-50' : 'border-slate-200 bg-white hover:border-slate-300'
          )}
        >
          <span
            className={cx(
              'grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10',
              attending === true ? 'bg-lime-400 text-slate-900' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
            )}
          >
            <Check className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={3} />
          </span>
          <p className="font-bold text-slate-900 sm:mt-3">{t('vote_yes')}</p>
          <p className="hidden sm:block text-xs text-slate-500">{yesFull ? t('vote_court_full') : t('vote_count_me_in')}</p>
        </button>

        <button
          onClick={() => choose(false)}
          disabled={saving || !userId}
          className={cx(
            'group flex items-center justify-center gap-2.5 rounded-2xl border-2 px-4 py-3 transition disabled:opacity-50',
            'sm:flex-col sm:items-start sm:p-5',
            attending === false ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white hover:border-slate-300'
          )}
        >
          <span
            className={cx(
              'grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10',
              attending === false ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
            )}
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={3} />
          </span>
          <p className={cx('font-bold sm:mt-3', attending === false ? 'text-white' : 'text-slate-900')}>{t('vote_no')}</p>
          <p className={cx('hidden sm:block text-xs', attending === false ? 'text-slate-300' : 'text-slate-500')}>{t('vote_cant_make_it')}</p>
        </button>
      </div>

      {attending === true && !hideSlots && (
        <div className="mt-5 animate-fade-in space-y-4">
          <Toggle
            checked={withGuests}
            label={t('vote_bring_guests')}
            onChange={(v) => {
              setWithGuests(v)
              if (!v) {
                setGuestMale(0)
                setGuestFemale(0)
                persist(true, 0, 0)
              }
            }}
          />

          {withGuests && (
            <div className="animate-fade-in rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>{t('vote_guests')}</span>
                <span>
                  {maxGuestsForMe - guests} slot{maxGuestsForMe - guests !== 1 ? 's' : ''} remaining
                </span>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">♂ {t('log_guest_male')}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => adjustMale(-1)}
                    disabled={guestMale <= 0 || saving}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-xl font-black tabular-nums text-slate-900">{guestMale}</span>
                  <button
                    onClick={() => adjustMale(1)}
                    disabled={!canAddGuest || saving}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-30"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">♀ {t('log_guest_female')}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => adjustFemale(-1)}
                    disabled={guestFemale <= 0 || saving}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-xl font-black tabular-nums text-slate-900">{guestFemale}</span>
                  <button
                    onClick={() => adjustFemale(1)}
                    disabled={!canAddGuest || saving}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-30"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {!canAddGuest && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Shield className="h-3.5 w-3.5" /> {t('vote_slot_limit_reached')}
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white">
            {t('vote_taking_slots_pre')} <span className="text-lime-400">{1 + guests}</span> {t('vote_taking_slots_post')}
            {guests > 0 && (
              <span className="ml-1 text-slate-400 text-xs">
                (+{guestMale}M +{guestFemale}F)
              </span>
            )}
          </div>
        </div>
      )}

      {saving && (
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('saving')}…
        </p>
      )}

      {/* Fallback modal if userId is somehow missing */}
      <Modal open={nameModal} onClose={() => setNameModal(false)}>
        <p className="text-sm text-slate-600">{t('vote_no_identity')}</p>
        <input
          autoFocus
          className={cx(inputCls, 'mt-4')}
          placeholder={t('vote_name_ph')}
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
        />
        <Button variant="volt" className="mt-3 w-full" onClick={() => setNameModal(false)}>
          {t('fund_topup_submit')}
        </Button>
      </Modal>
    </div>
  )
}
