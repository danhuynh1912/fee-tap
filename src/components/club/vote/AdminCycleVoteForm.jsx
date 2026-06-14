import { useState } from 'react'
import { Crown, Lock, Check, Loader2, Plus, Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { cx, fmtDate } from '../../../lib/utils'
import { Button } from '../../ui/Button'
import { nextCyclePeriod, formatPeriodLabel } from '../../../engine/forecast'

const darkInputCls =
  'w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-lime-400 focus:ring-4 focus:ring-lime-400/10'

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function AdminCycleVoteForm({ vote, closed, club, settings, fixedCycleMonths, toast, onChanged }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [busy, setBusy] = useState(false)

  const cyclePeriod = nextCyclePeriod(fixedCycleMonths || 1)
  const periodLabel = formatPeriodLabel(cyclePeriod.period, lang)

  // Default deadline: last day of current month at 23:59
  const now = new Date()
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59)
  const [deadlineInput, setDeadlineInput] = useState(toDatetimeLocal(lastDayOfMonth))

  async function createVote() {
    if (busy) return
    setBusy(true)
    try {
      const title = `${t('cycle_vote_title_prefix')} ${periodLabel}`
      const { error } = await supabase.from('votes').insert({
        club_id: club.id,
        title,
        vote_type: 'membership_cycle',
        deadline: new Date(deadlineInput).toISOString(),
        max_slots: null,
        is_closed: false,
        cycle_period_start: cyclePeriod.start,
        cycle_period_end: cyclePeriod.end,
      })
      if (error) throw error
      toast(t('cycle_vote_created'))
      onChanged()
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setBusy(false)
    }
  }

  async function closeVote() {
    if (!vote || busy) return
    setBusy(true)
    try {
      const { error } = await supabase.from('votes').update({ is_closed: true }).eq('id', vote.id)
      if (error) throw error
      toast(t('vote_closed_toast'))
      onChanged()
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setBusy(false)
    }
  }

  async function reopenVote() {
    if (!vote || busy) return
    setBusy(true)
    try {
      const { error } = await supabase.from('votes').update({ is_closed: false }).eq('id', vote.id)
      if (error) throw error
      toast(t('vote_reopened'))
      onChanged()
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-3xl bg-slate-900 p-6 text-white space-y-5">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-lime-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-lime-400">{t('vote_admin_title')}</span>
      </div>

      {/* No active vote — show create form */}
      {!vote && (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">{t('cycle_vote_no_vote_host')}</p>

          {/* Next cycle period info */}
          <div className="rounded-2xl bg-slate-800 px-4 py-3 flex items-center gap-3">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">{t('cycle_vote_period_label')}</p>
              <p className="text-sm font-semibold text-white">{periodLabel}</p>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t('vote_deadline')}</label>
            <input
              type="datetime-local"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              className={darkInputCls}
            />
          </div>

          <Button variant="volt" className="w-full" onClick={createVote} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t('create_cycle_vote')}
          </Button>
        </div>
      )}

      {/* Active vote — manage */}
      {vote && (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{vote.title}</p>
            {vote.cycle_period_start && (
              <p className="text-xs text-slate-400">
                {fmtDate(vote.cycle_period_start)} – {fmtDate(vote.cycle_period_end)}
              </p>
            )}
            {vote.deadline && (
              <p className="text-xs text-slate-400">
                {t('vote_deadline_label')}: {fmtDate(vote.deadline)}
              </p>
            )}
          </div>

          {closed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Lock className="h-3.5 w-3.5 text-red-400" />
                {vote.is_closed ? t('vote_closed_label') : t('vote_auto_closed_hint')}
              </div>
              {vote.is_closed && (
                <Button variant="darkSubtle" size="sm" className="w-full" onClick={reopenVote} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('vote_reopen')}
                </Button>
              )}
            </div>
          ) : (
            <Button variant="danger" size="sm" className="w-full" onClick={closeVote} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  <Check className="h-4 w-4" /> {t('vote_close_now')}
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
