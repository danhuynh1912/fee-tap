import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, AlertTriangle, Clock, Package, ChevronRight, Users } from 'lucide-react'
import { cx, fmtVND, fmtNum } from '../../lib/utils'
import { computePaymentTimeline, formatPeriodLabel } from '../../engine/forecast'
import { Badge } from '../ui/Badge'

function DeadlineBadge({ daysUntilNext, t }) {
  if (daysUntilNext === null) return null
  if (daysUntilNext < 0) return <Badge tone="red">{t('timeline_overdue')}</Badge>
  if (daysUntilNext === 0) return <Badge tone="red">{t('timeline_due_today')}</Badge>
  if (daysUntilNext <= 7) return <Badge tone="red">{t('timeline_days_left', { n: daysUntilNext })}</Badge>
  if (daysUntilNext <= 30) return <Badge tone="amber">{t('timeline_days_left', { n: daysUntilNext })}</Badge>
  return <Badge tone="slate">{t('timeline_days_left', { n: daysUntilNext })}</Badge>
}

function ProgressBar({ value, max, tone = 'slate' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div
        className={cx('h-full rounded-full transition-all', tone === 'volt' ? 'bg-lime-400' : 'bg-slate-400')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Running slot card ─────────────────────────────────────────────────────────
function RunningSlotCard({ result, lang, t }) {
  const { slot, period, totalSessions, happened, courtCost, currentDeadline } = result
  const pct = totalSessions > 0 ? Math.round((happened / totalSessions) * 100) : 0

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900">{slot.name}</span>
            {slot.venue_name && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="h-3 w-3" />{slot.venue_name}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{formatPeriodLabel(period, lang)}</p>
        </div>
        <span className="font-mono text-sm font-bold text-slate-900 shrink-0">{fmtVND(courtCost)}</span>
      </div>

      {totalSessions > 0 && (
        <div className="space-y-1">
          <ProgressBar value={happened} max={totalSessions} tone="volt" />
          <p className="text-xs text-slate-400">
            {t('timeline_sessions_progress', { done: happened, total: totalSessions })}
          </p>
        </div>
      )}

      {currentDeadline && (
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t('timeline_deadline')} {currentDeadline.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}
        </p>
      )}
    </div>
  )
}

// ── Upcoming slot card ────────────────────────────────────────────────────────
function UpcomingSlotCard({ result, lang, t }) {
  const { slot, nextPeriod, nextSessions, nextCourtCost } = result

  return (
    <div className="p-4 flex items-start justify-between gap-3 bg-white">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-slate-900">{slot.name}</span>
          {slot.venue_name && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin className="h-3 w-3" />{slot.venue_name}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {formatPeriodLabel(nextPeriod, lang)}
          {nextSessions > 0 && <> · {fmtNum(nextSessions)} {t('dash_sessions')}</>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-sm font-bold text-slate-900">{fmtVND(nextCourtCost)}</p>
        <p className="text-[11px] text-slate-400">{t('timeline_court_cost')}</p>
      </div>
    </div>
  )
}

// ── Shuttle status card ───────────────────────────────────────────────────────
function ShuttleCard({ shuttle, t }) {
  if (!shuttle) return null

  if (shuttle.mode === 'inventory') {
    const isLow = shuttle.sessionsLeft < 8
    return (
      <div className={cx('rounded-2xl border p-4 space-y-2', isLow ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-white')}>
        <div className="flex items-center gap-2">
          <Package className={cx('h-4 w-4', isLow ? 'text-amber-500' : 'text-slate-400')} />
          <span className="text-sm font-semibold text-slate-700">{t('shuttle_mode_inventory')}</span>
          {isLow && <Badge tone="amber"><AlertTriangle className="h-3 w-3 mr-1" />{t('timeline_shuttle_restock_soon')}</Badge>}
        </div>
        <p className="font-mono text-base font-bold text-slate-900">
          {t('timeline_shuttle_stock', { n: shuttle.boxesLeft, sessions: shuttle.sessionsLeft })}
        </p>
        {shuttle.estimatedEmptyDate && (
          <p className="text-xs text-slate-400">
            {shuttle.estimatedEmptyDate.toLocaleDateString()}
          </p>
        )}
      </div>
    )
  }

  // estimate mode
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{t('timeline_shuttle_estimate')}</span>
        </div>
        <span className="font-mono text-sm font-bold text-slate-900">{fmtVND(shuttle.cost)}</span>
      </div>
      <p className="text-xs text-slate-400">{fmtNum(shuttle.totalSessions)} lượt sân · {fmtNum(shuttle.boxes)} hộp</p>
    </div>
  )
}

// ── Payment group summary bar ─────────────────────────────────────────────────
function GroupSummary({ courtCost, shuttleCost, effectiveCount, t, isLast, canEdit, nextAdjustedFee, projectedBalance, projectedSurplus }) {
  const total = courtCost + shuttleCost
  const perMember = effectiveCount > 0 ? Math.ceil(total / effectiveCount) : 0
  if (total === 0) return null
  return (
    <div className={cx('bg-slate-900 text-white px-5 py-4 space-y-3', isLast ? '' : '')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-300">{effectiveCount} {t('members')}</span>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-black text-lime-400">{fmtVND(perMember)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t('timeline_per_member')}</p>
        </div>
      </div>
      <div className="border-t border-slate-700 pt-3 space-y-1.5">
        {courtCost > 0 && (
          <div className="flex justify-between text-xs text-slate-400">
            <span>{t('dash_court_cost')}</span>
            <span className="font-mono">{fmtVND(courtCost)}</span>
          </div>
        )}
        {shuttleCost > 0 && (
          <div className="flex justify-between text-xs text-slate-400">
            <span>{t('dash_shuttle_cost')}</span>
            <span className="font-mono">{fmtVND(shuttleCost)}</span>
          </div>
        )}
      </div>
      {canEdit && nextAdjustedFee > 0 && (
        <div className={cx('rounded-xl px-4 py-3 flex items-center justify-between mt-1', projectedSurplus ? 'bg-lime-900/40' : 'bg-red-900/30')}>
          <p className="text-xs text-slate-400">{t('dash_next_topup_fee')}</p>
          <div className="text-right">
            <p className={cx('font-mono text-lg font-black', projectedSurplus ? 'text-lime-400' : 'text-red-400')}>
              {fmtVND(nextAdjustedFee)}
            </p>
            {projectedBalance !== 0 && (
              <p className="text-[10px] text-slate-500 mt-0.5">{t('dash_incl_carryover')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main PaymentTimeline ──────────────────────────────────────────────────────
export function PaymentTimeline({ slots, settings, memberCount, committedCount, sport, showRunning = true, canEdit = false, nextAdjustedFee = 0, projectedBalance = 0, projectedSurplus = true }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const settingsWithEquip = useMemo(() => ({
    ...settings,
    _hasEquipment: sport?.hasEquipment ?? true,
  }), [settings, sport])

  const timeline = useMemo(
    () => computePaymentTimeline(slots, settingsWithEquip, memberCount),
    [slots, settingsWithEquip, memberCount]
  )

  const effectiveCount = timeline.effectiveMemberCount
  const openSpots = settings.fee_split_mode === 'total_members' && committedCount !== null
    ? Math.max(0, memberCount - committedCount) : 0

  // Build payment groups — merge items whose deadlines fall in the same month
  const paymentGroups = useMemo(() => {
    const monthKey = (d) => d ? `${d.getFullYear()}-${d.getMonth()}` : 'no-deadline'
    const groups = new Map()

    const getOrCreate = (deadline, daysUntil) => {
      const key = monthKey(deadline)
      if (!groups.has(key)) {
        groups.set(key, { deadline, daysUntil, courtItems: [], shuttleItem: null })
      } else {
        // Keep the earliest deadline in the group as the header
        const g = groups.get(key)
        if (deadline && (!g.deadline || deadline < g.deadline)) {
          g.deadline = deadline
          g.daysUntil = daysUntil
        }
      }
      return groups.get(key)
    }

    if (timeline.nextShuttleItem) {
      const g = getOrCreate(timeline.nextShuttleItem.deadline, timeline.nextShuttleItem.daysUntil)
      g.shuttleItem = timeline.nextShuttleItem
    }

    for (const r of timeline.upcoming) {
      const g = getOrCreate(r.nextDeadline, r.daysUntilNext)
      g.courtItems.push(r)
    }

    return [...groups.values()].sort((a, b) => {
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline - b.deadline
    })
  }, [timeline])

  if (!slots || !slots.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm">
        {t('timeline_no_slots')}
      </div>
    )
  }

  const locale = lang === 'vi' ? 'vi-VN' : 'en-US'

  return (
    <div className="space-y-6">
      {/* ── Running ── */}
      {showRunning && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{t('timeline_running_title')}</p>
          <div className="space-y-3">
            {timeline.running.map((r, i) => (
              <RunningSlotCard key={r.slot.id || i} result={r} lang={lang} t={t} />
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming — one card per deadline group ── */}
      {paymentGroups.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('timeline_upcoming_title')}</p>
          {paymentGroups.map((group, gi) => {
            const courtCost = group.courtItems.reduce((s, r) => s + r.nextCourtCost, 0)
            const shuttleCost = group.shuttleItem?.cost ?? 0
            const isLastGroup = gi === paymentGroups.length - 1

            return (
              <div key={gi} className="rounded-3xl border border-slate-200 overflow-hidden">
                {/* deadline header */}
                {group.deadline && (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">
                      {t('timeline_deadline')} {group.deadline.toLocaleDateString(locale)}
                    </span>
                    <DeadlineBadge daysUntilNext={group.daysUntil} t={t} />
                  </div>
                )}

                {/* items */}
                <div className="divide-y divide-slate-100">
                  {/* shuttle item */}
                  {group.shuttleItem && (
                    <div className="p-4 flex items-start justify-between gap-3 bg-white">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-sm text-slate-900">{t('timeline_shuttle_estimate')}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatPeriodLabel(group.shuttleItem.period, lang)} · {fmtNum(group.shuttleItem.sessions)} {t('dash_sessions')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold text-slate-900">{fmtVND(group.shuttleItem.cost)}</p>
                        <p className="text-[11px] text-slate-400">{fmtNum(group.shuttleItem.boxes)} {t('dash_boxes')}</p>
                      </div>
                    </div>
                  )}

                  {/* court items */}
                  {group.courtItems.map((r, i) => (
                    <UpcomingSlotCard
                      key={r.slot.id || i}
                      result={r} lang={lang}
                      memberCount={effectiveCount}
                      t={t}
                    />
                  ))}
                </div>

                {/* open spots warning — only on last group */}
                {isLastGroup && openSpots > 0 && (
                  <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-800">{t('timeline_open_spots', { n: openSpots })}</p>
                      <p className="text-amber-700 text-xs mt-0.5">{t('timeline_open_spots_hint')}</p>
                    </div>
                  </div>
                )}

                {/* per-group summary */}
                <GroupSummary
                  courtCost={courtCost}
                  shuttleCost={shuttleCost}
                  effectiveCount={effectiveCount}
                  t={t}
                  isLast={isLastGroup}
                  canEdit={canEdit && isLastGroup}
                  nextAdjustedFee={nextAdjustedFee}
                  projectedBalance={projectedBalance}
                  projectedSurplus={projectedSurplus}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
