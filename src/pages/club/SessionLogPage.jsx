import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ClipboardList, Check, Gauge, AlertTriangle, Info, Calendar, Settings2, Trash2, Loader2,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { inputCls } from '../../components/ui/Field'
import { cx, num, fmtDate, fmtVND, fmtNum } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { resolvePeriods, getSessionConfigs } from '../../engine/forecast'
import { BALLS_PER_BOX } from '../../constants'

function StatCard({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = { slate: 'text-slate-900', volt: 'text-lime-600', red: 'text-red-600' }
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={cx('mt-2 font-mono text-lg sm:text-2xl font-black tabular-nums', tones[tone])}>{value}</p>
    </div>
  )
}

export function SessionLogPage({ club, logs, settings, sport, canEdit, onChanged, toast }) {
  const { t } = useTranslation()
  const [editingDate, setEditingDate] = useState(null)
  const [editForm, setEditForm] = useState({ actual: '', note: '' })
  const [busy, setBusy] = useState(false)

  const hasEquipment = sport?.hasEquipment ?? true
  const est = num(settings.estimated_shuttlecocks)

  const configs = useMemo(() => getSessionConfigs(settings), [settings])
  const hasSchedule = configs.some((c) => c.weekday !== null && c.weekday !== undefined)

  // Build scheduled sessions per config, each using its own billing period
  const sessions = useMemo(() => {
    if (!hasSchedule) return []
    const today = new Date()
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const all = []

    for (const sc of configs) {
      if (sc.weekday === null || sc.weekday === undefined) continue
      const period = resolvePeriods(sc).current
      const { year: sy, month0: sm0 } = period.months[0]
      const lastM = period.months[period.months.length - 1]
      const periodEnd = new Date(lastM.year, lastM.month0 + 1, 0)
      const cutoffDay = todayDay <= periodEnd ? todayDay : periodEnd
      const d = new Date(sy, sm0, 1)
      while (d <= cutoffDay) {
        if (d.getDay() === sc.weekday) {
          const dateStr = d.toISOString().slice(0, 10)
          if (!all.find((s) => s.date === dateStr)) {
            all.push({
              date: dateStr,
              weekday: sc.weekday,
              billing_cycle: sc.billing_cycle,
              log: logs.find((l) => l.played_on === dateStr) || null,
            })
          }
        }
        d.setDate(d.getDate() + 1)
      }
    }

    return all.sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [configs, logs, hasSchedule])

  const loggedCount = sessions.filter((s) => s.log).length
  const avgActual = loggedCount
    ? sessions.filter((s) => s.log).reduce((sum, s) => sum + num(s.log.actual_shuttlecocks), 0) / loggedCount
    : 0
  const runningHigh = loggedCount >= 2 && avgActual > est

  function startEdit(date, log) {
    setEditingDate(date)
    setEditForm({ actual: log ? String(num(log.actual_shuttlecocks)) : '', note: log?.note || '' })
  }

  async function saveEdit() {
    if (busy) return
    setBusy(true)
    try {
      const actualCount = editForm.actual === '' ? est : num(editForm.actual)
      const wd = new Date(editingDate).getDay()
      const configs = getSessionConfigs(settings)
      const sc = configs.find((c) => c.weekday === wd) || configs[0] || {}
      const isCycleMode = sc.court_payment_mode === 'cycle'
      const courtCost = num(sc.court_price_per_hour) * num(sc.hours_per_session)
      const shuttleCost = hasEquipment ? Math.round(actualCount * (num(settings.price_per_box) / BALLS_PER_BOX)) : 0
      const totalCost = courtCost + shuttleCost
      const existingLog = logs.find((l) => l.played_on === editingDate)

      if (existingLog) {
        await supabase.from('session_logs').update({
          actual_shuttlecocks: actualCount, note: editForm.note.trim() || null,
          court_cost: courtCost, shuttle_cost: shuttleCost, total_cost: totalCost,
        }).eq('id', existingLog.id)
        const oldDeduct = isCycleMode ? num(existingLog.shuttle_cost) : num(existingLog.total_cost)
        const newDeduct = isCycleMode ? shuttleCost : totalCost
        const adj = oldDeduct - newDeduct
        if (adj !== 0) {
          await supabase.from('club_settings')
            .update({ current_fund: num(settings.current_fund) + adj })
            .eq('club_id', club.id)
        }
      } else {
        await supabase.from('session_logs').insert({
          club_id: club.id, played_on: editingDate, actual_shuttlecocks: actualCount,
          note: editForm.note.trim() || null, court_cost: courtCost, shuttle_cost: shuttleCost, total_cost: totalCost,
        })
        const deduct = isCycleMode ? shuttleCost : totalCost
        await supabase.from('club_settings')
          .update({ current_fund: Math.max(0, num(settings.current_fund) - deduct) })
          .eq('club_id', club.id)
      }

      setEditingDate(null)
      onChanged()
    } catch (e) { toast(e.message || t('err_generic')) }
    finally { setBusy(false) }
  }

  async function clearLog(log) {
    if (!canEdit || !log) return
    try {
      await supabase.from('session_logs').delete().eq('id', log.id)
      const wd = new Date(log.played_on).getDay()
      const configs = getSessionConfigs(settings)
      const sc = configs.find((c) => c.weekday === wd) || configs[0] || {}
      const isCycleMode = sc.court_payment_mode === 'cycle'
      const restore = isCycleMode ? num(log.shuttle_cost) : num(log.total_cost)
      if (restore > 0) {
        await supabase.from('club_settings')
          .update({ current_fund: num(settings.current_fund) + restore })
          .eq('club_id', club.id)
      }
      onChanged()
    } catch (e) { toast(e.message || t('err_generic')) }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-900">{t('log_title')}</h3>
        </div>
        <p className="mt-1 text-sm text-slate-500">{t('log_sub_auto')}</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard icon={ClipboardList} label={t('log_happened')} value={fmtNum(sessions.length)} />
          <StatCard icon={Check} label={t('log_recorded')} value={fmtNum(loggedCount)} tone={loggedCount === sessions.length ? 'volt' : 'slate'} />
          {hasEquipment && <StatCard icon={Gauge} label={t('log_avg')} value={loggedCount ? avgActual.toFixed(1) : '—'} tone={runningHigh ? 'red' : 'slate'} />}
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
            <li className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">{t('log_no_sessions_yet')}</li>
          )}
          {sessions.map(({ date, weekday, billing_cycle, log }) => {
            const isEditing = editingDate === date
            const isActual = !!log
            const shuttleCount = isActual ? num(log.actual_shuttlecocks) : est
            const diff = shuttleCount - est
            const tone = diff > 0 ? 'red' : diff < 0 ? 'volt' : 'slate'
            const cost = isActual ? num(log.total_cost) : 0
            const cycleTag = billing_cycle === 'quarter' ? t('dash_court_note_quarter') : t('dash_court_note_month')

            return (
              <li key={date} className={cx(
                'rounded-2xl border px-4 py-3 transition',
                isActual ? 'border-slate-100 bg-white' : 'border-dashed border-slate-200 bg-slate-50/60'
              )}>
                {isEditing ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900">{fmtDate(date)}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="relative">
                        <input
                          type="number" min="0" step="0.5" autoFocus
                          className={cx(inputCls, 'font-mono')}
                          placeholder={`${t('log_actual')} (${est})`}
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
                    <div className="flex gap-2">
                      <Button variant="volt" size="sm" className="flex-1" onClick={saveEdit} disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> {t('save')}</>}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingDate(null)}>{t('cancel')}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold', isActual ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400')}>
                      {weekday !== null && weekday !== undefined ? t(`wd_${weekday}`) : <Calendar className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cx('text-sm font-semibold', isActual ? 'text-slate-900' : 'text-slate-400')}>{fmtDate(date)}</p>
                        <span className="text-[10px] text-slate-400">{cycleTag}</span>
                      </div>
                      {log?.note && <p className="truncate text-xs text-slate-400">{log.note}</p>}
                      {!isActual && <p className="text-xs text-slate-400">{t('log_estimated_default')}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {cost > 0 && <p className="font-mono text-sm font-black text-slate-900">{fmtVND(cost)}</p>}
                      {hasEquipment && (
                        <p className={cx('font-mono text-xs', isActual ? 'text-slate-500' : 'text-slate-300')}>
                          {shuttleCount} {t('log_shuttles')}
                          {!isActual && <span className="ml-1 text-slate-300">({t('log_est_tag')})</span>}
                        </p>
                      )}
                      {isActual && (
                        <Badge tone={tone === 'volt' ? 'volt' : tone === 'red' ? 'red' : 'slate'}>
                          {diff > 0 ? '+' : ''}{diff !== 0 ? diff : ''} {diff > 0 ? t('log_over') : diff < 0 ? t('log_under') : t('log_on_track')}
                        </Badge>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => startEdit(date, log)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Settings2 className="h-4 w-4" />
                        </button>
                        {isActual && (
                          <button
                            onClick={() => clearLog(log)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
    </div>
  )
}
