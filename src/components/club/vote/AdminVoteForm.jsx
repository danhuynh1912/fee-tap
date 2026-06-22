import { useState } from 'react'
import { Crown, Lock, Check, Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { cx, fmtDate } from '../../../lib/utils'
import { Button } from '../../ui/Button'
import { getSessionConfigs } from '../../../engine/forecast'

const darkInputCls =
  'w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-lime-400 focus:ring-4 focus:ring-lime-400/10'

function nextPlayDate(settings) {
  const configs = getSessionConfigs(settings)
  const playWeekdays = new Set(configs.flatMap((c) => (c.weekday !== null && c.weekday !== undefined ? [c.weekday] : [])))
  const today = new Date()
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    if (playWeekdays.has(d.getDay())) return d
  }
  const fallback = new Date(today)
  fallback.setDate(fallback.getDate() + 1)
  return fallback
}

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function AdminVoteForm({ vote, closed, filledSlots, club, settings, members, toast, onChanged }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  // Create-vote form state (used when vote === null OR creating next vote after closed)
  const defaultPlayDate = nextPlayDate(settings)
  const defaultMatchDt = toDatetimeLocal(new Date(defaultPlayDate.getFullYear(), defaultPlayDate.getMonth(), defaultPlayDate.getDate(), 8, 0))
  const defaultDeadline = toDatetimeLocal(new Date(defaultPlayDate.getFullYear(), defaultPlayDate.getMonth(), defaultPlayDate.getDate(), 20, 0))

  const [form, setForm] = useState({
    maxSlots: String(members?.length || 7),
    matchDatetime: defaultMatchDt,
    deadline: defaultDeadline,
  })

  async function createVote() {
    if (busy) return
    setBusy(true)
    try {
      const matchDate = new Date(form.matchDatetime)
      const title = `${club.name} · ${fmtDate(matchDate.toISOString())}`
      const { error } = await supabase.from('votes').insert({
        club_id: club.id,
        title,
        vote_type: 'next_session',
        match_date: new Date(form.matchDatetime).toISOString(),
        deadline: new Date(form.deadline).toISOString(),
        max_slots: parseInt(form.maxSlots, 10) || 7,
        is_closed: false,
      })
      if (error) throw error
      toast(t('vote_created'))
      onChanged()
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleClosed() {
    if (!vote || busy) return
    setBusy(true)
    try {
      const { error } = await supabase.from('votes').update({ is_closed: !vote.is_closed }).eq('id', vote.id)
      if (error) throw error
      toast(vote.is_closed ? t('vote_reopened') : t('vote_closed_toast'))
      onChanged()
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setBusy(false)
    }
  }

  async function updateVote(patch) {
    if (!vote || busy) return
    setBusy(true)
    try {
      const { error } = await supabase.from('votes').update(patch).eq('id', vote.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setBusy(false)
    }
  }

  // ── No vote yet → create form ──────────────────────────────
  if (!vote) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-lime-400" />
          <h3 className="font-bold">{t('vote_admin_title')}</h3>
        </div>
        <p className="mt-1 text-sm text-slate-400">{t('vote_no_vote_host')}</p>

        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">{t('vote_max_slots')}</label>
            <input
              type="number"
              min="1"
              max="50"
              className={darkInputCls}
              value={form.maxSlots}
              onChange={(e) => setForm((f) => ({ ...f, maxSlots: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">{t('vote_match_datetime')}</label>
            <input
              type="datetime-local"
              className={darkInputCls}
              value={form.matchDatetime}
              onChange={(e) => setForm((f) => ({ ...f, matchDatetime: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">{t('vote_deadline')}</label>
            <input
              type="datetime-local"
              className={darkInputCls}
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            />
          </div>
        </div>

        <Button variant="volt" className="mt-5 w-full" onClick={createVote} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4" /> {t('vote_create_btn')}
            </>
          )}
        </Button>
      </div>
    )
  }

  // ── Vote exists → admin controls ──────────────────────────
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-lime-400" />
        <h3 className="font-bold">{t('vote_admin_title')}</h3>
      </div>
      <p className="mt-1 text-sm text-slate-400">{t('vote_admin_hint')}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-800 p-3 text-center">
          <p className="text-xs text-slate-400">{t('vote_filled')}</p>
          <p className="text-2xl font-black text-lime-400">
            {filledSlots}
            <span className="text-base text-slate-500">/{vote.max_slots}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-slate-800 p-3 text-center">
          <p className="text-xs text-slate-400">{t('vote_status')}</p>
          <p className="text-lg font-bold">{closed ? t('vote_closed_label') : t('vote_open_label')}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400">{t('vote_max_slots')}</label>
          <input
            type="number"
            min="1"
            max="50"
            className={darkInputCls}
            defaultValue={vote.max_slots}
            onBlur={(e) => {
              const v = parseInt(e.target.value, 10)
              if (v && v !== vote.max_slots) updateVote({ max_slots: v })
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400">{t('vote_deadline')}</label>
          <input
            type="datetime-local"
            className={darkInputCls}
            defaultValue={toDatetimeLocal(new Date(vote.deadline))}
            onBlur={(e) => {
              const val = e.target.value
              if (val) updateVote({ deadline: new Date(val).toISOString() })
            }}
          />
        </div>
      </div>

      <Button variant={vote.is_closed ? 'volt' : 'danger'} className="mt-4 w-full" onClick={toggleClosed} disabled={busy}>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : vote.is_closed ? (
          <>
            <Check className="h-4 w-4" /> {t('vote_reopen')}
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" /> {t('vote_close_now')}
          </>
        )}
      </Button>
      {!vote.is_closed && closed && <p className="mt-2 text-center text-xs text-slate-500">{t('vote_auto_closed_hint')}</p>}
    </div>
  )
}
