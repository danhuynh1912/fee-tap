import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PieChart, Users, TrendingUp, TrendingDown, AlertTriangle, BarChart3,
  FileSpreadsheet, FileText, Activity, Wallet, ArrowRight, Receipt, X, Info, Settings2, SlidersHorizontal,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { InfoTip } from '../../components/club/InfoTip'
import { ProLock } from '../../components/monetize/ProLock'
import { DashboardConfigDrawer } from '../../components/club/DashboardConfigDrawer'
import { MembersPanel } from './MembersPanel'
import {
  computeAll, formatPeriodLabel, getSessionConfigs, cycleLabelShort, resolveShuttlePeriodLabel,
} from '../../engine/forecast'
import { PaymentTimeline } from '../../components/club/PaymentTimeline'
import { fmtVND, fmtNum, num, cx } from '../../lib/utils'
import { BALLS_PER_BOX } from '../../constants'

function StatCard({ icon: Icon, label, value, sub, tone = 'slate', big, tip }) {
  const tones = {
    slate: 'text-slate-900', volt: 'text-lime-600', red: 'text-red-600',
    cyan: 'text-cyan-700', violet: 'text-violet-600',
  }
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        {tip && <span className="ml-auto"><InfoTip>{tip}</InfoTip></span>}
      </div>
      <p className={cx('mt-2 font-mono font-black tabular-nums', big ? 'text-xl sm:text-3xl' : 'text-lg sm:text-2xl', tones[tone])}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function AdvancedForecast({ totalMonthlyCost, plan, canEdit, onUnlock }) {
  const { t } = useTranslation()
  const locked = plan !== 'pro'
  if (locked && !canEdit) return null
  const factors = [1, 1.08, 0.96, 1.14]
  const projections = factors.map((fac, i) => ({
    label: t('adv_q', { n: i + 1 }),
    cost: totalMonthlyCost * fac,
    fac,
  }))
  const maxCost = Math.max(...projections.map((p) => p.cost), 1)

  return (
    <div className="relative">
      <div className={cx(locked && 'locked-blur')}>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-900">{t('adv_title')}</h3>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={locked ? undefined : onUnlock}><FileSpreadsheet className="h-4 w-4" /> {t('export_excel')}</Button>
              <Button size="sm" variant="ghost" onClick={locked ? undefined : onUnlock}><FileText className="h-4 w-4" /> {t('export_pdf')}</Button>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-500">{t('adv_sub')}</p>
          <div className="mt-6 grid grid-cols-4 items-end gap-3" style={{ height: 180 }}>
            {projections.map((p, i) => (
              <div key={i} className="flex h-full flex-col items-center justify-end gap-2">
                <span className="font-mono text-xs font-bold text-slate-500">{fmtVND(p.cost).replace(' ₫', '')}</span>
                <div
                  className="w-full origin-bottom rounded-t-xl bg-gradient-to-t from-slate-900 to-slate-700 animate-rise"
                  style={{ height: `${(p.cost / maxCost) * 100}%`, animationDelay: `${i * 120}ms` }}
                >
                  <div className="h-1.5 w-full rounded-t-xl bg-lime-400" />
                </div>
                <span className="text-xs font-semibold text-slate-400">{p.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {locked && <ProLock onClick={onUnlock} label={t('locked_pro')} />}
    </div>
  )
}

function ForecastDashboard({ settings, slots, memberCount, committedCount, plan, sport, canEdit, onUnlock, logs, fundTxns, sections: sectionsProp }) {
  const { t, i18n } = useTranslation()
  const hasEquipment = sport?.hasEquipment ?? true
  const [spentTipOpen, setSpentTipOpen] = useState(false)
  const [sections, setSections] = useState(() => sectionsProp || {})

  useEffect(() => {
    setSections(sectionsProp || {})
  }, [sectionsProp])

  const DEFAULT_SECTIONS = { running_slots: false, cost_by_cycle: false, deficit_callout: false, carryover_row: false }
  const show = (key) => {
    if (key in sections) return sections[key] !== false
    return DEFAULT_SECTIONS[key] ?? true
  }

  const all = useMemo(() => computeAll(settings, memberCount, hasEquipment, new Date(), slots), [settings, slots, memberCount, hasEquipment])
  const sessionConfigs = useMemo(() => getSessionConfigs(settings), [settings])

  function periodDateRange(period) {
    const { year: sy, month0: sm0 } = period.months[0]
    const lastM = period.months[period.months.length - 1]
    const daysInLast = new Date(lastM.year, lastM.month0 + 1, 0).getDate()
    const start = `${sy}-${String(sm0 + 1).padStart(2, '0')}-01`
    const end = `${lastM.year}-${String(lastM.month0 + 1).padStart(2, '0')}-${String(daysInLast).padStart(2, '0')}`
    return { start, end }
  }

  const isInventory = hasEquipment && settings.shuttle_mode === 'inventory'

  // Shuttle purchase transactions in current periods (inventory mode source of truth)
  const shuttleTxnsInPeriod = useMemo(() => {
    if (!isInventory || !fundTxns?.length) return 0
    // Collect all period date ranges from venues
    const ranges = all.venues
      .filter((v) => v.period)
      .map((v) => periodDateRange(v.period))
    if (!ranges.length) return 0
    const periodStart = ranges.reduce((min, r) => r.start < min ? r.start : min, ranges[0].start)
    const periodEnd = ranges.reduce((max, r) => r.end > max ? r.end : max, ranges[0].end)
    return fundTxns
      .filter((tx) => tx.type === 'shuttle_purchase' && tx.created_at >= periodStart && tx.created_at <= periodEnd + 'T23:59:59')
      .reduce((s, tx) => s + Math.abs(num(tx.amount)), 0)
  }, [isInventory, fundTxns, all.venues])

  // Actual spent = sessions already happened × estimated cost, refined by actual logs when available
  const shuttlePerSession = hasEquipment && !isInventory
    ? num(settings.estimated_shuttlecocks) * num(settings.price_per_box) / BALLS_PER_BOX
    : 0

  const { actualSpent, spentBreakdown } = all.venues.reduce((acc, v) => {
    if (v.weekday === null || v.weekday === undefined) return acc
    const { start, end } = periodDateRange(v.period)
    const wd = Number(v.weekday)
    const venueLogs = (logs || []).filter(
      (l) => l.played_on >= start && l.played_on <= end && new Date(l.played_on + 'T12:00:00').getDay() === wd
    )
    const loggedCount = venueLogs.length
    const estimatedCount = Math.max(0, v.happened - loggedCount)
    const wdLabel = v.weekday !== null && v.weekday !== undefined ? t(`wd_${v.weekday}`) : null
    const venueLabel = [v.name, v.venue_name, wdLabel].filter(Boolean).join(' · ') || t('dash_court_cost')

    if (v.court_payment_mode === 'cycle') {
      // In inventory mode shuttle cost comes from fund transactions, not per-session calc
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
  }, { actualSpent: 0, spentBreakdown: [] })

  // In inventory mode: actual shuttle spend = recorded purchase transactions in this period
  const totalActualSpent = isInventory ? actualSpent + shuttleTxnsInPeriod : actualSpent

  // Remaining = what still needs to come OUT of the fund for unplayed sessions
  const remainingForecast = useMemo(() => {
    if (isInventory) {
      // Shuttle remaining: only if stock is insufficient
      const tubesPerSession = num(settings.estimated_shuttlecocks) || 0
      const totalSessionsLeft = all.venues.reduce((s, v) => s + Math.max(0, v.totalSessions - v.happened), 0)
      const boxesLeft = num(settings.shuttle_stock)
      const sessionsLeft = tubesPerSession > 0 ? Math.floor((boxesLeft * BALLS_PER_BOX) / tubesPerSession) : Infinity
      const refillBoxes = sessionsLeft < totalSessionsLeft
        ? Math.ceil(((totalSessionsLeft - sessionsLeft) * tubesPerSession) / BALLS_PER_BOX)
        : 0
      const shuttleRefillCost = refillBoxes > 0 ? refillBoxes * num(settings.price_per_box) : 0

      const courtRemaining = all.venues.reduce((total, v) => {
        const remaining = Math.max(0, v.totalSessions - v.happened)
        if (v.court_payment_mode === 'cycle') return total // already paid lump sum
        const sc = sessionConfigs.find((c) => c.weekday === v.weekday) || {}
        return total + remaining * (num(sc.court_price_per_hour) * num(sc.hours_per_session))
      }, 0)
      return courtRemaining + shuttleRefillCost
    }
    const sps = hasEquipment ? num(settings.estimated_shuttlecocks) * num(settings.price_per_box) / BALLS_PER_BOX : 0
    return all.venues.reduce((total, v) => {
      const remaining = Math.max(0, v.totalSessions - v.happened)
      if (v.court_payment_mode === 'cycle') return total + remaining * sps
      const sc = sessionConfigs.find((c) => c.weekday === v.weekday) || {}
      const courtPerSession = num(sc.court_price_per_hour) * num(sc.hours_per_session)
      return total + remaining * (courtPerSession + sps)
    }, 0)
  }, [all.venues, sessionConfigs, settings, hasEquipment, isInventory])
  const projectedBalance = all.fund - totalActualSpent - remainingForecast
  const projectedSurplus = projectedBalance >= 0
  const projectedDeficit = projectedSurplus ? 0 : -projectedBalance
  const perMemberTopUp = memberCount > 0 ? Math.ceil(projectedDeficit / memberCount) : 0
  // Total collected = only positive (top_up) transactions in current period
  const { totalCollected, txCount } = useMemo(() => {
    const ranges = all.venues.filter((v) => v.period).map((v) => periodDateRange(v.period))
    if (!ranges.length) return { totalCollected: 0, txCount: 0 }
    const periodStart = ranges.reduce((min, r) => r.start < min ? r.start : min, ranges[0].start)
    const periodEnd = ranges.reduce((max, r) => r.end > max ? r.end : max, ranges[0].end)
    const inPeriod = (fundTxns || []).filter(
      (tx) => num(tx.amount) > 0 && tx.created_at >= periodStart && tx.created_at <= periodEnd + 'T23:59:59'
    )
    return { totalCollected: inPeriod.reduce((s, tx) => s + num(tx.amount), 0), txCount: inPeriod.length }
  }, [fundTxns, all.venues])
  const sessionProgress = all.uniqueScheduled > 0 ? Math.min(1, all.uniqueHappened / all.uniqueScheduled) : 0

  // Base fee: pure cost ÷ members, no fund dependency
  const baseFee = all.suggestedFee
  const nextBaseFee = memberCount > 0 ? Math.ceil(all.nextTotalCost / memberCount) : 0

  // Next cycle: inherit surplus/deficit from current period
  const nextNetCost = all.nextTotalCost - projectedBalance // surplus reduces, deficit adds
  const nextAdjustedFee = memberCount > 0 ? Math.ceil(Math.max(0, nextNetCost) / memberCount) : 0

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 bg-grid-dark p-6 sm:p-8 text-white">
        <div className={cx('pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full blur-3xl', projectedSurplus ? 'bg-lime-400/10' : 'bg-red-500/15')} />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <PieChart className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t('dash_monthly_total')}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {all.venues.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300">
                <Activity className="h-3.5 w-3.5 text-lime-400" />
                {[...new Set(all.venues.map((v) => formatPeriodLabel(v.period, i18n.language)))].join(' · ')}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300">
              <Users className="h-3.5 w-3.5 text-lime-400" /> {memberCount} {t('members')}
            </span>
          </div>
        </div>

        <div className="relative mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('dash_fund_live')}</p>
          <p className={cx('mt-1 font-mono text-4xl sm:text-5xl font-black tabular-nums leading-none', (all.fund - totalActualSpent) >= 0 ? 'text-lime-400' : 'text-red-400')}>{fmtVND(all.fund - totalActualSpent)}</p>
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2 sm:gap-3">
          <div className="flex-1 rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_total_collected')}</p>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-yellow-400">{fmtVND(totalCollected)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{txCount} {t('dash_collections')}</p>
          </div>
          <div className="flex-1 rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_actual_spent')}</p>
              <button
                onClick={() => setSpentTipOpen(true)}
                className="grid h-5 w-5 place-items-center rounded-lg text-slate-500 transition hover:text-lime-400 active:scale-95"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-white">{fmtVND(totalActualSpent)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {all.venues.some((v) => v.court_payment_mode === 'cycle') && (
                <span>{t('dash_actual_includes_lump')} · </span>
              )}
              {all.uniqueHappened} {t('dash_sessions_label')} ({all.totalHappened} {t('dash_slots_label')}) {t('dash_sessions_happened')}
            </p>
          </div>
          {show('remaining_forecast') && (
            <div className="flex-1 rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_remaining_forecast')}</p>
              <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-slate-300">~{fmtVND(remainingForecast)}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{all.uniqueScheduled - all.uniqueHappened} {t('dash_sessions_future')}</p>
            </div>
          )}
          {show('end_of_period') && canEdit && (
            <div className={cx('flex-1 rounded-2xl px-3 py-3 sm:px-4', projectedSurplus ? 'bg-lime-400/15' : 'bg-red-500/20')}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_end_of_period')}</p>
              <p className={cx('mt-1.5 font-mono text-sm sm:text-base font-black', projectedSurplus ? 'text-lime-400' : 'text-red-400')}>
                {projectedSurplus ? '+' : '−'}{fmtVND(Math.abs(projectedBalance))}
              </p>
              <span className={cx('mt-0.5 text-[10px] font-bold', projectedSurplus ? 'text-lime-400' : 'text-red-400')}>
                {projectedSurplus ? t('bal_surplus') : t('bal_deficit')}
              </span>
            </div>
          )}
        </div>

        {all.uniqueScheduled > 0 && (
          <div className="relative mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_session_progress')}</span>
              <span className="text-[10px] font-mono text-slate-400">{all.uniqueHappened} / {all.uniqueScheduled} {t('dash_sessions')}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${sessionProgress * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Base fee + total cost breakdown — always visible */}
      {memberCount > 0 && (
        <div className="rounded-3xl border border-slate-100 bg-white p-5">
          <div className="flex flex-wrap items-center gap-4">
            {/* Total cycle cost */}
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('dash_cycle_total_est')}</p>
              <p className="font-mono text-2xl font-black text-slate-900">{fmtVND(all.totalPeriodCost ?? all.totalMonthlyCost)}</p>
              {(() => {
                const courtLabel = all.venues[0]?.period ? formatPeriodLabel(all.venues[0].period, i18n.language) : null
                const shuttleLabel = sport?.hasEquipment && all.shuttleCost > 0 ? resolveShuttlePeriodLabel(settings, i18n.language) : null
                const sessionsText = <>
                  {all.uniqueScheduled} {t('dash_sessions_label')}
                  {all.uniqueScheduled !== all.totalScheduled && <> ({all.totalScheduled} {t('dash_slots_label')})</>}
                </>
                // Same period — show one compact row
                if (!shuttleLabel || courtLabel === shuttleLabel) {
                  return (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {courtLabel && <span className="font-semibold text-slate-700">{courtLabel}</span>}
                      {courtLabel && <span className="text-slate-300">·</span>}
                      <span className="text-slate-600">{sessionsText}</span>
                    </div>
                  )
                }
                // Different periods — show two labeled rows
                return (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-400 w-20 shrink-0">{t('dash_label_court_cycle')}</span>
                      <span className="font-semibold text-slate-700">{courtLabel}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-600">{sessionsText}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-400 w-20 shrink-0">{t('dash_label_shuttle_cycle')}</span>
                      <span className="font-semibold text-slate-700">{shuttleLabel}</span>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Per-member fee */}
            <div className="shrink-0 text-right space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('dash_base_fee')}</p>
              <p className="font-mono text-2xl font-black text-lime-600">{fmtVND(baseFee)}</p>
              <p className="text-[10px] text-slate-400">/ {t('member')}</p>
              {all.venues[0]?.currentDeadline && (
                <p className="text-[11px] font-semibold text-amber-600">
                  {t('timeline_deadline')} {all.venues[0].currentDeadline.toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Projected result callout — admin only, configurable */}
      {show('deficit_callout') && canEdit && (
        projectedSurplus ? (
          <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-lime-200 bg-lime-50 p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime-400 text-slate-900">
              <TrendingUp className="h-6 w-6" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900">{t('dash_proj_surplus_title')}</p>
              <p className="text-sm text-slate-600">
                {t('dash_proj_surplus_body')} <span className="font-mono font-bold text-lime-700">{fmtVND(projectedBalance)}</span>
              </p>
            </div>
            {memberCount > 0 && (
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_topup_fee')}</p>
                <p className="font-mono text-2xl font-black text-slate-900">{fmtVND(0)}</p>
                <p className="text-[10px] text-slate-400">/ {t('member')}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500 text-white">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="font-bold text-red-700">{t('dash_proj_deficit_title')}</p>
                <p className="mt-1 text-sm text-slate-700">{t('dash_deficit_body', { amount: fmtVND(projectedDeficit) })}</p>
              </div>
            </div>
            {memberCount > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white/70 p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_proj_shortfall')}</p>
                  <p className="font-mono text-lg font-black text-red-600">{fmtVND(projectedDeficit)}</p>
                </div>
                <div className="rounded-2xl bg-white/70 p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_member_count')}</p>
                  <p className="font-mono text-lg font-black text-slate-900">{memberCount}</p>
                </div>
                <div className="rounded-2xl bg-slate-900 p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_topup_fee')}</p>
                  <p className="font-mono text-lg font-black text-lime-400">{fmtVND(perMemberTopUp)}</p>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Payment timeline — replaces per-venue cards */}
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
        />
      )}

      {/* Per-cycle cost breakdown */}
      {show('cost_by_cycle') && (() => {
        const shuttlePerSession = hasEquipment
          ? num(settings.estimated_shuttlecocks) * num(settings.price_per_box) / BALLS_PER_BOX
          : 0
        const venueRows = all.venues.map((v) => {
          // Split shuttle: happened sessions (logged actual + unlogged→est) vs future (est)
          const { start, end } = periodDateRange(v.period)
          const wd = v.weekday !== null && v.weekday !== undefined ? Number(v.weekday) : null
          const venueLogs = wd !== null
            ? (logs || []).filter((l) => l.played_on >= start && l.played_on <= end && new Date(l.played_on + 'T12:00:00').getDay() === wd)
            : []
          const happenedCount = v.happened          // sessions already played (logged or not)
          const futureCount = Math.max(0, v.totalSessions - happenedCount)
          // For happened: use real shuttle_cost from log, fall back to estimate for unlogged ones
          const shuttleHappened = hasEquipment
            ? venueLogs.reduce((s, l) => s + num(l.shuttle_cost), 0)
              + Math.max(0, happenedCount - venueLogs.length) * shuttlePerSession
            : 0
          const shuttleFuture = hasEquipment ? futureCount * shuttlePerSession : 0
          const shuttleCost = shuttleHappened + shuttleFuture
          const shuttleBoxes = hasEquipment ? Math.ceil(v.totalSessions * num(settings.estimated_shuttlecocks) / BALLS_PER_BOX) : 0
          return { ...v, shuttleCost, shuttleBoxes, shuttleHappened, shuttleFuture, happenedCount, futureCount, total: v.courtCost + shuttleCost }
        })
        const grandTotal = venueRows.reduce((s, r) => s + r.total, 0)

        return (
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">{t('dash_cost_by_cycle')}</span>
            </div>
            <p className="mt-1 mb-4 text-xs text-slate-400 italic">{t('dash_cost_by_cycle_note')}</p>
            <div className="space-y-4">
              {venueRows.map((v, i) => {
                const dayLabel = v.weekday !== null && v.weekday !== undefined ? t(`wd_${v.weekday}`) : null
                const cycleLabel = cycleLabelShort(v.cycle_months || 1, i18n.language)
                return (
                  <div key={v.weekday ?? i}>
                    <div className="flex items-center gap-2 mb-2">
                      {dayLabel && <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{dayLabel}</span>}
                      <span className="text-xs text-slate-400">{cycleLabel}</span>
                    </div>
                    <div className="space-y-1.5 pl-2 border-l-2 border-slate-100">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">{t('dash_court_cost')}</span>
                        <span className="font-mono font-semibold text-slate-900">{fmtVND(v.courtCost)}</span>
                      </div>
                      {hasEquipment && v.happenedCount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">
                            {t('dash_shuttle_actual_line', { n: v.happenedCount })}
                          </span>
                          <span className="font-mono font-semibold text-slate-900">{fmtVND(v.shuttleHappened)}</span>
                        </div>
                      )}
                      {hasEquipment && v.futureCount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400 italic">
                            {t('dash_shuttle_est_line', { n: v.futureCount })}
                          </span>
                          <span className="font-mono font-semibold text-slate-400 italic">{fmtVND(v.shuttleFuture)}</span>
                        </div>
                      )}
                      {hasEquipment && v.happenedCount === 0 && v.futureCount === 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">{t('dash_shuttle_cost')}</span>
                          <span className="font-mono font-semibold text-slate-900">{fmtVND(0)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-100">
                        <span className="font-semibold text-slate-700">{t('subtotal')}</span>
                        <span className="font-mono font-bold text-slate-900">{fmtVND(v.total)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between border-t-2 border-slate-100 pt-3 mt-4">
              <span className="font-bold text-slate-900">{t('dash_total_cycle')}</span>
              <span className="font-mono text-lg font-black text-slate-900">{fmtVND(grandTotal)}</span>
            </div>
          </div>
        )
      })()}


      <AdvancedForecast totalMonthlyCost={all.totalMonthlyCost} plan={plan} canEdit={canEdit} onUnlock={onUnlock} />


      <Modal open={spentTipOpen} onClose={() => setSpentTipOpen(false)}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900">
              <Receipt className="h-4 w-4 text-lime-400" />
            </span>
            <div>
              <p className="font-black text-slate-900 text-base leading-tight">{t('dash_actual_spent')}</p>
              <p className="text-xs text-slate-400">{t('dash_breakdown')}</p>
            </div>
          </div>
          <button onClick={() => setSpentTipOpen(false)} className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {spentBreakdown.map((b, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="font-bold text-slate-800 mb-3 text-sm">{b.label}</p>
              <div className="space-y-2">
                {b.isCycle ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('dash_court_lump')}</span>
                      <span className="font-mono font-semibold text-slate-900">{fmtVND(b.courtCost)}</span>
                    </div>
                    {b.loggedCount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('dash_shuttle_logged', { n: b.loggedCount })}</span>
                        <span className="font-mono font-semibold text-slate-900">{fmtVND(b.shuttleActual)}</span>
                      </div>
                    )}
                    {b.estimatedCount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('dash_shuttle_est', { n: b.estimatedCount })}</span>
                        <span className="font-mono font-semibold text-slate-500">{fmtVND(b.shuttleEst)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {b.loggedCount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('dash_session_logged', { n: b.loggedCount })}</span>
                        <span className="font-mono font-semibold text-slate-900">{fmtVND(b.costActual)}</span>
                      </div>
                    )}
                    {b.estimatedCount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('dash_session_est', { n: b.estimatedCount })}</span>
                        <span className="font-mono font-semibold text-slate-500">{fmtVND(b.costEst)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-between mt-3 pt-3 border-t border-slate-200">
                <span className="text-sm font-semibold text-slate-700">{t('subtotal')}</span>
                <span className="font-mono font-bold text-slate-900">{fmtVND(b.total)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-5 pt-4 border-t-2 border-slate-100">
          <span className="font-black text-slate-900">{t('total')}</span>
          <span className="font-mono text-xl font-black text-slate-900">{fmtVND(totalActualSpent)}</span>
        </div>
      </Modal>
    </div>
  )
}

function VenueCard({ venue, lang, t }) {
  const periodLabel = formatPeriodLabel(venue.period, lang)
  const cycleNote = cycleLabelShort(venue.cycle_months || 1, lang)
  const dayLabel = venue.weekday !== null && venue.weekday !== undefined
    ? t(`wd_${venue.weekday}`)
    : null

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {dayLabel && (
            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">{dayLabel}</span>
          )}
          <span className="text-xs text-slate-400">{periodLabel}</span>
        </div>
        <Badge tone={venue.court_payment_mode === 'cycle' ? 'cyan' : 'slate'}>
          {t(venue.court_payment_mode === 'cycle' ? 'court_mode_cycle' : 'court_mode_session')}
        </Badge>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('dash_court_cost')}</p>
      <p className="mt-1 font-mono text-xl font-black text-slate-900">{fmtVND(venue.courtCost)}</p>
      <p className="mt-0.5 text-xs text-slate-400">
        {venue.totalSessions} {t('dash_sessions')} · {cycleNote}
        {isQuarter && (
          <span className="ml-1 text-slate-400">→ {fmtVND(venue.monthlyCourtCost)}/{t('month')}</span>
        )}
      </p>
    </div>
  )
}

export function DashboardPage({ club, settings, slots, members, logs, fundTxns, pollTally, plan, sport, hostName, hostAvatar, currentUserId, canEdit, onUnlock, onChanged, onCloseSidebar, onConfigClose, toast }) {
  const { t } = useTranslation()
  const memberCount = (pollTally?.count ?? members.filter((m) => m.user_id !== club.owner_id).length) + 1
  const committedCount = pollTally?.count ?? null
  const [configOpen, setConfigOpen] = useState(false)
  const [sectionsOverride, setSectionsOverride] = useState(null)

  const effectiveSections = sectionsOverride ?? settings?.dashboard_sections ?? {}

  function openConfig() {
    setSectionsOverride(settings?.dashboard_sections ?? {})
    onCloseSidebar?.()
    setConfigOpen(true)
  }

  function handleSectionsLive(updated) {
    setSectionsOverride(updated)
  }

  function handleSectionsSaved(updated) {
    setSectionsOverride(updated)
    onChanged?.()
  }

  return (
    <div className="relative grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {/* Config button above forecast */}
        {canEdit && (
          <div className="flex justify-end mb-3">
            <button
              onClick={openConfig}
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
          onUnlock={onUnlock}
          logs={logs}
          fundTxns={fundTxns}
          sections={effectiveSections}
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
          onChanged={onChanged}
          onHitLimit={onUnlock}
          toast={toast}
        />
      </div>

      {/* Right config drawer — slides over MembersPanel */}
      {canEdit && (
        <DashboardConfigDrawer
          open={configOpen}
          onClose={() => { setConfigOpen(false); onConfigClose?.() }}
          clubId={club.id}
          sections={effectiveSections}
          venueCount={settings.play_weekdays?.length ?? 1}
          onSaved={handleSectionsSaved}
          onLiveChange={handleSectionsLive}
        />
      )}
    </div>
  )
}
