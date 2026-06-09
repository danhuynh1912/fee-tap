import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PieChart, Users, TrendingUp, TrendingDown, AlertTriangle, BarChart3,
  FileSpreadsheet, FileText, Activity, Target, Wallet, ArrowRight, Receipt, X, Info,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { InfoTip } from '../../components/club/InfoTip'
import { ProLock } from '../../components/monetize/ProLock'
import { MembersPanel } from './MembersPanel'
import {
  computeAll, formatPeriodLabel, getSessionConfigs, resolvePeriods,
} from '../../engine/forecast'
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

function ForecastDashboard({ settings, memberCount, plan, sport, canEdit, onUnlock, logs, fundTxns }) {
  const { t, i18n } = useTranslation()
  const hasEquipment = sport?.hasEquipment ?? true
  const [spentTipOpen, setSpentTipOpen] = useState(false)

  const all = useMemo(() => computeAll(settings, memberCount, hasEquipment), [settings, memberCount, hasEquipment])
  const sessionConfigs = useMemo(() => getSessionConfigs(settings), [settings])

  function periodDateRange(period) {
    const { year: sy, month0: sm0 } = period.months[0]
    const lastM = period.months[period.months.length - 1]
    const daysInLast = new Date(lastM.year, lastM.month0 + 1, 0).getDate()
    const start = `${sy}-${String(sm0 + 1).padStart(2, '0')}-01`
    const end = `${lastM.year}-${String(lastM.month0 + 1).padStart(2, '0')}-${String(daysInLast).padStart(2, '0')}`
    return { start, end }
  }

  // Actual spent = sessions already happened × estimated cost, refined by actual logs when available
  const shuttlePerSession = hasEquipment
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
    const venueLabel = v.weekday !== null && v.weekday !== undefined ? t(`wd_${v.weekday}`) : t('dash_court_cost')

    if (v.court_payment_mode === 'cycle') {
      const shuttleActual = venueLogs.reduce((s, l) => s + num(l.shuttle_cost), 0)
      const shuttleEst = estimatedCount * shuttlePerSession
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
      const costActual = venueLogs.reduce((s, l) => s + num(l.total_cost), 0)
      const costEst = estimatedCount * (courtPerSession + shuttlePerSession)
      const venueCost = costActual + costEst
      acc.actualSpent += venueCost
      acc.spentBreakdown.push({
        label: venueLabel,
        costActual,
        costEst,
        loggedCount,
        estimatedCount,
        total: venueCost,
        isCycle: false,
      })
    }
    return acc
  }, { actualSpent: 0, spentBreakdown: [] })

  // Remaining = what still needs to come OUT of the fund for unplayed sessions
  const remainingForecast = useMemo(() => {
    const shuttlePerSession = hasEquipment
      ? num(settings.estimated_shuttlecocks) * num(settings.price_per_box) / BALLS_PER_BOX
      : 0
    return all.venues.reduce((total, v) => {
      const remaining = Math.max(0, v.totalSessions - v.happened)
      if (v.court_payment_mode === 'cycle') {
        // Court already paid as lump sum — only shuttle left
        return total + remaining * shuttlePerSession
      } else {
        const sc = sessionConfigs.find((c) => c.weekday === v.weekday) || {}
        const courtPerSession = num(sc.court_price_per_hour) * num(sc.hours_per_session)
        return total + remaining * (courtPerSession + shuttlePerSession)
      }
    }, 0)
  }, [all.venues, sessionConfigs, settings, hasEquipment])
  const projectedBalance = all.fund - actualSpent - remainingForecast
  const projectedSurplus = projectedBalance >= 0
  const projectedDeficit = projectedSurplus ? 0 : -projectedBalance
  const perMemberTopUp = memberCount > 0 ? Math.ceil(projectedDeficit / memberCount) : 0
  const totalCollected = all.fund
  const txCount = (fundTxns || []).length
  const sessionProgress = all.totalScheduled > 0 ? Math.min(1, all.totalHappened / all.totalScheduled) : 0

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
          <p className="mt-1 font-mono text-4xl sm:text-5xl font-black tabular-nums leading-none text-white">{fmtVND(all.fund - actualSpent)}</p>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-2xl bg-lime-400/10 border border-lime-400/20 px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-lime-500">{t('dash_total_collected')}</p>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-lime-400">{fmtVND(totalCollected)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{txCount} {t('dash_collections')}</p>
          </div>
          <div className="rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_actual_spent')}</p>
              <button
                onClick={() => setSpentTipOpen(true)}
                className="grid h-5 w-5 place-items-center rounded-lg text-slate-500 transition hover:text-lime-400 active:scale-95"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-white">{fmtVND(actualSpent)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {all.venues.some((v) => v.court_payment_mode === 'cycle') && (
                <span>{t('dash_actual_includes_lump')} · </span>
              )}
              {all.totalHappened} {t('dash_sessions_happened')}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_remaining_forecast')}</p>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-slate-300">~{fmtVND(remainingForecast)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{all.totalScheduled - all.totalHappened} {t('dash_sessions_future')}</p>
          </div>
          <div className={cx('rounded-2xl px-3 py-3 sm:px-4', projectedSurplus ? 'bg-lime-400/15' : 'bg-red-500/20')}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_end_of_period')}</p>
            <p className={cx('mt-1.5 font-mono text-sm sm:text-base font-black', projectedSurplus ? 'text-lime-400' : 'text-red-400')}>
              {projectedSurplus ? '+' : '−'}{fmtVND(Math.abs(projectedBalance))}
            </p>
            <span className={cx('mt-0.5 text-[10px] font-bold', projectedSurplus ? 'text-lime-400' : 'text-red-400')}>
              {projectedSurplus ? t('bal_surplus') : t('bal_deficit')}
            </span>
          </div>
        </div>

        {all.totalScheduled > 0 && (
          <div className="relative mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_session_progress')}</span>
              <span className="text-[10px] font-mono text-slate-400">{all.totalHappened} / {all.totalScheduled} {t('dash_sessions')}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-lime-400 transition-all duration-500" style={{ width: `${sessionProgress * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Projected result callout */}
      {projectedSurplus ? (
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
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_suggested_fee')}</p>
              <p className="font-mono text-2xl font-black text-slate-900">{fmtVND(all.suggestedFee)}</p>
              <p className="text-[10px] text-slate-400">/ {t('member')} / {t('month')}</p>
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
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_per_member')}</p>
                <p className="font-mono text-lg font-black text-lime-400">{fmtVND(perMemberTopUp)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-venue cost cards */}
      {all.venues.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {all.venues.map((v, i) => (
            <VenueCard key={v.weekday ?? i} venue={v} lang={i18n.language} t={t} />
          ))}
        </div>
      )}

      {/* Shuttle stat (if equipment) */}
      {hasEquipment && (
        <StatCard
          icon={Target} label={t('dash_shuttle_cost')} value={fmtVND(all.shuttleCost)}
          sub={`${all.boxes} ${t('dash_boxes')}`} tone="cyan"
          tip={
            <>
              <p className="font-semibold text-white">{t('calc_shuttle_title')}</p>
              <p className="mt-1.5 font-mono text-cyan-300">
                ⌈{fmtNum(all.totalMonthlySessions)} × {fmtNum(num(settings.estimated_shuttlecocks))} ÷ {BALLS_PER_BOX}⌉ = {all.boxes} {t('dash_boxes')}
              </p>
              <p className="mt-1 font-mono text-cyan-300">{all.boxes} × {fmtVND(num(settings.price_per_box))}</p>
              <p className="mt-1 font-mono text-white">= {fmtVND(all.shuttleCost)}</p>
            </>
          }
        />
      )}

      {/* Monthly total summary */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <div className="flex items-center gap-2 text-slate-400 mb-4">
          <Wallet className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">{t('dash_monthly_total')}</span>
        </div>
        <div className="space-y-2">
          {all.venues.map((v, i) => {
            const note = v.billing_cycle === 'quarter' ? t('dash_court_note_quarter') : t('dash_court_note_month')
            const label = v.weekday !== null && v.weekday !== undefined
              ? `${t('dash_venue_court')} ${t(`wd_${v.weekday}`)}`
              : t('dash_court_cost')
            return (
              <div key={v.weekday ?? i} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  {label} <span className="text-xs text-slate-400">{note}</span>
                </span>
                <span className="font-mono font-semibold text-slate-900">{fmtVND(v.monthlyCourtCost)}</span>
              </div>
            )
          })}
          {hasEquipment && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{t('dash_shuttle_cost')}</span>
              <span className="font-mono font-semibold text-slate-900">{fmtVND(all.shuttleCost)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
            <span className="font-semibold text-slate-900">{t('dash_total_cycle')}</span>
            <span className="font-mono text-lg font-black text-slate-900">{fmtVND(all.totalMonthlyCost)}</span>
          </div>
        </div>
      </div>

      {/* Next cycle */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <ArrowRight className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">{t('dash_next_cycle')}</span>
          </div>
          {all.nextTotalCost !== all.totalMonthlyCost && (
            <Badge tone={all.nextTotalCost > all.totalMonthlyCost ? 'red' : 'volt'}
              icon={all.nextTotalCost > all.totalMonthlyCost ? TrendingUp : TrendingDown}
            >
              {all.nextTotalCost > all.totalMonthlyCost ? '+' : '−'}{fmtVND(Math.abs(all.nextTotalCost - all.totalMonthlyCost))} {t('dash_vs_current')}
            </Badge>
          )}
        </div>
        <div className="mt-4 grid sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-400">{t('dash_sessions')}</p>
            <p className="font-mono text-lg font-black text-slate-900">{fmtNum(all.nextSessions)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-400">{t('dash_total_cost')}</p>
            <p className="font-mono text-lg font-black text-slate-900">{fmtVND(all.nextTotalCost)}</p>
          </div>
          <div className={cx('rounded-2xl p-3 text-center', projectedSurplus ? 'bg-lime-50' : 'bg-red-50')}>
            <p className="text-xs text-slate-400">{t('dash_carryover')}</p>
            <p className={cx('font-mono text-lg font-black', projectedSurplus ? 'text-lime-600' : 'text-red-500')}>
              {projectedSurplus ? '+' : '−'}{fmtVND(Math.abs(projectedBalance))}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 p-3 text-center">
            <p className="text-xs text-slate-400">{t('dash_per_member')}</p>
            <p className="font-mono text-lg font-black text-lime-400">{fmtVND(nextAdjustedFee)}</p>
            {projectedBalance !== 0 && (
              <p className="text-[10px] text-slate-500 mt-0.5">{t('dash_incl_carryover')}</p>
            )}
          </div>
        </div>
      </div>

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
          <span className="font-mono text-xl font-black text-slate-900">{fmtVND(actualSpent)}</span>
        </div>
      </Modal>
    </div>
  )
}

function VenueCard({ venue, lang, t }) {
  const periodLabel = formatPeriodLabel(venue.period, lang)
  const isQuarter = venue.billing_cycle === 'quarter'
  const cycleNote = isQuarter ? t('dash_court_note_quarter') : t('dash_court_note_month')
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

export function DashboardPage({ club, settings, members, logs, fundTxns, pollTally, plan, sport, hostName, hostAvatar, currentUserId, canEdit, onUnlock, onChanged, toast }) {
  // +1 to include the host (host is not in club_members table)
  const memberCount = (pollTally?.count ?? members.filter((m) => m.user_id !== club.owner_id).length) + 1

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ForecastDashboard
          settings={settings}
          memberCount={memberCount}
          plan={plan}
          sport={sport}
          canEdit={canEdit}
          onUnlock={onUnlock}
          logs={logs}
          fundTxns={fundTxns}
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
    </div>
  )
}
