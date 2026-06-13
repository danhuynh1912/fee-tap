import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useClub } from '../../contexts/ClubContext'
import { handleError } from '../../lib/handleError'
import {
  Settings2,
  Coins,
  Wallet,
  Check,
  Plus,
  Loader2,
  Users,
  TrendingUp,
  MapPin,
  Pencil,
  Trash2,
  GripVertical,
  Package,
  UserCheck,
  RefreshCw,
  Calendar,
  QrCode,
  CheckCircle2,
  Eye,
  EyeOff,
  Crown,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, inputCls } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { CourtSlotModal } from '../../components/club/CourtSlotModal'
import { MembersPanel } from './MembersPanel'
import { ProLock } from '../../components/monetize/ProLock'
import { cx, num, fmtVND, fmtNum, fmtInputNum, parseInputNum } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { computeSlot, formatPeriodLabel, cycleLabelShort, monthName, estimateShuttle, resolvePeriodForSlot } from '../../engine/forecast'

// ─────────────────────────────────────────────────────────────────────────────
// PayOS Settings — Pro only
// ─────────────────────────────────────────────────────────────────────────────
function PayOSSettings({ club, plan, payosConfig, canEdit, onChanged, toast, onUnlock }) {
  const { t } = useTranslation()
  const isPro = plan === 'pro'
  const isConfigured = !!payosConfig
  const [editing, setEditing] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [form, setForm] = useState({ clientId: '', apiKey: '', checksumKey: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.clientId.trim() || !form.apiKey.trim() || !form.checksumKey.trim()) return
    setSaving(true)
    try {
      const payload = {
        club_id: club.id,
        payos_client_id: form.clientId.trim(),
        payos_api_key: form.apiKey.trim(),
        payos_checksum_key: form.checksumKey.trim(),
      }
      const { error } = await supabase.from('club_payment_config').upsert(payload, { onConflict: 'club_id' })
      if (error) throw error
      toast(t('payos_saved'))
      setEditing(false)
      setForm({ clientId: '', apiKey: '', checksumKey: '' })
      onChanged?.()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <div className={cx(!isPro && 'locked-blur')}>
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-slate-900">
              <QrCode className="h-4 w-4 text-lime-400" />
            </span>
            <div>
              <p className="font-black text-slate-900">{t('payos_title')}</p>
              <p className="text-xs text-slate-500">{t('payos_subtitle')}</p>
            </div>
            {isConfigured && !editing && (
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-lime-50 px-3 py-1 text-xs font-semibold text-lime-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('payos_connected')}
              </span>
            )}
          </div>

          {!editing && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-800">{t('payos_how_it_works_title')}</p>
                <p>1. {t('payos_step_1')}</p>
                <p>2. {t('payos_step_2')}</p>
                <p>3. {t('payos_step_3')}</p>
              </div>
              {canEdit && (
                <Button variant={isConfigured ? 'ghost' : 'volt'} size="sm" onClick={() => setEditing(true)}>
                  {isConfigured ? t('payos_reconfigure') : t('payos_connect_btn')}
                </Button>
              )}
            </div>
          )}

          {editing && canEdit && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{t('payos_enter_keys')}</p>
                <button onClick={() => setShowKeys((v) => !v)} className="text-slate-400 hover:text-slate-700 transition">
                  {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <input
                className={inputCls}
                placeholder="Client ID"
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="API Key"
                type={showKeys ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Checksum Key"
                type={showKeys ? 'text' : 'password'}
                value={form.checksumKey}
                onChange={(e) => setForm((f) => ({ ...f, checksumKey: e.target.value }))}
              />
              <p className="text-xs text-slate-400">{t('payos_keys_hint')}</p>
              <div className="flex gap-2">
                <Button
                  variant="volt"
                  size="sm"
                  className="flex-1"
                  onClick={save}
                  disabled={saving || !form.clientId || !form.apiKey || !form.checksumKey}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> {t('save')}
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false)
                    setForm({ clientId: '', apiKey: '', checksumKey: '' })
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
      {!isPro && <ProLock onClick={onUnlock} label={t('locked_pro')} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CourtSlotCard — one card in the slot list
// ─────────────────────────────────────────────────────────────────────────────
function CourtSlotCard({ slot, canEdit, lang, onEdit, onDelete, t }) {
  const result = useMemo(() => computeSlot(slot), [slot])
  const wdLabels = (slot.weekdays || [])
    .slice()
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((w) => t(`wd_${w}`))
    .join(', ')

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 animate-fade-in">
      {canEdit && <GripVertical className="h-4 w-4 shrink-0 text-slate-300 cursor-grab" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900 text-sm truncate">{slot.name}</span>
          {slot.venue_name && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3" />
              {slot.venue_name}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span>{wdLabels}</span>
          <span>
            {fmtVND(num(slot.price_per_hour))}/giờ · {slot.hours_per_session}h
          </span>
          <span>{cycleLabelShort(slot.cycle_months || 1, lang)}</span>
          {slot.renewal_day && (
            <span>
              {t('timeline_deadline')} {t('timeline_days_left', { n: `${slot.renewal_day}` })}
            </span>
          )}
        </div>
        {result.totalSessions > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {t('slot_sessions_preview', { n: result.totalSessions, label: formatPeriodLabel(result.period, lang) })}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-400 hover:text-slate-700">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-xl hover:bg-red-50 transition text-slate-400 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsPage
// ─────────────────────────────────────────────────────────────────────────────
export function SettingsPage({ toast }) {
  const { t, i18n } = useTranslation()
  const {
    club,
    settings,
    slots: initialSlots,
    sport,
    members,
    plan,
    pollTally,
    hostName,
    hostAvatar,
    currentUserId,
    canEdit,
    logs,
    fundTxns,
    payosConfig,
    setSettings,
    reload,
    openUpsell,
  } = useClub()
  const onChanged = reload
  const onHitLimit = openUpsell
  const onSaved = (p) => setSettings((s) => ({ ...s, ...p }))

  // ── global form (shuttle + fund + guest fees + fee split) ──
  const [form, setForm] = useState({
    price_per_box: settings.price_per_box ?? 320000,
    estimated_shuttlecocks: settings.estimated_shuttlecocks ?? 6,
    current_fund: settings.current_fund ?? 0,
    shuttle_mode: settings.shuttle_mode ?? 'estimate',
    shuttle_stock: settings.shuttle_stock ?? 0,
    shuttle_cycle_months: settings.shuttle_cycle_months ?? 1,
    shuttle_cycle_start_month: settings.shuttle_cycle_start_month ?? 1,
    fee_split_mode: settings.fee_split_mode ?? 'committed_only',
    guest_fee_mode: settings.guest_fee_mode ?? 'split_all',
    guest_fee_male: settings.guest_fee_male ?? 0,
    guest_fee_female: settings.guest_fee_female ?? 0,
  })
  const [busy, setBusy] = useState(false)

  // ── top-up ──────────────────────────────────────────────
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpNote, setTopUpNote] = useState('')
  const [topUpBusy, setTopUpBusy] = useState(false)

  // ── restock shuttle ─────────────────────────────────────
  const [restockOpen, setRestockOpen] = useState(false)
  const [restockBoxes, setRestockBoxes] = useState('')
  const [restockPrice, setRestockPrice] = useState(settings.price_per_box ?? 320000)
  const [restockBusy, setRestockBusy] = useState(false)

  // ── slot modal ──────────────────────────────────────────
  const [slots, setSlots] = useState(initialSlots || [])
  const [editingSlot, setEditingSlot] = useState(null) // null=closed, {}=new, slot=edit
  const [slotBusy, setSlotBusy] = useState(false)

  // ── fund setup (first-time mid-cycle) ───────────────────
  const [fundSetupMode, setFundSetupMode] = useState(null) // null | 'from_now' | 'from_start'

  const isFirstSetup = canEdit && Array.isArray(fundTxns) && fundTxns.length === 0

  const actualSpent = useMemo(() => {
    if (!isFirstSetup || !initialSlots?.length) return 0
    const now = new Date()
    const shuttlePerSession = (num(form.estimated_shuttlecocks) * num(form.price_per_box)) / 12
    return initialSlots.reduce((total, slot) => {
      const { happened, courtCost } = computeSlot(slot, now)
      if (slot.payment_mode === 'cycle') {
        // cycle mode: full period court cost is due regardless of sessions played
        return total + courtCost + happened * shuttlePerSession
      }
      const courtPerSession = num(slot.price_per_hour) * num(slot.hours_per_session)
      return total + happened * (courtPerSession + shuttlePerSession)
    }, 0)
  }, [isFirstSetup, initialSlots, form.price_per_box, form.estimated_shuttlecocks])

  const cardTitleCls = 'flex items-center gap-2.5 text-base font-bold text-slate-900'

  // ── save global settings ────────────────────────────────
  async function save() {
    if (!canEdit || busy) return
    setBusy(true)
    try {
      // legacy NOT NULL fields — derive from first slot or keep existing
      const firstSlot = slots[0]
      const payload = {
        club_id: club.id,
        price_per_box: num(form.price_per_box),
        estimated_shuttlecocks: num(form.estimated_shuttlecocks),
        current_fund: num(form.current_fund),
        shuttle_mode: form.shuttle_mode,
        shuttle_stock: num(form.shuttle_stock),
        shuttle_cycle_months: Math.max(1, parseInt(form.shuttle_cycle_months, 10) || 1),
        shuttle_cycle_start_month: Math.max(1, Math.min(12, parseInt(form.shuttle_cycle_start_month, 10) || 1)),
        fee_split_mode: form.fee_split_mode,
        guest_fee_mode: form.guest_fee_mode,
        guest_fee_male: num(form.guest_fee_male),
        guest_fee_female: num(form.guest_fee_female),
        // backward-compat legacy columns — keep DB happy
        court_price_per_hour: firstSlot ? num(firstSlot.price_per_hour) : num(settings.court_price_per_hour) || 0,
        hours_per_session: firstSlot ? num(firstSlot.hours_per_session) : num(settings.hours_per_session) || 2,
        court_payment_mode: firstSlot?.payment_mode ?? settings.court_payment_mode ?? 'session',
        play_weekdays: firstSlot?.weekdays ?? settings.play_weekdays ?? [],
        sessions_per_week: slots.reduce((sum, s) => sum + (s.weekdays?.length || 0), 0) || settings.sessions_per_week || 0,
      }
      // Apply fund setup (first-time mid-cycle) before saving fund balance
      if (isFirstSetup && fundSetupMode) {
        if (fundSetupMode === 'from_now' && actualSpent > 0) {
          payload.current_fund = num(form.current_fund) + actualSpent
          await supabase.from('fund_transactions').insert({
            club_id: club.id,
            amount: actualSpent,
            note: t('fund_setup_deduct_note'),
            type: 'manual',
          })
        } else {
          // from_start: just insert a zero-amount marker so toggle disappears
          await supabase.from('fund_transactions').insert({
            club_id: club.id,
            amount: 0,
            note: t('fund_setup_from_start'),
            type: 'manual',
          })
        }
      }

      const { error } = await supabase.from('club_settings').upsert(payload, { onConflict: 'club_id' })
      if (error) throw error
      const oldFund = num(settings.current_fund)
      const newFund = num(form.current_fund)
      if (!fundSetupMode && newFund !== oldFund) {
        await supabase
          .from('fund_transactions')
          .insert({ club_id: club.id, amount: newFund - oldFund, note: t('fund_manual_adjust'), type: 'manual' })
      }
      toast(t('set_saved'))
      onSaved({ ...settings, ...payload })
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setBusy(false)
    }
  }

  // ── top-up ──────────────────────────────────────────────
  async function submitTopUp() {
    const amount = num(topUpAmount)
    if (!amount || topUpBusy) return
    setTopUpBusy(true)
    try {
      const newFund = num(settings.current_fund) + amount
      const { error: e1 } = await supabase
        .from('fund_transactions')
        .insert({ club_id: club.id, amount, note: topUpNote.trim() || null, type: 'top_up' })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('club_settings').update({ current_fund: newFund }).eq('club_id', club.id)
      if (e2) throw e2
      toast(t('fund_added'))
      setTopUpAmount('')
      setTopUpNote('')
      setTopUpOpen(false)
      onSaved({ ...settings, current_fund: newFund })
      onChanged()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setTopUpBusy(false)
    }
  }

  // ── restock shuttle ─────────────────────────────────────
  async function submitRestock() {
    const boxes = num(restockBoxes)
    const price = num(restockPrice)
    if (!boxes || restockBusy) return
    setRestockBusy(true)
    try {
      const totalCost = boxes * price
      const newStock = num(form.shuttle_stock) + boxes
      const newFund = num(settings.current_fund) - totalCost
      await Promise.all([
        supabase.from('fund_transactions').insert({ club_id: club.id, amount: -totalCost, note: `Nhập ${boxes} hộp cầu`, type: 'shuttle_purchase' }),
        supabase.from('club_settings').update({ shuttle_stock: newStock, current_fund: newFund, price_per_box: price }).eq('club_id', club.id),
      ])
      toast(t('shuttle_restock_submit'))
      setForm((f) => ({ ...f, shuttle_stock: newStock, price_per_box: price }))
      setRestockBoxes('')
      setRestockOpen(false)
      onChanged()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setRestockBusy(false)
    }
  }

  // ── court slot CRUD ─────────────────────────────────────
  // data can be a single slot object (edit) or an array of slots (bulk create)
  async function saveSlot(data) {
    if (slotBusy) return
    setSlotBusy(true)
    try {
      // Edit existing
      if (!Array.isArray(data) && data.id) {
        const { error } = await supabase
          .from('court_slots')
          .update({ ...data, club_id: club.id })
          .eq('id', data.id)
        if (error) throw error
        setSlots((prev) => prev.map((s) => (s.id === data.id ? { ...s, ...data } : s)))
        toast(t('slot_saved'))
      } else {
        // Bulk insert (array) or single new slot
        const items = (Array.isArray(data) ? data : [data]).map((item, i) => ({
          ...item,
          club_id: club.id,
          sort_order: slots.length + i,
        }))
        const { data: inserted, error } = await supabase.from('court_slots').insert(items).select()
        if (error) throw error
        setSlots((prev) => [...prev, ...(inserted || items)])
        toast(items.length > 1 ? `Đã tạo ${items.length} sân` : t('slot_saved'))
      }
      setEditingSlot(null)
      onChanged()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setSlotBusy(false)
    }
  }

  async function deleteSlot(slot) {
    if (!confirm(t('slot_delete_confirm'))) return
    try {
      const { error } = await supabase.from('court_slots').delete().eq('id', slot.id)
      if (error) throw error
      setSlots((prev) => prev.filter((s) => s.id !== slot.id))
      toast(t('slot_deleted'))
      onChanged()
    } catch (e) {
      handleError(e, toast, t)
    }
  }

  // ── live cost preview (sidebar) ─────────────────────────
  const memberCount = members.filter((m) => m.user_id !== club.owner_id).length + (hostName ? 1 : 0)
  const committedCount = pollTally?.count ?? null

  const livePreview = useMemo(() => {
    if (!slots.length) return null
    const totalCourtCost = slots.reduce((sum, slot) => {
      const r = computeSlot(slot)
      return sum + r.courtCost
    }, 0)
    let shuttleCost = 0
    let shuttleLabel = null
    if (sport.hasEquipment) {
      const { totalSessions: shuttleSessions } = estimateShuttle(slots, {
        ...form,
        shuttle_cycle_months: parseInt(form.shuttle_cycle_months, 10) || 1,
        shuttle_cycle_start_month: parseInt(form.shuttle_cycle_start_month, 10) || 1,
      })
      if (form.shuttle_mode === 'inventory') {
        const boxesLeft = num(form.shuttle_stock)
        const tubesPerSession = num(form.estimated_shuttlecocks) || 6
        const sessionsLeft = tubesPerSession > 0 ? Math.floor((boxesLeft * 12) / tubesPerSession) : 0
        const refillBoxes = sessionsLeft < shuttleSessions ? Math.ceil(((shuttleSessions - sessionsLeft) * tubesPerSession) / 12) : 0
        shuttleCost = refillBoxes > 0 ? refillBoxes * num(form.price_per_box) : 0
        const stockLine = `Tồn kho: ${boxesLeft} hộp · đủ ~${sessionsLeft} buổi`
        const refillLine = refillBoxes > 0 ? ` · cần nhập thêm ${refillBoxes} hộp` : ''
        shuttleLabel = stockLine + refillLine
      } else {
        const boxes = Math.ceil((shuttleSessions * num(form.estimated_shuttlecocks)) / 12)
        shuttleCost = boxes * num(form.price_per_box)
      }
    }

    const totalCost = totalCourtCost + shuttleCost
    const effective = form.fee_split_mode === 'committed_only' && committedCount ? committedCount : memberCount
    const perMember = effective > 0 ? Math.ceil(totalCost / effective) : 0
    return { totalCourtCost, shuttleCost, totalCost, perMember, effective, shuttleLabel }
  }, [slots, form, memberCount, committedCount, sport.hasEquipment])

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/* ── Card 1: Court slots ── */}
          <Card>
            <div className={cardTitleCls}>
              <MapPin className="h-5 w-5 text-slate-400" />
              <span>{t('slots_title')}</span>
            </div>
            <p className="mt-1 mb-5 text-sm text-slate-500">{t('slots_hint')}</p>

            {slots.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">{t('slot_empty')}</p>
            ) : (
              <div className="space-y-3 mb-5">
                {slots.map((slot) => (
                  <CourtSlotCard
                    key={slot.id || slot.sort_order}
                    slot={slot}
                    canEdit={canEdit}
                    lang={i18n.language}
                    t={t}
                    onEdit={() => setEditingSlot(slot)}
                    onDelete={() => deleteSlot(slot)}
                  />
                ))}
              </div>
            )}

            {canEdit && (
              <Button variant="subtle" size="sm" onClick={() => setEditingSlot({})}>
                <Plus className="h-4 w-4" /> {t('slot_add')}
              </Button>
            )}
          </Card>

          {/* ── Card 2: Global / shuttle / fund / guests ── */}
          <Card>
            <div className={cardTitleCls}>
              <Settings2 className="h-5 w-5 text-slate-400" />
              <span>{t('set_global_settings')}</span>
            </div>

            <div className={cx('mt-5 space-y-6', !canEdit && 'pointer-events-none opacity-70')}>
              {/* Shuttle section */}
              {sport.hasEquipment && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('shuttle_mode_title')}</p>
                  <Field label={t('shuttle_mode_title')} icon={Package}>
                    <Segmented
                      value={form.shuttle_mode}
                      onChange={(v) => setForm((f) => ({ ...f, shuttle_mode: v }))}
                      disabled={!canEdit}
                      options={[
                        { value: 'estimate', label: t('shuttle_mode_estimate') },
                        { value: 'inventory', label: t('shuttle_mode_inventory') },
                      ]}
                    />
                  </Field>
                  <p className="text-xs text-slate-400 italic -mt-2">
                    {form.shuttle_mode === 'estimate' ? t('shuttle_mode_estimate_hint') : t('shuttle_mode_inventory_hint')}
                  </p>

                  {form.shuttle_mode === 'estimate' ? (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t('set_box_price')} icon={Coins} hint={t('set_box_hint')}>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              className={cx(inputCls, 'pr-10 font-mono')}
                              value={fmtInputNum(form.price_per_box)}
                              disabled={!canEdit}
                              onChange={(e) => setForm((f) => ({ ...f, price_per_box: parseInputNum(e.target.value) }))}
                            />
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                              ₫
                            </span>
                          </div>
                        </Field>
                        <Field label={t('set_shuttle')} icon={Package} hint={t('set_shuttle_hint')}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            className={cx(inputCls, 'font-mono')}
                            value={form.estimated_shuttlecocks ?? ''}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => ({ ...f, estimated_shuttlecocks: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label={t('shuttle_cycle')}
                          icon={RefreshCw}
                          hint={cycleLabelShort(parseInt(form.shuttle_cycle_months, 10) || 1, i18n.language)}
                        >
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              max="12"
                              className={cx(inputCls, 'pr-16 font-mono')}
                              value={form.shuttle_cycle_months}
                              disabled={!canEdit}
                              onChange={(e) => setForm((f) => ({ ...f, shuttle_cycle_months: e.target.value }))}
                            />
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                              tháng
                            </span>
                          </div>
                        </Field>
                        {parseInt(form.shuttle_cycle_months, 10) > 1 && (
                          <Field label={t('shuttle_cycle_start')} icon={Calendar}>
                            <select
                              className={inputCls}
                              value={form.shuttle_cycle_start_month}
                              disabled={!canEdit}
                              onChange={(e) => setForm((f) => ({ ...f, shuttle_cycle_start_month: e.target.value }))}
                            >
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <option key={m} value={m}>
                                  {monthName(m, i18n.language)}
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="animate-fade-in space-y-3">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t('shuttle_stock')} icon={Package} hint={t('shuttle_stock_hint')}>
                          <input
                            type="number"
                            min="0"
                            className={cx(inputCls, 'font-mono')}
                            value={form.shuttle_stock ?? ''}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => ({ ...f, shuttle_stock: e.target.value }))}
                          />
                        </Field>
                        <Field label={t('set_shuttle_inventory')} icon={Package} hint={t('set_shuttle_inventory_hint')}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            className={cx(inputCls, 'font-mono')}
                            value={form.estimated_shuttlecocks ?? ''}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => ({ ...f, estimated_shuttlecocks: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <Field label={t('set_box_price')} icon={Coins} hint="Giá nhập hộp cầu — dùng khi cần tính chi phí nhập thêm">
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            className={cx(inputCls, 'pr-10 font-mono')}
                            value={fmtInputNum(form.price_per_box)}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => ({ ...f, price_per_box: parseInputNum(e.target.value) }))}
                          />
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                            ₫
                          </span>
                        </div>
                      </Field>
                      {canEdit && (
                        <Button variant="subtle" size="sm" onClick={() => setRestockOpen((v) => !v)}>
                          <Plus className="h-4 w-4" /> {t('shuttle_restock')}
                        </Button>
                      )}
                      {restockOpen && canEdit && (
                        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 space-y-3 animate-fade-in">
                          <p className="text-xs font-semibold text-slate-600">{t('shuttle_restock')}</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                className={cx(inputCls, 'font-mono bg-white')}
                                placeholder={t('shuttle_restock_boxes')}
                                value={restockBoxes}
                                onChange={(e) => setRestockBoxes(e.target.value)}
                              />
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="numeric"
                                className={cx(inputCls, 'pr-10 font-mono bg-white')}
                                placeholder={t('shuttle_restock_price')}
                                value={fmtInputNum(restockPrice)}
                                onChange={(e) => setRestockPrice(parseInputNum(e.target.value))}
                              />
                              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                                ₫
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="volt" size="sm" className="flex-1" onClick={submitRestock} disabled={restockBusy || !restockBoxes}>
                              {restockBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="h-4 w-4" /> {t('shuttle_restock_submit')}
                                </>
                              )}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setRestockOpen(false)}>
                              {t('cancel')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Fund */}
              <div>
                <label className="block">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                    <Wallet className="w-4 h-4 text-slate-400" />
                    {t('set_fund')}
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
                      type="text"
                      inputMode="numeric"
                      className={cx(inputCls, 'pr-10 font-mono')}
                      value={fmtInputNum(form.current_fund)}
                      disabled={!canEdit}
                      onChange={(e) => setForm((f) => ({ ...f, current_fund: parseInputNum(e.target.value) }))}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                  </div>
                </label>
                {topUpOpen && canEdit && (
                  <div className="mt-2 rounded-2xl border border-lime-200 bg-lime-50 p-4 space-y-3 animate-fade-in">
                    <p className="text-xs font-semibold text-slate-600">{t('fund_topup_title')}</p>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        className={cx(inputCls, 'pr-10 font-mono bg-white')}
                        placeholder={t('fund_topup_amount_ph')}
                        value={fmtInputNum(topUpAmount)}
                        autoFocus
                        onChange={(e) => setTopUpAmount(parseInputNum(e.target.value))}
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
                        {topUpBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-4 w-4" /> {t('fund_topup_submit')}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTopUpOpen(false)
                          setTopUpAmount('')
                          setTopUpNote('')
                        }}
                      >
                        {t('cancel')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* First-time mid-cycle fund setup */}
                {isFirstSetup && slots.length > 0 && num(form.price_per_box) > 0 && num(form.estimated_shuttlecocks) > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3 animate-fade-in">
                    <p className="text-xs font-bold text-amber-800">{t('fund_setup_title')}</p>
                    {actualSpent > 0 && <p className="text-xs text-amber-700">{t('fund_setup_hint', { amount: fmtVND(actualSpent) })}</p>}
                    <div className="space-y-2">
                      {[
                        { val: 'from_now', labelKey: 'fund_setup_from_now', hintKey: 'fund_setup_from_now_hint' },
                        { val: 'from_start', labelKey: 'fund_setup_from_start', hintKey: 'fund_setup_from_start_hint' },
                      ].map(({ val, labelKey, hintKey }) => (
                        <button
                          key={val}
                          onClick={() => setFundSetupMode(val)}
                          className={cx(
                            'w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.98]',
                            fundSetupMode === val ? 'border-amber-400 bg-white' : 'border-amber-200 bg-white/60 hover:border-amber-300'
                          )}
                        >
                          <span
                            className={cx(
                              'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition',
                              fundSetupMode === val ? 'border-amber-500 bg-amber-500' : 'border-amber-300'
                            )}
                          >
                            {fundSetupMode === val && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{t(labelKey)}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{t(hintKey)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fee split mode */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{t('fee_split_title')}</p>
                <Field label={t('fee_split_title')} icon={UserCheck} hint={t('fee_split_hint')}>
                  <Segmented
                    value={form.fee_split_mode}
                    onChange={(v) => setForm((f) => ({ ...f, fee_split_mode: v }))}
                    disabled={!canEdit}
                    options={[
                      { value: 'committed_only', label: t('fee_split_committed') },
                      { value: 'total_members', label: t('fee_split_total') },
                    ]}
                  />
                </Field>
                <p className="mt-2 text-xs text-slate-400 italic">
                  {form.fee_split_mode === 'committed_only' ? t('fee_split_committed_hint') : t('fee_split_total_hint')}
                </p>
              </div>

              {/* Guest fee mode */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{t('set_guest_mode')}</p>
                <Field label={t('set_guest_mode')} icon={Users}>
                  <Segmented
                    value={form.guest_fee_mode}
                    onChange={(v) => setForm((f) => ({ ...f, guest_fee_mode: v }))}
                    disabled={!canEdit}
                    options={[
                      { value: 'split_all', label: t('set_guest_mode_split') },
                      { value: 'fixed_by_gender', label: t('set_guest_mode_fixed') },
                      { value: 'split_shuttle', label: t('set_guest_mode_shuttle') },
                    ]}
                  />
                </Field>
                <p className="mt-2 text-xs text-slate-400 italic">
                  {form.guest_fee_mode === 'fixed_by_gender' && t('set_guest_fee_mode_hint_fixed')}
                  {form.guest_fee_mode === 'split_shuttle' && t('set_guest_fee_mode_hint_shuttle')}
                  {form.guest_fee_mode === 'split_all' && t('set_guest_fee_mode_hint_split')}
                </p>
                {(form.guest_fee_mode === 'fixed_by_gender' || form.guest_fee_mode === 'split_shuttle') && (
                  <div className="grid gap-4 sm:grid-cols-2 mt-4 animate-fade-in">
                    {form.guest_fee_mode === 'fixed_by_gender' && (
                      <Field label={t('set_guest_fee_male')} icon={Coins}>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            className={cx(inputCls, 'pr-10 font-mono')}
                            value={fmtInputNum(form.guest_fee_male)}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => ({ ...f, guest_fee_male: parseInputNum(e.target.value) }))}
                          />
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                            ₫
                          </span>
                        </div>
                      </Field>
                    )}
                    <Field label={t('set_guest_fee_female')} icon={Coins}>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          className={cx(inputCls, 'pr-10 font-mono')}
                          value={fmtInputNum(form.guest_fee_female)}
                          disabled={!canEdit}
                          onChange={(e) => setForm((f) => ({ ...f, guest_fee_female: parseInputNum(e.target.value) }))}
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                      </div>
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {canEdit && (
            <Button variant="primary" size="lg" className="w-full" onClick={save} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> {t('saving')}
                </>
              ) : (
                <>
                  {t('save')} <Check className="h-5 w-5 text-lime-400" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">
          <Card>
            <div className={cardTitleCls}>
              <TrendingUp className="h-5 w-5 text-slate-400" />
              <span>{t('set_cost_preview_title')}</span>
            </div>
            <p className="mt-1 mb-4 text-xs text-slate-500">{t('set_cost_preview_sub')}</p>

            {!livePreview ? (
              <p className="text-sm text-slate-400 text-center py-4">{t('slot_empty')}</p>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('timeline_court_cost')}</span>
                  <span className="font-mono font-semibold text-slate-900">{fmtVND(livePreview.totalCourtCost)}</span>
                </div>
                {sport.hasEquipment && (
                  <div className="flex justify-between items-start gap-2 text-sm">
                    <span className="text-slate-500 shrink-0">{t('set_cost_shuttle')}</span>
                    <span className="text-right">
                      {livePreview.shuttleLabel && <span className="block text-xs font-semibold text-cyan-700">{livePreview.shuttleLabel}</span>}
                      {livePreview.shuttleCost > 0 && (
                        <span className="font-mono font-semibold text-slate-900">{fmtVND(livePreview.shuttleCost)}</span>
                      )}
                      {livePreview.shuttleLabel && livePreview.shuttleCost === 0 && <span className="font-mono font-semibold text-slate-400">—</span>}
                    </span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between">
                  <span className="text-sm font-bold text-slate-800">{t('set_cost_total')}</span>
                  <span className="font-mono text-base font-black text-slate-900">{fmtVND(livePreview.totalCost)}</span>
                </div>
                {livePreview.effective > 0 && (
                  <div className="flex justify-between rounded-xl bg-lime-400/20 px-3 py-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {t('set_cost_per_member')} ({livePreview.effective} {t('members')})
                    </span>
                    <span className="font-mono text-sm font-black text-slate-900">{fmtVND(livePreview.perMember)}</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          <MembersPanel
            club={club}
            members={members}
            plan={plan}
            pollTally={pollTally}
            hostName={hostName}
            hostAvatar={hostAvatar}
            currentUserId={currentUserId}
            canEdit={canEdit}
            onChanged={onChanged}
            onHitLimit={onHitLimit}
            toast={toast}
          />

          <PayOSSettings
            club={club}
            plan={plan}
            payosConfig={payosConfig}
            canEdit={canEdit}
            onChanged={onChanged}
            toast={toast}
            onUnlock={() => {}}
          />
        </div>
      </div>

      {/* Court slot modal */}
      {editingSlot !== null && <CourtSlotModal slot={editingSlot?.id ? editingSlot : null} onSave={saveSlot} onClose={() => setEditingSlot(null)} />}
    </>
  )
}
