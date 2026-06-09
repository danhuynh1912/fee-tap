import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, Coins, Calendar, Wallet, RefreshCw, Target, Check, Plus, Loader2, ChevronDown, Copy, Users } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, inputCls } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { WeekdayPicker } from '../../components/club/WeekdayPicker'
import { SessionBreakdown } from '../../components/club/SessionBreakdown'
import { MembersPanel } from './MembersPanel'
import { cx, num } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { resolvePeriods, sessionsForPeriod, formatPeriodLabel, monthName, getSessionConfigs } from '../../engine/forecast'
import { DEFAULT_SESSION_CONFIG } from '../../constants'

function initForm(settings) {
  const weekdays = Array.isArray(settings.play_weekdays) ? settings.play_weekdays : []
  const configs = getSessionConfigs(settings).filter((c) => c.weekday !== null && c.weekday !== undefined)
  return {
    play_weekdays: weekdays,
    session_configs: configs,
    price_per_box: settings.price_per_box ?? DEFAULT_SESSION_CONFIG.price_per_box ?? 320000,
    estimated_shuttlecocks: settings.estimated_shuttlecocks ?? 6,
    current_fund: settings.current_fund ?? 0,
    guest_fee_mode: settings.guest_fee_mode ?? 'split_all',
    guest_fee_male: settings.guest_fee_male ?? 0,
    guest_fee_female: settings.guest_fee_female ?? 0,
  }
}

export function SettingsPage({ club, settings, sport, members, plan, pollTally, hostName, hostAvatar, currentUserId, canEdit, onSaved, onChanged, onHitLimit, toast }) {
  const { t, i18n } = useTranslation()
  const [form, setForm] = useState(() => initForm(settings))
  const [collapsedDays, setCollapsedDays] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpNote, setTopUpNote] = useState('')
  const [topUpBusy, setTopUpBusy] = useState(false)

  useEffect(() => { setForm(initForm(settings)) }, [settings])

  const playDays = form.play_weekdays

  function handleWeekdaysChange(newDays) {
    setForm((f) => {
      const newConfigs = newDays.map((wd) => {
        const found = f.session_configs.find((c) => c.weekday === wd)
        return found || { ...DEFAULT_SESSION_CONFIG, weekday: wd }
      })
      // Collapse newly added days
      const addedDays = newDays.filter((wd) => !f.play_weekdays.includes(wd))
      if (addedDays.length) {
        setCollapsedDays((prev) => {
          const next = new Set(prev)
          addedDays.forEach((wd) => next.add(wd))
          return next
        })
      }
      return { ...f, play_weekdays: newDays, session_configs: newConfigs }
    })
  }

  function toggleCollapse(wd) {
    setCollapsedDays((prev) => {
      const next = new Set(prev)
      if (next.has(wd)) next.delete(wd)
      else next.add(wd)
      return next
    })
  }

  function setSessionField(wd, key, value) {
    setForm((f) => ({
      ...f,
      session_configs: f.session_configs.map((c) =>
        c.weekday === wd ? { ...c, [key]: value } : c
      ),
    }))
  }

  const sortedConfigs = [...form.session_configs].sort(
    (a, b) => (a.weekday === 0 ? 7 : a.weekday) - (b.weekday === 0 ? 7 : b.weekday)
  )

  async function save() {
    if (!canEdit || busy) return
    setBusy(true)
    try {
      const first = form.session_configs[0]
      const payload = {
        club_id: club.id,
        play_weekdays: playDays,
        session_configs: form.session_configs,
        sessions_per_week: playDays.length,
        price_per_box: num(form.price_per_box),
        estimated_shuttlecocks: num(form.estimated_shuttlecocks),
        current_fund: num(form.current_fund),
        guest_fee_mode: form.guest_fee_mode,
        guest_fee_male: num(form.guest_fee_male),
        guest_fee_female: num(form.guest_fee_female),
        // backward-compat flat fields from first session config
        court_price_per_hour: first ? num(first.court_price_per_hour) : 120000,
        hours_per_session: first ? num(first.hours_per_session) : 2,
        billing_cycle: first?.billing_cycle ?? 'month',
        quarter_start_month: first ? Math.min(12, Math.max(1, Math.round(num(first.quarter_start_month, 1)))) : 1,
        court_payment_mode: first?.court_payment_mode ?? 'session',
        court_prices_by_weekday: Object.fromEntries(
          form.session_configs.map((c) => [c.weekday, num(c.court_price_per_hour)])
        ),
      }
      const { error } = await supabase.from('club_settings').upsert(payload, { onConflict: 'club_id' })
      if (error) throw error

      // Audit log: if current_fund changed, record a fund_transaction
      const oldFund = num(settings.current_fund)
      const newFund = num(form.current_fund)
      if (newFund !== oldFund) {
        await supabase.from('fund_transactions').insert({
          club_id: club.id,
          amount: newFund - oldFund,
          note: t('fund_manual_adjust'),
        })
      }

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
      onChanged()
    } catch (e) { toast(e.message || t('err_generic')) }
    finally { setTopUpBusy(false) }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-slate-400" />
            <h3 className="text-lg font-bold text-slate-900">{t('set_title')}</h3>
          </div>
          <p className="mt-3 text-sm text-slate-500">{t('set_sub')}</p>

          {/* Weekday picker */}
          <div className="mt-6">
            <Field label={t('set_playdays')} icon={Calendar} hint={t('set_playdays_hint')}>
              <WeekdayPicker
                value={playDays}
                onChange={handleWeekdaysChange}
                disabled={!canEdit}
              />
            </Field>
          </div>

          {/* Per-session config cards */}
          {sortedConfigs.length > 0 && (
            <div className={cx('mt-6 space-y-4', !canEdit && 'pointer-events-none opacity-70')}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('set_day_settings')}</p>
              {sortedConfigs.map((sc) => (
                <SessionConfigCard
                  key={sc.weekday}
                  sc={sc}
                  canEdit={canEdit}
                  lang={i18n.language}
                  settings={form}
                  collapsed={collapsedDays.has(sc.weekday)}
                  onToggle={() => toggleCollapse(sc.weekday)}
                  t={t}
                  onChange={(key, val) => setSessionField(sc.weekday, key, val)}
                />
              ))}
            </div>
          )}

          {/* Shared / global settings */}
          <div className={cx('mt-6', !canEdit && 'pointer-events-none opacity-70')}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">{t('set_global_settings')}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              {sport.hasEquipment && (
                <>
                  <Field label={t('set_box_price')} icon={Coins} hint={t('set_box_hint')}>
                    <div className="relative">
                      <input type="number" min="0" className={cx(inputCls, 'pr-10 font-mono')}
                        value={form.price_per_box ?? ''} disabled={!canEdit}
                        onChange={(e) => setForm((f) => ({ ...f, price_per_box: e.target.value }))}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                    </div>
                  </Field>
                  <Field label={t('set_shuttle')} icon={Target} hint={t('set_shuttle_hint')}>
                    <input type="number" min="0" step="0.5" className={cx(inputCls, 'font-mono')}
                      value={form.estimated_shuttlecocks ?? ''} disabled={!canEdit}
                      onChange={(e) => setForm((f) => ({ ...f, estimated_shuttlecocks: e.target.value }))}
                    />
                  </Field>
                </>
              )}

              {/* Fund */}
              <div className={sport.hasEquipment ? '' : 'sm:col-span-2'}>
                <label className="block">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                    <Wallet className="w-4 h-4 text-slate-400" />
                    {t('set_fund')}
                    {canEdit && (
                      <button type="button" onClick={() => setTopUpOpen((v) => !v)}
                        className="ml-auto flex items-center gap-1 rounded-full bg-lime-400 px-2.5 py-0.5 text-xs font-bold text-slate-900 hover:bg-lime-300 transition"
                      >
                        <Plus className="h-3 w-3" /> {t('fund_topup_btn')}
                      </button>
                    )}
                  </span>
                  <div className="relative">
                    <input type="number" min="0" className={cx(inputCls, 'pr-10 font-mono')}
                      value={form.current_fund ?? ''} disabled={!canEdit}
                      onChange={(e) => setForm((f) => ({ ...f, current_fund: e.target.value }))}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                  </div>
                </label>
                {topUpOpen && canEdit && (
                  <div className="mt-2 rounded-2xl border border-lime-200 bg-lime-50 p-4 space-y-3 animate-fade-in">
                    <p className="text-xs font-semibold text-slate-600">{t('fund_topup_title')}</p>
                    <div className="relative">
                      <input type="number" min="0" className={cx(inputCls, 'pr-10 font-mono bg-white')}
                        placeholder={t('fund_topup_amount_ph')} value={topUpAmount} autoFocus
                        onChange={(e) => setTopUpAmount(e.target.value)}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                    </div>
                    <input className={cx(inputCls, 'bg-white')} placeholder={t('fund_topup_note_ph')}
                      value={topUpNote} onChange={(e) => setTopUpNote(e.target.value)}
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
            </div>
          </div>

          {/* Guest fee config */}
          <div className={cx('mt-6', !canEdit && 'pointer-events-none opacity-70')}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{t('set_guest_fee')}</span>
            </p>
            <p className="mb-4 text-xs text-slate-500">{t('set_guest_fee_hint')}</p>
            <Field label={t('set_guest_mode')} icon={Users}>
              <Segmented
                value={form.guest_fee_mode}
                onChange={(v) => setForm((f) => ({ ...f, guest_fee_mode: v }))}
                disabled={!canEdit}
                options={[
                  { value: 'split_all',        label: t('set_guest_mode_split') },
                  { value: 'fixed_by_gender',  label: t('set_guest_mode_fixed') },
                  { value: 'split_shuttle',    label: t('set_guest_mode_shuttle') },
                ]}
              />
            </Field>
            <p className="mt-2 mb-4 text-xs text-slate-400 italic">
              {form.guest_fee_mode === 'fixed_by_gender' && t('set_guest_fee_mode_hint_fixed')}
              {form.guest_fee_mode === 'split_shuttle'   && t('set_guest_fee_mode_hint_shuttle')}
              {form.guest_fee_mode === 'split_all'       && t('set_guest_fee_mode_hint_split')}
            </p>
            {(form.guest_fee_mode === 'fixed_by_gender' || form.guest_fee_mode === 'split_shuttle') && (
              <div className="grid gap-4 sm:grid-cols-2 animate-fade-in">
                {form.guest_fee_mode === 'fixed_by_gender' && (
                  <Field label={t('set_guest_fee_male')} icon={Coins}>
                    <div className="relative">
                      <input type="number" min="0" className={cx(inputCls, 'pr-10 font-mono')}
                        value={form.guest_fee_male ?? ''} disabled={!canEdit}
                        onChange={(e) => setForm((f) => ({ ...f, guest_fee_male: e.target.value }))}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                    </div>
                  </Field>
                )}
                <Field label={t('set_guest_fee_female')} icon={Coins}>
                  <div className="relative">
                    <input type="number" min="0" className={cx(inputCls, 'pr-10 font-mono')}
                      value={form.guest_fee_female ?? ''} disabled={!canEdit}
                      onChange={(e) => setForm((f) => ({ ...f, guest_fee_female: e.target.value }))}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                  </div>
                </Field>
              </div>
            )}
          </div>

          {canEdit && (
            <Button variant="primary" size="lg" className="mt-6 w-full" onClick={save} disabled={busy}>
              {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> {t('saving')}</> : <>{t('save')} <Check className="h-5 w-5 text-lime-400" /></>}
            </Button>
          )}
        </Card>

      </div>

      <div className="space-y-6">
        {/* PollTap link token */}
        {canEdit && club.polltap_link_token && (
          <Card>
            <div className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-900">{t('polltap_token_label')}</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t('polltap_token_hint')}</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 break-all select-all">
                {club.polltap_link_token}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(club.polltap_link_token)
                  toast(t('polltap_token_copied'))
                }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </Card>
        )}
        <MembersPanel
          club={club} members={members} plan={plan} pollTally={pollTally}
          hostName={hostName} hostAvatar={hostAvatar} currentUserId={currentUserId}
          canEdit={canEdit} onChanged={onChanged} onHitLimit={onHitLimit} toast={toast}
        />
      </div>
    </div>
  )
}

function SessionConfigCard({ sc, canEdit, lang, settings, collapsed, onToggle, t, onChange }) {
  const periods = resolvePeriods(sc)
  const sess = sessionsForPeriod({ ...sc, play_weekdays: [sc.weekday] }, periods.current)
  const periodLabel = formatPeriodLabel(periods.current, lang)

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 animate-fade-in overflow-hidden">
      {/* Card header — always visible, clickable */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-100/60 transition"
      >
        <span className="rounded-xl bg-slate-900 px-3 py-1 text-sm font-bold text-white">
          {t(`wd_${sc.weekday}`)}
        </span>
        {!sess.fallback && (
          <span className="flex-1 text-xs text-slate-400">
            {sess.total} {t('dash_sessions')} · {periodLabel}
          </span>
        )}
        <ChevronDown className={cx('h-4 w-4 text-slate-400 transition-transform duration-200 ml-auto shrink-0', !collapsed && 'rotate-180')} />
      </button>

      {!collapsed && <div className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
        {/* Giá sân / giờ */}
        <Field label={t('set_court_price')} icon={Coins}>
          <div className="relative">
            <input type="number" min="0" className={cx(inputCls, 'pr-10 font-mono')}
              value={sc.court_price_per_hour ?? ''} disabled={!canEdit}
              onChange={(e) => onChange('court_price_per_hour', e.target.value)}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
          </div>
        </Field>

        {/* Số giờ / buổi */}
        <Field label={t('set_hours')} icon={Calendar}>
          <input type="number" min="0" step="0.5" className={cx(inputCls, 'font-mono')}
            value={sc.hours_per_session ?? ''} disabled={!canEdit}
            onChange={(e) => onChange('hours_per_session', e.target.value)}
          />
        </Field>

        {/* Hình thức trả tiền sân */}
        <div className="sm:col-span-2">
          <Field label={t('set_court_mode')} icon={Coins} hint={t('set_court_mode_hint')}>
            <Segmented
              value={sc.court_payment_mode ?? 'session'}
              onChange={(v) => onChange('court_payment_mode', v)}
              disabled={!canEdit}
              options={[
                { value: 'session', label: t('court_mode_session') },
                { value: 'cycle', label: t('court_mode_cycle') },
              ]}
            />
          </Field>
        </div>

        {/* Chu kỳ thu */}
        <div className="sm:col-span-2">
          <Field label={t('set_cycle')} icon={RefreshCw}>
            <Segmented
              value={sc.billing_cycle ?? 'month'}
              onChange={(v) => onChange('billing_cycle', v)}
              disabled={!canEdit}
              options={[{ value: 'month', label: t('month') }, { value: 'quarter', label: t('quarter') }]}
            />
          </Field>
        </div>

        {/* Quý bắt đầu từ tháng (conditional) */}
        {sc.billing_cycle === 'quarter' && (
          <div className="sm:col-span-2">
            <Field label={t('set_quarter_start')} icon={Calendar}>
              <select className={inputCls} disabled={!canEdit}
                value={Math.min(12, Math.max(1, Math.round(num(sc.quarter_start_month, 1))))}
                onChange={(e) => onChange('quarter_start_month', e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{monthName(m, lang)}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* Session preview */}
        {!sess.fallback && (
          <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-white p-3">
            <SessionBreakdown breakdown={sess.breakdown} />
          </div>
        )}
      </div>}
    </div>
  )
}
