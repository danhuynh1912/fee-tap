import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import { DashboardConfigDrawer } from '../../components/club/DashboardConfigDrawer'
import { MembersPanel } from './MembersPanel'
import { PaymentTimeline } from '../../components/club/PaymentTimeline'
import { HeroCard } from '../../components/club/HeroCard'
import { BaseFeeCard } from '../../components/club/BaseFeeCard'
import { DeficitCallout } from '../../components/club/DeficitCallout'
import { CostByCycleBreakdown } from '../../components/club/CostByCycleBreakdown'
import { SpentBreakdownModal } from '../../components/club/SpentBreakdownModal'
import { AdvancedForecast } from '../../components/club/AdvancedForecast'
import { computeAll, getSessionConfigs, periodDateRange } from '../../engine/forecast'
import { num } from '../../lib/utils'
import { BALLS_PER_BOX } from '../../constants'
import { useClub } from '../../contexts/ClubContext'

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
}) {
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
  const isInventory = hasEquipment && settings.shuttle_mode === 'inventory'

  const shuttleTxnsInPeriod = useMemo(() => {
    if (!isInventory || !fundTxns?.length) return 0
    const ranges = all.venues.filter((v) => v.period).map((v) => periodDateRange(v.period))
    if (!ranges.length) return 0
    const periodStart = ranges.reduce((min, r) => (r.start < min ? r.start : min), ranges[0].start)
    const periodEnd = ranges.reduce((max, r) => (r.end > max ? r.end : max), ranges[0].end)
    return fundTxns
      .filter((tx) => tx.type === 'shuttle_purchase' && tx.created_at >= periodStart && tx.created_at <= periodEnd + 'T23:59:59')
      .reduce((s, tx) => s + Math.abs(num(tx.amount)), 0)
  }, [isInventory, fundTxns, all.venues])

  const shuttlePerSession = hasEquipment && !isInventory ? (num(settings.estimated_shuttlecocks) * num(settings.price_per_box)) / BALLS_PER_BOX : 0

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

          if (v.court_payment_mode === 'cycle') {
            const shuttleActual = isInventory ? 0 : venueLogs.reduce((s, l) => s + num(l.shuttle_cost), 0)
            const shuttleEst = isInventory ? 0 : estimatedCount * shuttlePerSession
            const venueCost = v.courtCost + shuttleActual + shuttleEst
            acc.actualSpent += venueCost
            acc.spentBreakdown.push({
              label: venueLabel,
              courtCost: v.courtCost,
              shuttleActual,
              shuttleEst,
              loggedCount,
              estimatedCount,
              total: venueCost,
              isCycle: true,
            })
          } else {
            const sc = sessionConfigs.find((c) => c.weekday === v.weekday) || {}
            const courtPerSession = num(sc.court_price_per_hour) * num(sc.hours_per_session)
            const courtActual = venueLogs.reduce((s, l) => s + num(l.court_cost), 0)
            const courtEst = estimatedCount * courtPerSession
            const shuttleActual = isInventory ? 0 : venueLogs.reduce((s, l) => s + num(l.shuttle_cost), 0)
            const shuttleEst = isInventory ? 0 : estimatedCount * shuttlePerSession
            const venueCost = courtActual + courtEst + shuttleActual + shuttleEst
            acc.actualSpent += venueCost
            acc.spentBreakdown.push({
              label: venueLabel,
              costActual: courtActual + shuttleActual,
              costEst: courtEst + shuttleEst,
              loggedCount,
              estimatedCount,
              total: venueCost,
              isCycle: false,
            })
          }
          return acc
        },
        { actualSpent: 0, spentBreakdown: [] }
      ),
    [all.venues, logs, isInventory, shuttlePerSession, sessionConfigs]
  )

  const totalActualSpent = isInventory ? actualSpent + shuttleTxnsInPeriod : actualSpent

  const remainingForecast = useMemo(() => {
    if (isInventory) {
      const tubesPerSession = num(settings.estimated_shuttlecocks) || 0
      const totalSessionsLeft = all.venues.reduce((s, v) => s + Math.max(0, v.totalSessions - v.happened), 0)
      const boxesLeft = num(settings.shuttle_stock)
      const sessionsLeft = tubesPerSession > 0 ? Math.floor((boxesLeft * BALLS_PER_BOX) / tubesPerSession) : Infinity
      const refillBoxes = sessionsLeft < totalSessionsLeft ? Math.ceil(((totalSessionsLeft - sessionsLeft) * tubesPerSession) / BALLS_PER_BOX) : 0
      const shuttleRefillCost = refillBoxes > 0 ? refillBoxes * num(settings.price_per_box) : 0
      const courtRemaining = all.venues.reduce((total, v) => {
        const remaining = Math.max(0, v.totalSessions - v.happened)
        if (v.court_payment_mode === 'cycle') return total
        const sc = sessionConfigs.find((c) => c.weekday === v.weekday) || {}
        return total + remaining * (num(sc.court_price_per_hour) * num(sc.hours_per_session))
      }, 0)
      return courtRemaining + shuttleRefillCost
    }
    const sps = hasEquipment ? (num(settings.estimated_shuttlecocks) * num(settings.price_per_box)) / BALLS_PER_BOX : 0
    return all.venues.reduce((total, v) => {
      const remaining = Math.max(0, v.totalSessions - v.happened)
      if (v.court_payment_mode === 'cycle') return total + remaining * sps
      const sc = sessionConfigs.find((c) => c.weekday === v.weekday) || {}
      return total + remaining * (num(sc.court_price_per_hour) * num(sc.hours_per_session) + sps)
    }, 0)
  }, [all.venues, sessionConfigs, settings, hasEquipment, isInventory])

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
  const baseFee = all.suggestedFee
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

      {memberCount > 0 && <BaseFeeCard all={all} baseFee={baseFee} sport={sport} settings={settings} />}

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
    reload,
    openUpsell,
    closeSidebar,
    liveFundBalance,
  } = useClub()

  const memberCount = (pollTally?.count ?? members.filter((m) => m.user_id !== club.owner_id).length) + 1
  const committedCount = pollTally?.count ?? null
  const [configOpen, setConfigOpen] = useState(false)
  const [sectionsOverride, setSectionsOverride] = useState(null)
  const effectiveSections = sectionsOverride ?? settings?.dashboard_sections ?? {}

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
        />
      </div>

      <div className="space-y-6">
        <MembersPanel
          club={club}
          members={members}
          plan={plan}
          pollTally={pollTally}
          hostName={hostName}
          hostAvatar={hostAvatar}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onChanged={reload}
          onHitLimit={openUpsell}
          toast={toast}
        />
      </div>

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
