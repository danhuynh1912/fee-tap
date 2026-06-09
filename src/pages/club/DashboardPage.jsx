import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PieChart, Users, TrendingUp, TrendingDown, AlertTriangle, BarChart3,
  FileSpreadsheet, FileText, Activity, Target, Wallet, ArrowRight,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { InfoTip } from '../../components/club/InfoTip'
import { ProLock } from '../../components/monetize/ProLock'
import { MembersPanel } from './MembersPanel'
import {
  resolvePeriods, computeCycle, formatPeriodLabel, sessionsHappenedByNow,
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

function AdvancedForecast({ forecast, plan, onUnlock }) {
  const { t } = useTranslation()
  const locked = plan !== 'pro'
  const factors = [1, 1.08, 0.96, 1.14]
  const projections = factors.map((fac, i) => ({
    label: t('adv_q', { n: i + 1 }),
    cost: forecast.totalCost * fac,
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

function ForecastDashboard({ settings, memberCount, memberSource, plan, sport, canEdit, onUnlock, logs, fundTxns }) {
  const { t, i18n } = useTranslation()
  const hasEquipment = sport?.hasEquipment ?? true
  const periods = useMemo(() => resolvePeriods(settings), [settings])
  const f = useMemo(() => computeCycle(settings, periods.current, memberCount, hasEquipment), [settings, periods, memberCount, hasEquipment])
  const fn = useMemo(() => computeCycle(settings, periods.next, memberCount, hasEquipment), [settings, periods, memberCount, hasEquipment])
  const curLabel = formatPeriodLabel(periods.current, i18n.language)
  const nextLabel = formatPeriodLabel(periods.next, i18n.language)
  const delta = fn.totalCost - f.totalCost

  const courtMode = settings.court_payment_mode === 'cycle' ? 'cycle' : 'session'
  const periodMonthKeys = periods.current.months.map(
    (m) => `${m.year}-${String(m.month0 + 1).padStart(2, '0')}`
  )
  const logsInPeriod = (logs || []).filter((l) =>
    periodMonthKeys.some((k) => l.played_on?.startsWith(k))
  )
  const loggedSessions = logsInPeriod.length
  const happenedSessions = useMemo(() => sessionsHappenedByNow(settings, periods.current), [settings, periods])
  const unloggedHappened = Math.max(0, happenedSessions - loggedSessions)
  const remainingSessions = Math.max(0, f.totalSessions - happenedSessions)
  const costPerSession = f.totalSessions > 0 ? f.totalCost / f.totalSessions : 0
  const shuttleCostPerSession = f.totalSessions > 0 ? f.shuttleCost / f.totalSessions : 0
  const actualShuttleSpent = logsInPeriod.reduce((s, l) => s + num(l.shuttle_cost), 0)
  const actualSessionSpent = logsInPeriod.reduce((s, l) => s + num(l.total_cost), 0)
  const estimatedUnloggedCost = courtMode === 'cycle'
    ? Math.round(unloggedHappened * shuttleCostPerSession)
    : Math.round(unloggedHappened * costPerSession)
  const actualSpent = courtMode === 'cycle'
    ? f.courtCost + actualShuttleSpent + estimatedUnloggedCost
    : actualSessionSpent + estimatedUnloggedCost
  const remainingForecast = courtMode === 'cycle'
    ? Math.round(remainingSessions * shuttleCostPerSession)
    : Math.round(remainingSessions * costPerSession)
  const totalCollected = (fundTxns || []).reduce((s, tx) => s + num(tx.amount), 0)
  const currentFund = num(settings.current_fund)
  const projectedBalance = courtMode === 'cycle'
    ? currentFund - f.courtCost - Math.round(remainingSessions * shuttleCostPerSession)
    : currentFund - remainingForecast
  const projectedSurplus = projectedBalance >= 0
  const projectedDeficit = projectedSurplus ? 0 : -projectedBalance
  const perMemberTopUp = memberCount > 0 ? Math.ceil(projectedDeficit / memberCount) : 0
  const suggestedFee = f.totalSessions > 0 && memberCount > 0 ? Math.ceil(f.totalCost / memberCount) : 0
  const sessionProgress = f.totalSessions > 0 ? Math.min(1, happenedSessions / f.totalSessions) : 0
  const bdText = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => f.breakdown[d])
    .map((d) => `${f.breakdown[d]} × ${t('wd_' + d)}`)
    .join('  ·  ')

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 bg-grid-dark p-6 sm:p-8 text-white">
        <div className={cx('pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full blur-3xl', projectedSurplus ? 'bg-lime-400/10' : 'bg-red-500/15')} />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <PieChart className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">{curLabel}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300">
            <Users className="h-3.5 w-3.5 text-lime-400" /> {memberCount} {t('members')}
          </span>
        </div>

        <div className="relative mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('dash_fund_live')}</p>
          <p className="mt-1 font-mono text-4xl sm:text-5xl font-black tabular-nums leading-none text-white">{fmtVND(currentFund)}</p>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-2xl bg-lime-400/10 border border-lime-400/20 px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-lime-500">{t('dash_total_collected')}</p>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-lime-400">{fmtVND(totalCollected)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{(fundTxns || []).length} {t('dash_collections')}</p>
          </div>
          <div className="rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_actual_spent')}</p>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-white">{fmtVND(actualSpent)}</p>
            {courtMode === 'cycle' ? (
              <p className="mt-0.5 text-[10px] text-slate-500">{t('dash_court_paid')} + {fmtVND(actualShuttleSpent)} {t('dash_shuttle_actual')}</p>
            ) : (
              <p className="mt-0.5 text-[10px] text-slate-500">
                {happenedSessions} {t('dash_sessions_happened')}
                {unloggedHappened > 0 && <span className="text-amber-400"> ({unloggedHappened} {t('dash_estimated')})</span>}
              </p>
            )}
          </div>
          <div className="rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_remaining_forecast')}</p>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-slate-300">~{fmtVND(remainingForecast)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{remainingSessions} {t('dash_sessions_future')}</p>
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

        {f.totalSessions > 0 && (
          <div className="relative mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_session_progress')}</span>
              <span className="text-[10px] font-mono text-slate-400">{loggedSessions} / {f.totalSessions} {t('dash_sessions')}</span>
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
              <p className="font-mono text-2xl font-black text-slate-900">{fmtVND(suggestedFee)}</p>
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
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_per_member')}</p>
                <p className="font-mono text-lg font-black text-lime-400">{fmtVND(perMemberTopUp)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cost breakdown */}
      <div className={cx('grid gap-4', hasEquipment ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        <StatCard
          icon={Activity} label={t('dash_court_cost')} value={fmtVND(f.courtCost)} tone="violet"
          sub={`${f.totalSessions} ${t('dash_sessions')} × ${fmtVND(num(settings.court_price_per_hour) * num(settings.hours_per_session))}`}
          tip={<><p className="font-semibold text-white">{t('calc_court_title')}</p><p className="mt-1.5 font-mono text-lime-300">{fmtVND(num(settings.court_price_per_hour))} × {fmtNum(num(settings.hours_per_session))}h × {fmtNum(f.totalSessions)}</p><p className="mt-1 font-mono text-white">= {fmtVND(f.courtCost)}</p></>}
        />
        {hasEquipment && (
          <StatCard
            icon={Target} label={t('dash_shuttle_cost')} value={fmtVND(f.shuttleCost)} sub={`${f.boxes} ${t('dash_boxes')}`} tone="cyan"
            tip={<><p className="font-semibold text-white">{t('calc_shuttle_title')}</p><p className="mt-1.5 font-mono text-cyan-300">⌈{fmtNum(f.totalSessions)} × {fmtNum(num(settings.estimated_shuttlecocks))} ÷ {BALLS_PER_BOX}⌉ = {f.boxes} {t('dash_boxes')}</p><p className="mt-1 font-mono text-cyan-300">{f.boxes} × {fmtVND(num(settings.price_per_box))}</p><p className="mt-1 font-mono text-white">= {fmtVND(f.shuttleCost)}</p></>}
          />
        )}
        <StatCard
          icon={Wallet} label={t('dash_total_cycle')} value={fmtVND(f.totalCost)} sub={curLabel}
          tip={<><p className="font-semibold text-white">{t('dash_total_cost')}</p><p className="mt-1.5 font-mono text-lime-300">{fmtVND(f.courtCost)} + {hasEquipment ? fmtVND(f.shuttleCost) : '0'}</p><p className="mt-1 font-mono text-white">= {fmtVND(f.totalCost)}</p></>}
        />
      </div>

      {/* Next cycle */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <ArrowRight className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">{t('dash_next_cycle')} · {nextLabel}</span>
          </div>
          {delta !== 0 && (
            <Badge tone={delta > 0 ? 'red' : 'volt'} icon={delta > 0 ? TrendingUp : TrendingDown}>
              {delta > 0 ? '+' : '−'}{fmtVND(Math.abs(delta))} {t('dash_vs_current')}
            </Badge>
          )}
        </div>
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-400">{t('dash_sessions')}</p>
            <p className="font-mono text-lg font-black text-slate-900">{fmtNum(fn.totalSessions)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-400">{t('dash_total_cost')}</p>
            <p className="font-mono text-lg font-black text-slate-900">{fmtVND(fn.totalCost)}</p>
          </div>
          <div className="rounded-2xl bg-slate-900 p-3 text-center">
            <p className="text-xs text-slate-400">{t('dash_per_member')}</p>
            <p className="font-mono text-lg font-black text-lime-400">{fmtVND(fn.suggestedFee)}</p>
          </div>
        </div>
      </div>

      <AdvancedForecast forecast={f} plan={plan} onUnlock={onUnlock} />
    </div>
  )
}

export function DashboardPage({ club, settings, members, logs, fundTxns, pollTally, plan, sport, canEdit, onUnlock, onChanged, toast }) {
  const memberCount = pollTally?.count ?? members.length
  const memberSource = pollTally?.source === 'poll' ? 'poll' : 'list'

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ForecastDashboard
          settings={settings}
          memberCount={memberCount}
          memberSource={memberSource}
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
          canEdit={canEdit}
          onChanged={onChanged}
          onHitLimit={onUnlock}
          toast={toast}
        />
      </div>
    </div>
  )
}
