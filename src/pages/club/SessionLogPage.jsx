import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useClub } from '../../contexts/ClubContext'
import { handleError } from '../../lib/handleError'
import { ClipboardList, Check, Gauge, AlertTriangle, Info, Calendar, Settings2, Trash2, Loader2, Link, Users, TrendingUp, Vote } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { inputCls } from '../../components/ui/Field'
import { cx, num, fmtDate, fmtVND, fmtNum } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { resolvePeriods, getSessionConfigs, calcGuestRevenue, cycleLabelShort, computePaymentTimeline, formatPeriodLabel, periodDateRange } from '../../engine/forecast'
import { BALLS_PER_BOX } from '../../constants'
import { NextSessionVoteTab } from '../../components/club/vote/NextSessionVoteTab'
import { CycleVoteTab } from '../../components/club/vote/CycleVoteTab'

function StatCard({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = { slate: 'text-slate-900', volt: 'text-lime-600', red: 'text-red-600' }
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 sm:flex-col sm:items-start sm:p-5">
      <div className="flex items-center gap-1.5 text-slate-400">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={cx('font-mono text-lg font-black tabular-nums sm:mt-2 sm:text-2xl', tones[tone])}>{value}</p>
    </div>
  )
}

function GuestStepper({ label, value, onDecrement, onIncrement, disabled }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={onDecrement}
          disabled={value <= 0 || disabled}
          className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 disabled:opacity-30"
        >
          <span className="text-lg leading-none">−</span>
        </button>
        <span className="w-7 text-center font-mono text-lg font-black tabular-nums text-slate-900">{value}</span>
        <button
          onClick={onIncrement}
          disabled={disabled}
          className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-30"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      </div>
    </div>
  )
}

export function SessionLogPage({ toast }) {
  const { club, logs, settings, slots, members, sport, canEdit, reload, session, pollTally } = useClub()
  const onChanged = reload
  const user = session?.user
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    if (t === 'vote') return 'vote'
    if (t === 'cycle') return 'cycle'
    return 'log'
  })
  const [editingDate, setEditingDate] = useState(null)
  const [editForm, setEditForm] = useState({
    actual: '',
    note: '',
    voteId: '',
    guestMale: 0,
    guestFemale: 0,
  })
  const [busy, setBusy] = useState(false)
  const [nearbyVotes, setNearbyVotes] = useState([])
  const [pollSuggestion, setPollSuggestion] = useState(null)
  const [votesLoading, setVotesLoading] = useState(false)

  const hasEquipment = sport?.hasEquipment ?? true
  const est = num(settings.estimated_shuttlecocks)
  const memberCount = members?.length || 0

  const configs = useMemo(() => getSessionConfigs(settings), [settings])
  const hasSchedule = configs.some((c) => c.weekday !== null && c.weekday !== undefined)

  // count how many slots fall on a given weekday (for shuttle estimation)
  const slotCountByWeekday = useMemo(() => {
    const map = {}
    const src = slots && slots.length ? slots : configs.map((c) => ({ weekdays: [c.weekday] }))
    for (const s of src) {
      for (const wd of s.weekdays || []) {
        if (wd !== null && wd !== undefined) map[wd] = (map[wd] || 0) + 1
      }
    }
    return map
  }, [slots, configs])

  const sessions = useMemo(() => {
    if (!hasSchedule) return []
    const today = new Date()
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const all = []
    // use unique weekdays from slots if available, else from configs
    const uniqueConfigs =
      slots && slots.length
        ? [
            ...new Map(
              slots
                .flatMap((s) =>
                  (s.weekdays || []).map((wd) => [
                    wd,
                    { ...configs[0], weekday: wd, cycle_months: s.cycle_months || 1, cycle_start_month: s.cycle_start_month || 1 },
                  ])
                )
                .filter(([wd]) => wd !== null && wd !== undefined)
            ).values(),
          ]
        : configs.filter((c) => c.weekday !== null && c.weekday !== undefined)

    for (const sc of uniqueConfigs) {
      const period = resolvePeriods(sc).current
      const { year: sy, month0: sm0 } = period.months[0]
      const lastM = period.months[period.months.length - 1]
      const periodEnd = new Date(lastM.year, lastM.month0 + 1, 0)
      const cutoffDay = todayDay <= periodEnd ? todayDay : periodEnd
      const d = new Date(sy, sm0, 1)
      while (d <= cutoffDay) {
        if (d.getDay() === sc.weekday) {
          // use local date components to avoid UTC timezone shift
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          if (!all.find((s) => s.date === dateStr)) {
            all.push({
              date: dateStr,
              weekday: sc.weekday,
              cycle_months: sc.cycle_months || 1,
              log: logs.find((l) => l.played_on === dateStr) || null,
            })
          }
        }
        d.setDate(d.getDate() + 1)
      }
    }

    return all.sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [configs, slots, logs, hasSchedule])

  const loggedCount = sessions.filter((s) => s.log).length
  const avgActual = loggedCount ? sessions.filter((s) => s.log).reduce((sum, s) => sum + num(s.log.actual_shuttlecocks), 0) / loggedCount : 0
  const runningHigh = loggedCount >= 2 && avgActual > est

  const fetchNearbyVotes = useCallback(
    async (dateStr) => {
      if (!club.id) return
      setVotesLoading(true)
      try {
        const d = new Date(dateStr)
        const from = new Date(d)
        from.setDate(from.getDate() - 1)
        const to = new Date(d)
        to.setDate(to.getDate() + 1)
        const { data } = await supabase
          .from('votes')
          .select('id, title, match_date, is_closed')
          .eq('club_id', club.id)
          .gte('match_date', from.toISOString())
          .lte('match_date', to.toISOString())
          .order('match_date', { ascending: false })
        setNearbyVotes(data || [])
      } finally {
        setVotesLoading(false)
      }
    },
    [club.id]
  )

  async function handleVoteSelect(voteId) {
    setEditForm((f) => ({ ...f, voteId, guestMale: 0, guestFemale: 0 }))
    setPollSuggestion(null)
    if (!voteId) return
    const { data: responses } = await supabase
      .from('responses')
      .select('guests, guest_male_count, guest_female_count')
      .eq('vote_id', voteId)
      .eq('attending', true)
    if (!responses) return
    const totalMale = responses.reduce((s, r) => s + (r.guest_male_count || 0), 0)
    const totalFemale = responses.reduce((s, r) => s + (r.guest_female_count || 0), 0)
    const totalGuests = responses.reduce((s, r) => s + (r.guests || 0), 0)
    setPollSuggestion({ male: totalMale, female: totalFemale, total: totalGuests })
    if (totalMale || totalFemale) {
      setEditForm((f) => ({ ...f, guestMale: totalMale, guestFemale: totalFemale }))
    } else if (totalGuests) {
      setEditForm((f) => ({ ...f, guestMale: totalGuests, guestFemale: 0 }))
    }
  }

  function startEdit(date, log) {
    setEditingDate(date)
    setEditForm({
      actual: log ? String(num(log.actual_shuttlecocks)) : '',
      note: log?.note || '',
      voteId: log?.vote_id || '',
      guestMale: log?.guest_male || 0,
      guestFemale: log?.guest_female || 0,
    })
    setPollSuggestion(null)
    fetchNearbyVotes(date)
  }

  async function saveEdit() {
    if (busy) return
    setBusy(true)
    try {
      const actualCount = editForm.actual === '' ? est : num(editForm.actual)
      const wd = new Date(editingDate).getDay()
      const sc = getSessionConfigs(settings).find((c) => c.weekday === wd) || getSessionConfigs(settings)[0] || {}
      const isCycleMode = sc.court_payment_mode === 'cycle'
      const courtCost = num(sc.court_price_per_hour) * num(sc.hours_per_session)
      const shuttleCost = hasEquipment ? Math.round(actualCount * (num(settings.price_per_box) / BALLS_PER_BOX)) : 0
      const totalCost = courtCost + shuttleCost

      const gm = editForm.guestMale || 0
      const gf = editForm.guestFemale || 0
      const guestRevenue = calcGuestRevenue({
        mode: settings.guest_fee_mode || 'split_all',
        guestMale: gm,
        guestFemale: gf,
        feeMale: num(settings.guest_fee_male),
        feeFemale: num(settings.guest_fee_female),
        shuttleCost,
        courtCost,
        memberCount,
      })

      const existingLog = logs.find((l) => l.played_on === editingDate)

      if (existingLog) {
        await supabase
          .from('session_logs')
          .update({
            actual_shuttlecocks: actualCount,
            note: editForm.note.trim() || null,
            court_cost: courtCost,
            shuttle_cost: shuttleCost,
            total_cost: totalCost,
            vote_id: editForm.voteId || null,
            guest_male: gm,
            guest_female: gf,
            guest_revenue: guestRevenue,
          })
          .eq('id', existingLog.id)

        const oldDeduct = isCycleMode ? num(existingLog.shuttle_cost) : num(existingLog.total_cost)
        const newDeduct = isCycleMode ? shuttleCost : totalCost
        const fundAdj = oldDeduct - newDeduct + (guestRevenue - num(existingLog.guest_revenue))
        if (fundAdj !== 0) {
          await supabase
            .from('club_settings')
            .update({ current_fund: num(settings.current_fund) + fundAdj })
            .eq('club_id', club.id)
        }
        if (guestRevenue > 0) {
          await supabase.from('fund_transactions').upsert(
            {
              club_id: club.id,
              amount: guestRevenue,
              note: `${t('log_guest_section')} ${fmtDate(editingDate)}: ${gm}M ${gf}F`,
              session_log_id: existingLog.id,
            },
            { onConflict: 'session_log_id' }
          )
        }
      } else {
        const { data: newLog, error: insertErr } = await supabase
          .from('session_logs')
          .insert({
            club_id: club.id,
            played_on: editingDate,
            actual_shuttlecocks: actualCount,
            note: editForm.note.trim() || null,
            court_cost: courtCost,
            shuttle_cost: shuttleCost,
            total_cost: totalCost,
            vote_id: editForm.voteId || null,
            guest_male: gm,
            guest_female: gf,
            guest_revenue: guestRevenue,
          })
          .select('id')
          .single()
        if (insertErr) throw insertErr

        const netChange = -(isCycleMode ? shuttleCost : totalCost) + guestRevenue
        await supabase
          .from('club_settings')
          .update({ current_fund: Math.max(0, num(settings.current_fund) + netChange) })
          .eq('club_id', club.id)

        if (guestRevenue > 0) {
          await supabase.from('fund_transactions').upsert(
            {
              club_id: club.id,
              amount: guestRevenue,
              note: `${t('log_guest_section')} ${fmtDate(editingDate)}: ${gm}M ${gf}F`,
              session_log_id: newLog.id,
            },
            { onConflict: 'session_log_id' }
          )
        }
      }

      setEditingDate(null)
      onChanged()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setBusy(false)
    }
  }

  async function clearLog(log) {
    if (!canEdit || !log) return
    try {
      await supabase.from('session_logs').delete().eq('id', log.id)
      const wd = new Date(log.played_on).getDay()
      const sc = getSessionConfigs(settings).find((c) => c.weekday === wd) || getSessionConfigs(settings)[0] || {}
      const isCycleMode = sc.court_payment_mode === 'cycle'
      const restore = isCycleMode ? num(log.shuttle_cost) : num(log.total_cost)
      const fundAdj = restore - num(log.guest_revenue)
      if (fundAdj !== 0) {
        await supabase
          .from('club_settings')
          .update({ current_fund: num(settings.current_fund) + fundAdj })
          .eq('club_id', club.id)
      }
      onChanged()
    } catch (e) {
      handleError(e, toast, t)
    }
  }

  const previewGuestRevenue = useMemo(() => {
    if (!editingDate) return 0
    const wd = new Date(editingDate).getDay()
    const sc = getSessionConfigs(settings).find((c) => c.weekday === wd) || getSessionConfigs(settings)[0] || {}
    const actualCount = editForm.actual === '' ? est : num(editForm.actual)
    const courtCost = num(sc.court_price_per_hour) * num(sc.hours_per_session)
    const shuttleCost = hasEquipment ? Math.round(actualCount * (num(settings.price_per_box) / BALLS_PER_BOX)) : 0
    return calcGuestRevenue({
      mode: settings.guest_fee_mode || 'split_all',
      guestMale: editForm.guestMale || 0,
      guestFemale: editForm.guestFemale || 0,
      feeMale: num(settings.guest_fee_male),
      feeFemale: num(settings.guest_fee_female),
      shuttleCost,
      courtCost,
      memberCount,
    })
  }, [editingDate, editForm, settings, hasEquipment, est, memberCount])

  // Upcoming fee info for cycle vote tab — nearest upcoming group (same grouping as PaymentTimeline)
  const upcomingFeeInfo = useMemo(() => {
    if (!slots?.length || !settings) return null
    const sportHasEquipment = sport?.hasEquipment ?? true
    const timeline = computePaymentTimeline(slots, { ...settings, _hasEquipment: sportHasEquipment }, memberCount)
    if (!timeline.upcoming?.length && !timeline.nextShuttleItem) return null

    // Group by month-of-deadline (same key logic as PaymentTimeline)
    const monthKey = (d) => (d ? `${d.getFullYear()}-${d.getMonth()}` : 'no-deadline')
    const groups = new Map()
    const getOrCreate = (deadline, daysUntil) => {
      const key = monthKey(deadline)
      if (!groups.has(key)) groups.set(key, { deadline, daysUntil, courtItems: [], shuttleItem: null })
      return groups.get(key)
    }
    if (timeline.nextShuttleItem) {
      const g = getOrCreate(timeline.nextShuttleItem.deadline, timeline.nextShuttleItem.daysUntil)
      g.shuttleItem = timeline.nextShuttleItem
    }
    for (const r of timeline.upcoming) {
      getOrCreate(r.nextDeadline, r.daysUntilNext).courtItems.push(r)
    }
    const sorted = [...groups.values()].sort((a, b) => {
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline - b.deadline
    })
    const first = sorted[0]
    if (!first) return null

    const courtCost = first.courtItems.reduce((s, r) => s + r.nextCourtCost, 0)
    const shuttleCost = first.shuttleItem?.cost ?? 0
    const total = courtCost + shuttleCost

    // Same matching rule as PaymentTimeline: the cycle vote only applies to the
    // payment group whose period falls within the vote's cycle period.
    const period = first.courtItems[0]?.nextPeriod || first.shuttleItem?.period
    const ps = period ? periodDateRange(period).start : null
    const matchesVotePeriod = (() => {
      if (!ps || !pollTally?.cyclePeriodStart) return false
      const d = new Date(ps)
      const start = new Date(pollTally.cyclePeriodStart)
      const end = pollTally.cyclePeriodEnd ? new Date(pollTally.cyclePeriodEnd) : start
      return d >= start && d <= end
    })()
    const hasCommitted = matchesVotePeriod && pollTally?.count != null && pollTally.count > 0
    const effectiveCount = hasCommitted ? pollTally.count : timeline.effectiveMemberCount

    const perMember = effectiveCount > 0 ? Math.ceil(total / effectiveCount) : 0
    const periodLabel = first.courtItems[0] ? formatPeriodLabel(first.courtItems[0].nextPeriod, i18n.language) : ''
    return { perMember, periodLabel, deadline: first.deadline, hasCommitted }
  }, [slots, settings, memberCount, sport, i18n.language, pollTally])

  return (
    <div className="mx-auto max-w-[1150px] space-y-4">
      {/* ── Tab switcher ── */}
      <div className="flex gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-1">
        <button
          onClick={() => setActiveTab('log')}
          className={cx(
            'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
            activeTab === 'log' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <ClipboardList className="hidden sm:block h-4 w-4" />
          {t('tab_sessions')}
        </button>
        <button
          onClick={() => setActiveTab('vote')}
          className={cx(
            'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
            activeTab === 'vote' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Vote className="hidden sm:block h-4 w-4" />
          {t('tab_next_vote')}
        </button>
        <button
          onClick={() => setActiveTab('cycle')}
          className={cx(
            'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
            activeTab === 'cycle' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Users className="hidden sm:block h-4 w-4" />
          {t('tab_cycle_vote')}
        </button>
      </div>

      {/* ── Tab: Các buổi đã chơi ── */}
      {activeTab === 'log' && (
        <Card>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-400" />
            <h3 className="text-base font-bold text-slate-900">{t('log_title')}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">{t('log_sub_auto')}</p>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <StatCard icon={ClipboardList} label={t('log_happened')} value={fmtNum(sessions.length)} />
            <StatCard icon={Check} label={t('log_recorded')} value={fmtNum(loggedCount)} tone={loggedCount === sessions.length ? 'volt' : 'slate'} />
            {hasEquipment && (
              <StatCard icon={Gauge} label={t('log_avg')} value={loggedCount ? avgActual.toFixed(1) : '—'} tone={runningHigh ? 'red' : 'slate'} />
            )}
          </div>

          {runningHigh && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {t('log_warn')}
            </div>
          )}

          {!hasSchedule && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <Info className="h-4 w-4 shrink-0" /> {t('log_no_schedule')}
            </div>
          )}

          <ul className="mt-5 space-y-2">
            {sessions.length === 0 && hasSchedule && (
              <li className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                {t('log_no_sessions_yet')}
              </li>
            )}
            {sessions.map(({ date, weekday, cycle_months, log }) => {
              const isEditing = editingDate === date
              const isActual = !!log
              const courtCount = slotCountByWeekday[weekday] || 1
              const estTotal = est * courtCount
              const shuttleCount = isActual ? num(log.actual_shuttlecocks) : estTotal
              const diff = shuttleCount - estTotal
              const tone = diff > 0 ? 'red' : diff < 0 ? 'volt' : 'slate'
              const cost = isActual ? num(log.total_cost) : 0
              const cycleTag = cycleLabelShort(cycle_months || 1, i18n.language)

              return (
                <li
                  key={date}
                  className={cx(
                    'rounded-2xl border px-4 py-3 transition',
                    isActual ? 'border-slate-100 bg-white' : 'border-dashed border-slate-200 bg-slate-50/60'
                  )}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <p className="text-sm font-bold text-slate-900">{fmtDate(date)}</p>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            autoFocus
                            className={cx(inputCls, 'font-mono')}
                            placeholder={`${t('log_actual')} (${estTotal})`}
                            value={editForm.actual}
                            onChange={(e) => setEditForm((f) => ({ ...f, actual: e.target.value }))}
                          />
                        </div>
                        <input
                          className={inputCls}
                          placeholder={t('log_note_ph')}
                          value={editForm.note}
                          onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                        />
                      </div>

                      {/* Vote picker — link log to a vote */}
                      <div>
                        <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <Link className="h-3.5 w-3.5" /> {t('log_link_vote')}
                        </label>
                        {votesLoading ? (
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                          </p>
                        ) : (
                          <select className={cx(inputCls, 'text-sm')} value={editForm.voteId} onChange={(e) => handleVoteSelect(e.target.value)}>
                            <option value="">{t('log_link_vote_none')}</option>
                            {nearbyVotes.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.title}
                                {v.match_date ? ` · ${fmtDate(v.match_date)}` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <Users className="h-3.5 w-3.5" /> {t('log_guest_section')}
                          {pollSuggestion && (
                            <span className="ml-auto text-cyan-600 font-normal">
                              {t('log_poll_suggestion')}: {pollSuggestion.male}M {pollSuggestion.female}F
                            </span>
                          )}
                        </div>
                        <GuestStepper
                          label={`♂ ${t('log_guest_male')}`}
                          value={editForm.guestMale}
                          onDecrement={() => setEditForm((f) => ({ ...f, guestMale: Math.max(0, f.guestMale - 1) }))}
                          onIncrement={() => setEditForm((f) => ({ ...f, guestMale: f.guestMale + 1 }))}
                          disabled={busy}
                        />
                        <GuestStepper
                          label={`♀ ${t('log_guest_female')}`}
                          value={editForm.guestFemale}
                          onDecrement={() => setEditForm((f) => ({ ...f, guestFemale: Math.max(0, f.guestFemale - 1) }))}
                          onIncrement={() => setEditForm((f) => ({ ...f, guestFemale: f.guestFemale + 1 }))}
                          disabled={busy}
                        />
                        {previewGuestRevenue > 0 && (
                          <div className="flex items-center gap-2 rounded-xl bg-lime-50 border border-lime-200 px-3 py-2">
                            <TrendingUp className="h-4 w-4 text-lime-600 shrink-0" />
                            <p className="text-xs font-semibold text-lime-700">
                              {t('log_guest_revenue_preview')}: <span className="font-mono">{fmtVND(previewGuestRevenue)}</span>
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button variant="volt" size="sm" className="flex-1" onClick={saveEdit} disabled={busy}>
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4" /> {t('save')}
                            </>
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingDate(null)}>
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Row 1: weekday badge + date + actions */}
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cx(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold',
                            isActual ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                          )}
                        >
                          {weekday !== null && weekday !== undefined ? t(`wd_${weekday}`) : <Calendar className="h-4 w-4" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={cx('text-sm font-semibold', isActual ? 'text-slate-900' : 'text-slate-400')}>{fmtDate(date)}</p>
                            <span className="text-[10px] text-slate-400">{cycleTag}</span>
                            {log?.vote_id && <Link className="h-3 w-3 text-cyan-500" />}
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0 gap-0.5">
                            <button
                              onClick={() => startEdit(date, log)}
                              className="grid h-7 w-7 place-items-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
                            >
                              <Settings2 className="h-3.5 w-3.5" />
                            </button>
                            {isActual && (
                              <button
                                onClick={() => clearLog(log)}
                                className="grid h-7 w-7 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Row 2: cost + badge OR estimated hint */}
                      <div className="flex items-center justify-between gap-2 pl-10">
                        <div className="flex items-center gap-2 flex-wrap">
                          {cost > 0 ? (
                            <p className="font-mono text-base font-black text-slate-900">{fmtVND(cost)}</p>
                          ) : (
                            <p className="text-xs text-slate-400">{t('log_estimated_default')}</p>
                          )}
                          {hasEquipment && (
                            <p className={cx('font-mono text-xs', isActual ? 'text-slate-400' : 'text-slate-300')}>
                              · {shuttleCount} {t('log_shuttles')}
                              {!isActual && <span className="ml-1 text-slate-300">({t('log_est_tag')})</span>}
                            </p>
                          )}
                        </div>
                        {isActual && diff !== 0 && (
                          <Badge tone={tone === 'volt' ? 'volt' : 'red'}>
                            {diff > 0 ? '+' : ''}{diff} {diff > 0 ? t('log_over') : t('log_under')}
                          </Badge>
                        )}
                      </div>

                      {/* Row 3: note + guest revenue */}
                      {(log?.note || (isActual && num(log?.guest_revenue) > 0)) && (
                        <div className="pl-10 space-y-0.5">
                          {log?.note && <p className="text-xs text-slate-400">{log.note}</p>}
                          {isActual && num(log.guest_revenue) > 0 && (
                            <p className="text-xs text-lime-600 font-semibold">
                              +{fmtVND(log.guest_revenue)} {t('log_guest_section')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* ── Tab: Vote cho buổi kế tiếp ── */}
      {activeTab === 'vote' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/club/${club.id}/log?tab=vote`
                  navigator.clipboard.writeText(url)
                  toast?.(t('vote_link_copied'))
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition active:scale-[0.98]"
              >
                <Link className="h-3.5 w-3.5" />
                {t('vote_copy_link')}
              </button>
            </div>
          )}
          <NextSessionVoteTab club={club} settings={settings} members={members} canEdit={canEdit} user={user} toast={toast} />
        </div>
      )}

      {/* ── Tab: Vote đăng ký cố định ── */}
      {activeTab === 'cycle' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/club/${club.id}/log?tab=cycle`
                  navigator.clipboard.writeText(url)
                  toast?.(t('vote_link_copied'))
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition active:scale-[0.98]"
              >
                <Link className="h-3.5 w-3.5" />
                {t('cycle_vote_copy_link')}
              </button>
            </div>
          )}
          <CycleVoteTab
            club={club}
            members={members}
            settings={settings}
            slots={slots}
            canEdit={canEdit}
            user={user}
            toast={toast}
            upcomingFeeInfo={upcomingFeeInfo}
          />
        </div>
      )}
    </div>
  )
}
