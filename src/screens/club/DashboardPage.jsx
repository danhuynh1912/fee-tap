import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal, Plus, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { handleError } from '../../lib/handleError'
import { cx, fmtInputNum, parseInputNum } from '../../lib/utils'
import { inputCls } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Switch } from '../../components/ui/Toggle'
import { DashboardConfigDrawer } from '../../components/club/DashboardConfigDrawer'
import { MembersPanel } from './MembersPanel'
import { PaymentTimeline } from '../../components/club/PaymentTimeline'
import { HeroCard } from '../../components/club/HeroCard'
import { DeficitCallout } from '../../components/club/DeficitCallout'
import { CostByCycleBreakdown } from '../../components/club/CostByCycleBreakdown'
import { SpentBreakdownModal } from '../../components/club/SpentBreakdownModal'
import { AdvancedForecast } from '../../components/club/AdvancedForecast'
import { computeAll, getSessionConfigs, periodDateRange, computeShuttleStock } from '../../engine/forecast'
import { ShuttleTubeWidget } from '../../components/club/ShuttleTubeWidget'
import { num } from '../../lib/utils'
import { BALLS_PER_BOX, SPORT_CONFIGS } from '../../constants'
import { useClub } from '../../contexts/ClubContext'

// ─── restock modal ────────────────────────────────────────────────────────────
function RestockModal({ club, settings, liveFundBalance, shuttleStatus, onClose, onDone, toast }) {
  const { t } = useTranslation()
  const [unit, setUnit] = useState('boxes') // 'boxes' | 'balls'
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState(settings.price_per_box ?? 320000)
  const [note, setNote] = useState('')
  const [useFund, setUseFund] = useState(true)
  const [busy, setBusy] = useState(false)

  const isBalls = unit === 'balls'
  const qtyNum = parseInt(qty, 10) || 0
  const totalCost = !isBalls && useFund ? qtyNum * num(price) : 0
  const fundInsufficient = useFund && !isBalls && qtyNum > 0 && totalCost > liveFundBalance

  async function submit() {
    if (!qtyNum || (isBalls ? qtyNum === 0 : qtyNum < 1) || busy) return
    setBusy(true)
    try {
      const delta = isBalls ? qtyNum : qtyNum * BALLS_PER_BOX
      const noteStr = note.trim() || (isBalls ? `Thêm ${qtyNum} quả cầu` : `Nhập ${qtyNum} hộp cầu`)

      // If projected stock is negative, those unlogged sessions consumed balls that were never
      // formally recorded. Insert a settlement adjustment so currentStock reflects reality
      // before the new restock — otherwise the new anchor resets the look-back window and
      // the prior consumption debt disappears.
      const projectedStock = shuttleStatus?.projectedStock ?? 0
      const currentStock = shuttleStatus?.currentStock ?? 0
      const debt = currentStock - projectedStock  // balls consumed but not yet in DB
      if (!isBalls && debt > 0) {
        await supabase.from('shuttle_transactions').insert({
          club_id: club.id,
          delta: -debt,
          source: 'estimated',
          note: 'Quyết toán cầu ước tính trước khi nhập kho',
          rate_used: num(settings.estimated_shuttlecocks),
        })
      }

      if (isBalls || !useFund) {
        await supabase.from('shuttle_transactions').insert({
          club_id: club.id, delta, source: isBalls ? 'adjustment' : 'restock', note: noteStr,
          rate_used: num(settings.estimated_shuttlecocks),
        })
      } else {
        await Promise.all([
          supabase.from('shuttle_transactions').insert({
            club_id: club.id, delta, source: 'restock', note: noteStr,
            rate_used: num(settings.estimated_shuttlecocks),
          }),
          supabase.from('fund_transactions').insert({
            club_id: club.id, amount: -totalCost, note: noteStr, type: 'shuttle_purchase',
          }),
        ])
      }
      toast(t('shuttle_restock_submit'))
      onDone()
      onClose()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} maxW="max-w-sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{t('shuttle_restock')}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-semibold">
          {[['boxes', t('shuttle_box_unit')], ['balls', t('shuttle_ball_unit')]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => { setUnit(val); setQty('') }}
              className={cx('flex-1 py-2 transition', unit === val ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          <input
            type="number" min="1" autoFocus
            className={inputCls + ' font-mono'}
            placeholder={isBalls ? t('shuttle_qty_balls_ph') : t('shuttle_restock_boxes')}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          {!isBalls && (
            <div className="relative">
              <input
                type="text" inputMode="numeric"
                className={inputCls + ' pr-10 font-mono'}
                placeholder={t('shuttle_restock_price')}
                value={fmtInputNum(price)}
                onChange={(e) => setPrice(parseInputNum(e.target.value))}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
            </div>
          )}
          <input
            className={inputCls}
            placeholder={t('shuttle_restock_note_ph')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {!isBalls && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
            <Switch
              checked={useFund}
              onChange={setUseFund}
              label={t('restock_use_fund')}
            />
            {useFund && qtyNum > 0 && (
              fundInsufficient ? (
                <p className="text-xs font-semibold text-red-600">
                  {t('restock_fund_insufficient', { amount: fmtInputNum(String(Math.round(liveFundBalance))) })}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  {qtyNum} {t('shuttle_box_unit')} × {fmtInputNum(price)} ₫ = <span className="font-mono font-bold text-slate-700">{fmtInputNum(String(totalCost))} ₫</span>
                </p>
              )
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="volt" className="flex-1" onClick={submit} disabled={busy || !qtyNum || fundInsufficient}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> {t('shuttle_restock_submit')}</>}
          </Button>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── forecast orchestrator ────────────────────────────────────────────────────
function ForecastDashboard({
  settings,
  slots,
  memberCount,
  committedCount,
  plan,
  sport,
  canEdit,
  onUnlock,
  logs,
  fundTxns,
  shuttleTxns,
  sections: sectionsProp,
  collections,
  memberPayments,
  currentMemberId,
  payosConfigured,
  members,
  clubId,
  toast,
  onChanged,
  liveFundBalance,
  pollTally,
  club,
  user,
  onRestock,
}) {
  const { t } = useTranslation()
  const hasEquipment = sport?.hasEquipment ?? true
  const [spentTipOpen, setSpentTipOpen] = useState(false)
  const [sections, setSections] = useState(() => sectionsProp || {})

  useEffect(() => {
    setSections(sectionsProp || {})
  }, [sectionsProp])

  const DEFAULT_SECTIONS = {
    running_slots: false,
    cost_by_cycle: false,
    deficit_callout: false,
    carryover_row: false,
  }
  const show = (key) => (key in sections ? sections[key] !== false : (DEFAULT_SECTIONS[key] ?? true))

  const all = useMemo(() => computeAll(settings, memberCount, hasEquipment, new Date(), slots), [settings, slots, memberCount, hasEquipment])
  const sessionConfigs = useMemo(() => getSessionConfigs(settings), [settings])

  const shuttleStatus = useMemo(
    () => (hasEquipment ? computeShuttleStock(shuttleTxns || [], slots, settings, logs || []) : null),
    [hasEquipment, shuttleTxns, slots, settings, logs]
  )

  // Shuttle purchases that hit the fund this period (for actualSpent tracking)
  const shuttleTxnsInPeriod = useMemo(() => {
    if (!hasEquipment || !fundTxns?.length) return 0
    const ranges = all.venues.filter((v) => v.period).map((v) => periodDateRange(v.period))
    if (!ranges.length) return 0
    const periodStart = ranges.reduce((min, r) => (r.start < min ? r.start : min), ranges[0].start)
    const periodEnd = ranges.reduce((max, r) => (r.end > max ? r.end : max), ranges[0].end)
    return fundTxns
      .filter((tx) => tx.type === 'shuttle_purchase' && tx.created_at >= periodStart && tx.created_at <= periodEnd + 'T23:59:59')
      .reduce((s, tx) => s + Math.abs(num(tx.amount)), 0)
  }, [hasEquipment, fundTxns, all.venues])

  const { actualSpent, spentBreakdown } = useMemo(
    () =>
      all.venues.reduce(
        (acc, v) => {
          if (v.weekday === null || v.weekday === undefined) return acc
          const { start, end } = periodDateRange(v.period)
          const wd = Number(v.weekday)
          const venueLogs = (logs || []).filter(
            (l) => l.played_on >= start && l.played_on <= end && new Date(l.played_on + 'T12:00:00').getDay() === wd
          )
          const loggedCount = venueLogs.length
          const estimatedCount = Math.max(0, v.happened - loggedCount)
          const venueLabel = [v.name, v.venue_name].filter(Boolean).join(' · ') || v.weekday?.toString()

          // Shuttle consumption cost (per session, not per restock)
          const pricePerBox = num(settings.price_per_box)
          const estRate = num(settings.estimated_shuttlecocks)
          let shuttleActual = 0
          let shuttleEst = 0
          if (hasEquipment && pricePerBox > 0 && estRate > 0) {
            shuttleActual = venueLogs.reduce((s, l) => {
              const balls = num(l.actual_shuttlecocks) || estRate
              return s + (balls / BALLS_PER_BOX) * pricePerBox
            }, 0)
            shuttleEst = estimatedCount * (estRate / BALLS_PER_BOX) * pricePerBox
          }

          if (v.court_payment_mode === 'cycle') {
            const total = v.courtCost + shuttleActual + shuttleEst
            acc.actualSpent += total
            acc.spentBreakdown.push({
              label: venueLabel,
              courtCost: v.courtCost,
              shuttleActual,
              shuttleEst,
              loggedCount,
              estimatedCount,
              total,
              isCycle: true,
            })
          } else {
            const sc = sessionConfigs.find((c) => c.weekday === v.weekday) || {}
            const courtPerSession = num(sc.court_price_per_hour) * num(sc.hours_per_session)
            const courtActual = venueLogs.reduce((s, l) => s + num(l.court_cost), 0)
            const courtEst = estimatedCount * courtPerSession
            const total = courtActual + courtEst + shuttleActual + shuttleEst
            acc.actualSpent += total
            acc.spentBreakdown.push({
              label: venueLabel,
              costActual: courtActual,
              costEst: courtEst,
              shuttleActual,
              shuttleEst,
              loggedCount,
              estimatedCount,
              total,
              isCycle: false,
            })
          }
          return acc
        },
        { actualSpent: 0, spentBreakdown: [] }
      ),
    [all.venues, logs, sessionConfigs, settings, hasEquipment]
  )

  const totalActualSpent = actualSpent

  const remainingForecast = useMemo(() => {
    const rate = num(settings.estimated_shuttlecocks) || 0
    const totalBallsLeft = shuttleStatus?.totalBalls ?? 0
    const totalSessionsLeft = all.venues.reduce((s, v) => s + Math.max(0, v.totalSessions - v.happened), 0)
    const shuttleSessionsLeft = rate > 0 ? Math.floor(totalBallsLeft / rate) : Infinity
    const shortfallSessions = Math.max(0, totalSessionsLeft - shuttleSessionsLeft)
    const shuttleRefillBoxes = shortfallSessions > 0 ? Math.ceil((shortfallSessions * rate) / BALLS_PER_BOX) : 0
    const shuttleRefillCost = hasEquipment ? shuttleRefillBoxes * num(settings.price_per_box) : 0

    const courtRemaining = all.venues.reduce((total, v) => {
      const remaining = Math.max(0, v.totalSessions - v.happened)
      if (v.court_payment_mode === 'cycle') return total
      const sc = sessionConfigs.find((c) => c.weekday === v.weekday) || {}
      return total + remaining * (num(sc.court_price_per_hour) * num(sc.hours_per_session))
    }, 0)
    return courtRemaining + shuttleRefillCost
  }, [all.venues, sessionConfigs, settings, hasEquipment, shuttleStatus])

  const projectedBalance = all.fund - totalActualSpent - remainingForecast
  const projectedSurplus = projectedBalance >= 0
  const projectedDeficit = projectedSurplus ? 0 : -projectedBalance
  const perMemberTopUp = memberCount > 0 ? Math.ceil(projectedDeficit / memberCount) : 0

  const { totalCollected, txCount } = useMemo(() => {
    const ranges = all.venues.filter((v) => v.period).map((v) => periodDateRange(v.period))
    if (!ranges.length) return { totalCollected: 0, txCount: 0 }
    const periodStart = ranges.reduce((min, r) => (r.start < min ? r.start : min), ranges[0].start)
    const periodEnd = ranges.reduce((max, r) => (r.end > max ? r.end : max), ranges[0].end)
    const inPeriod = (fundTxns || []).filter((tx) => num(tx.amount) > 0 && tx.created_at >= periodStart && tx.created_at <= periodEnd + 'T23:59:59')
    return {
      totalCollected: inPeriod.reduce((s, tx) => s + num(tx.amount), 0),
      txCount: inPeriod.length,
    }
  }, [fundTxns, all.venues])

  const sessionProgress = all.uniqueScheduled > 0 ? Math.min(1, all.uniqueHappened / all.uniqueScheduled) : 0
  const nextAdjustedFee = memberCount > 0 ? Math.ceil(Math.max(0, all.nextTotalCost - projectedBalance) / memberCount) : 0

  return (
    <div className="space-y-5">
      <HeroCard
        all={{ ...all, memberCount }}
        liveFundBalance={liveFundBalance}
        totalActualSpent={totalActualSpent}
        totalCollected={totalCollected}
        txCount={txCount}
        remainingForecast={remainingForecast}
        projectedBalance={projectedBalance}
        projectedSurplus={projectedSurplus}
        sessionProgress={sessionProgress}
        show={show}
        canEdit={canEdit}
        onSpentTipOpen={() => setSpentTipOpen(true)}
      />

      {show('deficit_callout') && canEdit && (
        <DeficitCallout
          projectedSurplus={projectedSurplus}
          projectedBalance={projectedBalance}
          projectedDeficit={projectedDeficit}
          perMemberTopUp={perMemberTopUp}
          memberCount={memberCount}
        />
      )}

      {show('venue_cards') && (
        <PaymentTimeline
          slots={slots || []}
          settings={settings}
          memberCount={memberCount}
          committedCount={committedCount}
          sport={sport}
          showRunning={show('running_slots')}
          canEdit={canEdit}
          nextAdjustedFee={show('carryover_row') ? nextAdjustedFee : 0}
          projectedBalance={projectedBalance}
          projectedSurplus={projectedSurplus}
          collections={collections || []}
          memberPayments={memberPayments || []}
          currentMemberId={currentMemberId}
          payosConfigured={payosConfigured}
          plan={plan}
          members={members || []}
          clubId={clubId}
          toast={toast}
          onReload={onChanged}
          pollTally={pollTally}
          cycleVoteProps={club ? { club, members: members || [], settings, slots: slots || [], canEdit, user } : null}
        />
      )}

      {show('cost_by_cycle') && <CostByCycleBreakdown all={all} logs={logs} settings={settings} hasEquipment={hasEquipment} />}

      <AdvancedForecast totalMonthlyCost={all.totalMonthlyCost} plan={plan} canEdit={canEdit} onUnlock={onUnlock} />

      <SpentBreakdownModal
        open={spentTipOpen}
        onClose={() => setSpentTipOpen(false)}
        spentBreakdown={spentBreakdown}
        totalActualSpent={totalActualSpent}
      />
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────
export function DashboardPage({ toast }) {
  const { t } = useTranslation()
  const {
    club,
    settings,
    slots,
    members,
    logs,
    fundTxns,
    shuttleTxns,
    collections,
    memberPayments,
    currentMemberId,
    payosConfigured,
    pollTally,
    plan,
    sport,
    hostName,
    hostAvatar,
    currentUserId,
    canEdit,
    session,
    reload,
    openUpsell,
    closeSidebar,
    liveFundBalance,
  } = useClub()

  const memberCount = members.filter((m) => m.user_id !== club.owner_id).length + 1
  const committedCount = pollTally?.count ?? null
  const [configOpen, setConfigOpen] = useState(false)
  const [sectionsOverride, setSectionsOverride] = useState(null)
  const [restockOpen, setRestockOpen] = useState(false)
  const effectiveSections = sectionsOverride ?? settings?.dashboard_sections ?? {}
  const hasEquipment = sport?.hasEquipment ?? true
  const shuttleStatus = useMemo(
    () => (hasEquipment ? computeShuttleStock(shuttleTxns || [], slots, settings, logs || []) : null),
    [hasEquipment, shuttleTxns, slots, settings, logs]
  )

  return (
    <div className="relative grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {canEdit && (
          <div className="flex justify-end mb-3">
            <button
              onClick={() => {
                setSectionsOverride(settings?.dashboard_sections ?? {})
                closeSidebar()
                setConfigOpen(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-900 transition active:scale-95"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> {t('dash_config_btn')}
            </button>
          </div>
        )}
        <ForecastDashboard
          settings={settings}
          slots={slots}
          memberCount={memberCount}
          committedCount={committedCount}
          plan={plan}
          sport={sport}
          canEdit={canEdit}
          onUnlock={openUpsell}
          logs={logs}
          fundTxns={fundTxns}
          shuttleTxns={shuttleTxns}
          sections={effectiveSections}
          collections={collections}
          memberPayments={memberPayments}
          currentMemberId={currentMemberId}
          payosConfigured={payosConfigured}
          members={members}
          clubId={club.id}
          toast={toast}
          onChanged={reload}
          liveFundBalance={liveFundBalance}
          pollTally={pollTally}
          club={club}
          user={session?.user}
          onRestock={() => setRestockOpen(true)}
        />
      </div>

      <div className="space-y-6">
        {hasEquipment && shuttleStatus && (
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-900/[0.03]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base font-bold text-slate-900">🏸 {t('shuttle_stock_title')}</span>
            </div>
            <ShuttleTubeWidget
              shuttleStatus={shuttleStatus}
              onRestock={() => setRestockOpen(true)}
              canEdit={canEdit}
            />
          </div>
        )}
        <MembersPanel
          club={club}
          members={members}
          plan={plan}
          hostName={hostName}
          hostAvatar={hostAvatar}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onChanged={reload}
          onHitLimit={openUpsell}
          toast={toast}
        />
      </div>

      {restockOpen && canEdit && (
        <RestockModal
          club={club}
          settings={settings}
          liveFundBalance={liveFundBalance}
          shuttleStatus={shuttleStatus}
          toast={toast}
          onClose={() => setRestockOpen(false)}
          onDone={reload}
        />
      )}

      {canEdit && (
        <DashboardConfigDrawer
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          clubId={club.id}
          sections={effectiveSections}
          venueCount={settings.play_weekdays?.length ?? 1}
          onSaved={(updated) => {
            setSectionsOverride(updated)
            reload()
          }}
          onLiveChange={setSectionsOverride}
        />
      )}
    </div>
  )
}
