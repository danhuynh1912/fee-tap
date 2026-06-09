import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, Coins, Calendar, Wallet, RefreshCw, Target, Check, Plus, Loader2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, inputCls } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { WeekdayPicker } from '../../components/club/WeekdayPicker'
import { SessionBreakdown } from '../../components/club/SessionBreakdown'
import { MembersPanel } from './MembersPanel'
import { cx, num } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { resolvePeriods, sessionsForPeriod, formatPeriodLabel, monthName } from '../../engine/forecast'

export function SettingsPage({ club, settings, sport, members, plan, pollTally, canEdit, onSaved, onChanged, onHitLimit, toast }) {
  const { t, i18n } = useTranslation()
  const [form, setForm] = useState(() => ({ ...settings }))
  const [busy, setBusy] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpNote, setTopUpNote] = useState('')
  const [topUpBusy, setTopUpBusy] = useState(false)

  useEffect(() => { setForm({ ...settings }) }, [settings])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.value ?? e }))
  const playDays = Array.isArray(form.play_weekdays) ? form.play_weekdays : []
  const previewPeriods = resolvePeriods(form)
  const previewSess = sessionsForPeriod(form, previewPeriods.current)
  const previewLabel = formatPeriodLabel(previewPeriods.current, i18n.language)
  const courtMode = form.court_payment_mode === 'cycle' ? 'cycle' : 'session'

  async function save() {
    if (!canEdit || busy) return
    setBusy(true)
    try {
      const payload = {
        club_id: club.id,
        court_price_per_hour: num(form.court_price_per_hour),
        hours_per_session: num(form.hours_per_session),
        play_weekdays: playDays,
        sessions_per_week: playDays.length || Math.round(num(form.sessions_per_week)),
        billing_cycle: form.billing_cycle === 'quarter' ? 'quarter' : 'month',
        quarter_start_month: Math.min(12, Math.max(1, Math.round(num(form.quarter_start_month, 1)))),
        price_per_box: num(form.price_per_box),
        estimated_shuttlecocks: num(form.estimated_shuttlecocks),
        current_fund: num(form.current_fund),
        court_payment_mode: courtMode,
      }
      const { error } = await supabase.from('club_settings').upsert(payload, { onConflict: 'club_id' })
      if (error) throw error
      toast(t('set_saved'))
      onSaved(payload)
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setBusy(false)
    }
  }

  async function submitTopUp() {
    const amount = num(topUpAmount)
    if (!amount || topUpBusy) return
    setTopUpBusy(true)
    try {
      const newFund = num(settings.current_fund) + amount
      const { error: e1 } = await supabase.from('fund_transactions').insert({ club_id: club.id, amount, note: topUpNote.trim() || null })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('club_settings').update({ current_fund: newFund }).eq('club_id', club.id)
      if (e2) throw e2
      toast(t('fund_added'))
      setTopUpAmount(''); setTopUpNote(''); setTopUpOpen(false)
      onSaved({ ...settings, current_fund: newFund })
    } catch (e) { toast(e.message || t('err_generic')) }
    finally { setTopUpBusy(false) }
  }

  const allFields = [
    { k: 'court_price_per_hour', label: 'set_court_price', icon: Coins, suffix: '₫', type: 'number' },
    { k: 'hours_per_session', label: 'set_hours', icon: Calendar, type: 'number', step: '0.5' },
    { k: 'price_per_box', label: 'set_box_price', icon: Coins, hint: 'set_box_hint', suffix: '₫', type: 'number', equipmentOnly: true },
    { k: 'estimated_shuttlecocks', label: 'set_shuttle', icon: Target, hint: 'set_shuttle_hint', type: 'number', step: '0.5', equipmentOnly: true },
    { k: 'current_fund', label: 'set_fund', icon: Wallet, suffix: '₫', type: 'number' },
  ]
  const fields = allFields.filter((f) => !f.equipmentOnly || sport.hasEquipment)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-slate-400" />
            <h3 className="text-lg font-bold text-slate-900">{t('set_title')}</h3>
          </div>
          <p className="mt-3 text-sm text-slate-500">{t('set_sub')}</p>

          <div className={cx('mt-6 grid gap-5 sm:grid-cols-2', !canEdit && 'pointer-events-none opacity-70')}>
            {fields.map((f) => (
              <div key={f.k}>
                {f.k === 'current_fund' ? (
                  <label className="block">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                      <Wallet className="w-4 h-4 text-slate-400" />
                      {t(f.label)}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setTopUpOpen((v) => !v)}
                          className="ml-auto flex items-center gap-1 rounded-full bg-lime-400 px-2.5 py-0.5 text-xs font-bold text-slate-900 hover:bg-lime-300 transition"
                        >
                          <Plus className="h-3 w-3" /> {t('fund_topup_btn')}
                        </button>
                      )}
                    </span>
                    <div className="relative">
                      <input
                        type="number" min="0"
                        className={cx(inputCls, 'pr-10 font-mono')}
                        value={form.current_fund ?? ''}
                        onChange={set('current_fund')}
                        disabled={!canEdit}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                    </div>
                  </label>
                ) : (
                  <Field label={t(f.label)} icon={f.icon} hint={f.hint ? t(f.hint) : undefined}>
                    <div className="relative">
                      <input
                        type={f.type} step={f.step} min="0"
                        className={cx(inputCls, f.suffix && 'pr-10', 'font-mono')}
                        value={form[f.k] ?? ''}
                        onChange={set(f.k)}
                        disabled={!canEdit}
                      />
                      {f.suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">{f.suffix}</span>}
                    </div>
                  </Field>
                )}
                {f.k === 'current_fund' && topUpOpen && canEdit && (
                  <div className="mt-2 rounded-2xl border border-lime-200 bg-lime-50 p-4 space-y-3 animate-fade-in">
                    <p className="text-xs font-semibold text-slate-600">{t('fund_topup_title')}</p>
                    <div className="relative">
                      <input
                        type="number" min="0"
                        className={cx(inputCls, 'pr-10 font-mono bg-white')}
                        placeholder={t('fund_topup_amount_ph')}
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        autoFocus
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                    </div>
                    <input
                      className={cx(inputCls, 'bg-white')}
                      placeholder={t('fund_topup_note_ph')}
                      value={topUpNote}
                      onChange={(e) => setTopUpNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="volt" size="sm" className="flex-1" onClick={submitTopUp} disabled={topUpBusy || !topUpAmount}>
                        {topUpBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> {t('fund_topup_submit')}</>}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setTopUpOpen(false); setTopUpAmount(''); setTopUpNote('') }}>
                        {t('cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="sm:col-span-2">
              <Field label={t('set_court_mode')} icon={Coins} hint={t('set_court_mode_hint')}>
                <Segmented
                  value={courtMode}
                  onChange={(v) => setForm((f) => ({ ...f, court_payment_mode: v }))}
                  disabled={!canEdit}
                  options={[
                    { value: 'session', label: t('court_mode_session') },
                    { value: 'cycle', label: t('court_mode_cycle') },
                  ]}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label={t('set_cycle')} icon={RefreshCw}>
                <Segmented
                  value={form.billing_cycle === 'quarter' ? 'quarter' : 'month'}
                  onChange={(v) => setForm((f) => ({ ...f, billing_cycle: v }))}
                  disabled={!canEdit}
                  options={[{ value: 'month', label: t('month') }, { value: 'quarter', label: t('quarter') }]}
                />
              </Field>
            </div>

            {form.billing_cycle === 'quarter' && (
              <div className="sm:col-span-2">
                <Field label={t('set_quarter_start')} icon={Calendar}>
                  <select
                    className={inputCls}
                    value={Math.min(12, Math.max(1, Math.round(num(form.quarter_start_month, 1))))}
                    onChange={set('quarter_start_month')}
                    disabled={!canEdit}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{monthName(m, i18n.language)}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <div className="sm:col-span-2">
              <Field label={t('set_playdays')} icon={Calendar} hint={t('set_playdays_hint')}>
                <WeekdayPicker
                  value={playDays}
                  onChange={(v) => setForm((f) => ({ ...f, play_weekdays: v }))}
                  disabled={!canEdit}
                />
              </Field>
            </div>

            <div className="sm:col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Calendar className="h-4 w-4 text-slate-400" />
                {t('set_preview', { count: previewSess.total, label: previewLabel })}
              </p>
              {previewSess.fallback ? (
                <p className="mt-2 text-xs text-amber-600">{t('set_no_days')}</p>
              ) : (
                <div className="mt-2"><SessionBreakdown breakdown={previewSess.breakdown} /></div>
              )}
            </div>
          </div>

          {canEdit && (
            <Button variant="primary" size="lg" className="mt-6 w-full" onClick={save} disabled={busy}>
              {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> {t('saving')}</> : <>{t('save')} <Check className="h-5 w-5 text-lime-400" /></>}
            </Button>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <MembersPanel
          club={club} members={members} plan={plan} pollTally={pollTally}
          canEdit={canEdit} onChanged={onChanged} onHitLimit={onHitLimit} toast={toast}
        />
      </div>
    </div>
  )
}
