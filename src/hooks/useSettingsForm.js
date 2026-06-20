import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { handleError } from '../lib/handleError'
import { num } from '../lib/utils'
import { computeSlot, projectUpcomingCollections, buildSettleInserts } from '../engine/forecast'
import { BALLS_PER_BOX } from '../constants'

export function useSettingsForm({ club, settings, initialSlots, shuttleTxns, fundTxns, logs, members, pollTally, hostName, sport, canEdit, toast, reload, setSettings, openUpsell }) {
  const { t } = useTranslation()

  // ── global form ──────────────────────────────────────────
  const [form, setForm] = useState({
    price_per_box: settings.price_per_box ?? 320000,
    estimated_shuttlecocks: settings.estimated_shuttlecocks ?? 6,
    current_fund: settings.current_fund ?? 0,
    shuttle_cycle_months: settings.shuttle_cycle_months ?? 1,
    shuttle_cycle_start_month: settings.shuttle_cycle_start_month ?? 1,
    fee_split_mode: settings.fee_split_mode ?? 'committed_only',
    guest_fee_mode: settings.guest_fee_mode ?? 'split_all',
    guest_fee_male: settings.guest_fee_male ?? 0,
    guest_fee_female: settings.guest_fee_female ?? 0,
    fixed_cycle_months: settings.fixed_cycle_months ?? '',
  })
  const [busy, setBusy] = useState(false)

  // ── top-up ───────────────────────────────────────────────
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpNote, setTopUpNote] = useState('')
  const [topUpBusy, setTopUpBusy] = useState(false)

  // ── restock shuttle ──────────────────────────────────────
  const [restockOpen, setRestockOpen] = useState(false)
  const [restockUnit, setRestockUnit] = useState('boxes') // 'boxes' | 'balls'
  const [restockBoxes, setRestockBoxes] = useState('')
  const [restockPrice, setRestockPrice] = useState(settings.price_per_box ?? 320000)
  const [restockBusy, setRestockBusy] = useState(false)
  const [restockNote, setRestockNote] = useState('')

  // ── slot modal ───────────────────────────────────────────
  const [slots, setSlots] = useState(initialSlots || [])
  const [editingSlot, setEditingSlot] = useState(null) // null=closed, {}=new, slot=edit
  const [slotBusy, setSlotBusy] = useState(false)

  // ── fund setup (first-time mid-cycle) ────────────────────
  const [fundSetupMode, setFundSetupMode] = useState(null) // null | 'from_now' | 'from_start'

  // ── derived ──────────────────────────────────────────────
  const isFirstSetup = canEdit && Array.isArray(fundTxns) && fundTxns.length === 0
  const memberCount = members.filter((m) => m.user_id !== club.owner_id).length + (hostName ? 1 : 0)
  const committedCount = pollTally?.count ?? null

  const actualSpent = useMemo(() => {
    if (!isFirstSetup || !initialSlots?.length) return 0
    const now = new Date()
    const shuttlePerSession = (num(form.estimated_shuttlecocks) * num(form.price_per_box)) / BALLS_PER_BOX
    return initialSlots.reduce((total, slot) => {
      const { happened, courtCost } = computeSlot(slot, now)
      if (slot.payment_mode === 'cycle') {
        return total + courtCost + happened * shuttlePerSession
      }
      const courtPerSession = num(slot.price_per_hour) * num(slot.hours_per_session)
      return total + happened * (courtPerSession + shuttlePerSession)
    }, 0)
  }, [isFirstSetup, initialSlots, form.price_per_box, form.estimated_shuttlecocks])

  const effective = form.fee_split_mode === 'committed_only' && committedCount ? committedCount : memberCount

  const upcomingCollections = useMemo(() => {
    if (!slots.length) return []
    return projectUpcomingCollections(slots, form)
  }, [slots, form])

  // ── actions ──────────────────────────────────────────────
  async function save() {
    if (!canEdit || busy) return
    setBusy(true)
    try {
      // Settle unlogged past sessions at OLD rate before saving new rate
      const oldRate = num(settings.estimated_shuttlecocks)
      const newRate = num(form.estimated_shuttlecocks)
      if (sport.hasEquipment && newRate !== oldRate && oldRate > 0) {
        const settleInserts = buildSettleInserts(shuttleTxns || [], slots, logs || [], club.id, oldRate)
        if (settleInserts.length > 0) {
          await supabase.from('shuttle_transactions').insert(settleInserts)
        }
      }

      const firstSlot = slots[0]
      const payload = {
        club_id: club.id,
        price_per_box: num(form.price_per_box),
        estimated_shuttlecocks: num(form.estimated_shuttlecocks),
        current_fund: num(form.current_fund),
        shuttle_cycle_months: Math.max(1, parseInt(form.shuttle_cycle_months, 10) || 1),
        shuttle_cycle_start_month: Math.max(1, Math.min(12, parseInt(form.shuttle_cycle_start_month, 10) || 1)),
        fee_split_mode: form.fee_split_mode,
        guest_fee_mode: form.guest_fee_mode,
        guest_fee_male: num(form.guest_fee_male),
        guest_fee_female: num(form.guest_fee_female),
        fixed_cycle_months: form.fixed_cycle_months !== '' ? Math.max(1, parseInt(form.fixed_cycle_months, 10) || 1) : null,
        // backward-compat legacy columns — keep DB happy
        court_price_per_hour: firstSlot ? num(firstSlot.price_per_hour) : num(settings.court_price_per_hour) || 0,
        hours_per_session: firstSlot ? num(firstSlot.hours_per_session) : num(settings.hours_per_session) || 2,
        court_payment_mode: firstSlot?.payment_mode ?? settings.court_payment_mode ?? 'session',
        play_weekdays: firstSlot?.weekdays ?? settings.play_weekdays ?? [],
        sessions_per_week: slots.reduce((sum, s) => sum + (s.weekdays?.length || 0), 0) || settings.sessions_per_week || 0,
      }
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
      setSettings((s) => ({ ...s, ...payload }))
    } catch (e) {
      handleError(e, toast, t)
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
      setSettings((s) => ({ ...s, current_fund: newFund }))
      reload()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setTopUpBusy(false)
    }
  }

  async function submitRestock() {
    const qty = num(restockBoxes)
    const price = num(restockPrice)
    if (!qty || restockBusy) return
    setRestockBusy(true)
    const isBalls = restockUnit === 'balls'
    try {
      const delta = isBalls ? qty : qty * BALLS_PER_BOX
      const note = restockNote.trim() || (isBalls ? `Thêm ${qty} quả cầu` : `Nhập ${qty} hộp cầu`)
      if (isBalls) {
        await supabase.from('shuttle_transactions').insert({
          club_id: club.id, delta, source: 'adjustment', note,
          rate_used: num(form.estimated_shuttlecocks),
        })
      } else {
        const totalCost = qty * price
        const newFund = num(settings.current_fund) - totalCost
        await Promise.all([
          supabase.from('shuttle_transactions').insert({
            club_id: club.id, delta, source: 'restock', note,
            rate_used: num(form.estimated_shuttlecocks),
          }),
          supabase.from('fund_transactions').insert({
            club_id: club.id, amount: -totalCost, note, type: 'shuttle_purchase',
          }),
          supabase.from('club_settings').update({ current_fund: newFund, price_per_box: price }).eq('club_id', club.id),
        ])
        setForm((f) => ({ ...f, price_per_box: price }))
      }
      toast(t('shuttle_restock_submit'))
      setRestockBoxes('')
      setRestockNote('')
      setRestockOpen(false)
      reload()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setRestockBusy(false)
    }
  }

  async function saveSlot(data) {
    if (slotBusy) return
    setSlotBusy(true)
    try {
      if (!Array.isArray(data) && data.id) {
        const { error } = await supabase.from('court_slots').update({ ...data, club_id: club.id }).eq('id', data.id)
        if (error) throw error
        setSlots((prev) => prev.map((s) => (s.id === data.id ? { ...s, ...data } : s)))
        toast(t('slot_saved'))
      } else {
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
      reload()
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
      reload()
    } catch (e) {
      handleError(e, toast, t)
    }
  }

  return {
    // global form
    form, setForm, busy, save,
    // top-up
    topUpOpen, setTopUpOpen,
    topUpAmount, setTopUpAmount,
    topUpNote, setTopUpNote,
    topUpBusy, submitTopUp,
    // restock
    restockOpen, setRestockOpen,
    restockUnit, setRestockUnit,
    restockBoxes, setRestockBoxes,
    restockPrice, setRestockPrice,
    restockNote, setRestockNote,
    restockBusy, submitRestock,
    // slots
    slots, setSlots,
    editingSlot, setEditingSlot,
    slotBusy, saveSlot, deleteSlot,
    // fund setup
    fundSetupMode, setFundSetupMode,
    isFirstSetup, actualSpent,
    // derived
    upcomingCollections, effective, memberCount, committedCount,
  }
}
