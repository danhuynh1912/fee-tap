import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, AlertTriangle, Clock, Feather, Users, CheckCircle2, QrCode, PlusCircle, Loader2, Link, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { cx, fmtVND, fmtNum } from '../../lib/utils'
import { computePaymentTimeline, formatPeriodLabel, computeShuttleForPeriodStart, periodStart, buildBasePaymentGroups } from '../../engine/forecast'
import { resolveFeeContext } from '../../engine/fee/resolveFeeContext'
import { computeGuestRecruitment } from '../../engine/fee/computeGuestRecruitment'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { PaymentQRModal } from './PaymentQRModal'
import { PaymentCollectionModal } from './PaymentCollectionModal'
import { CycleVoteInline } from './vote/CycleVoteInline'

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
      <div className={cx('h-full rounded-full transition-all', tone === 'volt' ? 'bg-lime-400' : 'bg-slate-400')} style={{ width: `${pct}%` }} />
    </div>
  )
}

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
                <MapPin className="h-3 w-3" />
                {slot.venue_name}
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
          <p className="text-xs text-slate-400">{t('timeline_sessions_progress', { done: happened, total: totalSessions })}</p>
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

function UpcomingSlotCard({ result, lang, t }) {
  const { slot, nextPeriod, nextSessions, nextCourtCost } = result
  return (
    <div className="p-4 flex items-start justify-between gap-3 bg-white">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-sm text-slate-900">{slot.name}</span>
          </span>
          {slot.venue_name && (
            <span className="text-xs text-slate-400">{slot.venue_name}</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {formatPeriodLabel(nextPeriod, lang)}
          {nextSessions > 0 && (
            <>
              {' '}
              · {fmtNum(nextSessions)} {t('dash_sessions')}
            </>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-sm font-bold text-slate-900">{fmtVND(nextCourtCost)}</p>
        <p className="text-[11px] text-slate-400">{t('timeline_court_cost')}</p>
      </div>
    </div>
  )
}

function ShuttleCard({ shuttle, t }) {
  if (!shuttle) return null
  if (shuttle.mode === 'inventory') {
    const isLow = shuttle.sessionsLeft < 8
    return (
      <div className={cx('rounded-2xl border p-4 space-y-2', isLow ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-white')}>
        <div className="flex items-center gap-2">
          <Feather className={cx('h-4 w-4', isLow ? 'text-amber-500' : 'text-slate-400')} />
          <span className="text-sm font-semibold text-slate-700">{t('shuttle_mode_inventory')}</span>
          {isLow && (
            <Badge tone="amber">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {t('timeline_shuttle_restock_soon')}
            </Badge>
          )}
        </div>
        <p className="font-mono text-base font-bold text-slate-900">
          {t('timeline_shuttle_stock', { n: shuttle.boxesLeft, sessions: shuttle.sessionsLeft })}
        </p>
        {shuttle.estimatedEmptyDate && <p className="text-xs text-slate-400">{shuttle.estimatedEmptyDate.toLocaleDateString()}</p>}
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Feather className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{t('timeline_shuttle_estimate')}</span>
        </div>
        <span className="font-mono text-sm font-bold text-slate-900">{fmtVND(shuttle.cost)}</span>
      </div>
      <p className="text-xs text-slate-400">
        {fmtNum(shuttle.totalSessions)} lượt sân · {fmtNum(shuttle.boxes)} hộp
      </p>
    </div>
  )
}

// ── Paid member avatars row ───────────────────────────────────────────────────
function PaidAvatars({ paidPayments, members }) {
  if (!paidPayments.length) return null
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {paidPayments.map((p) => {
        const m = members.find((m) => m.id === p.member_id)
        if (!m) return null
        return m.avatar_url ? (
          <img
            key={m.id}
            src={m.avatar_url}
            alt={m.name}
            title={m.name}
            className="h-6 w-6 rounded-full border-2 border-white object-cover shadow-sm"
          />
        ) : (
          <div key={m.id} title={m.name} className="h-6 w-6 rounded-full border-2 border-white bg-slate-900 grid place-items-center shadow-sm">
            <span className="text-[8px] font-black text-lime-400">{m.name[0].toUpperCase()}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Group summary bar ─────────────────────────────────────────────────────────
function GroupSummary({
  courtCost,
  shuttleCost,
  effectiveCount,
  hasCommitted,
  feeCtx,
  shuttlePeriod,
  slots,
  settings,
  t,
  isLast,
  canEdit,
  nextAdjustedFee,
  projectedBalance,
  projectedSurplus,
  collection,
  groupPayments,
  myRecord,
  currentMemberId,
  members,
  onOpenCollection,
  onViewCollection,
  onCopyLink,
  onPayQR,
  openingCollection,
  payosConfigured,
  collectionSize,
}) {
  const isFixedCount = feeCtx?.isFixed ?? false
  const total = courtCost + (shuttleCost ?? 0)
  const perMember = effectiveCount > 0 ? Math.ceil(total / effectiveCount) : 0
  // All hooks before early return (Rules of Hooks)
  const [proxyOpen, setProxyOpen] = useState(false)
  const [proxyRecordIds, setProxyRecordIds] = useState(new Set())

  const proxyOptions = useMemo(
    () =>
      groupPayments
        .filter((r) => r.member_id !== currentMemberId && r.status === 'pending')
        .map((r) => ({ record: r, member: members.find((m) => m.id === r.member_id) }))
        .filter(({ member }) => !!member),
    [groupPayments, currentMemberId, members]
  )

  const proxyRecords = useMemo(
    () => proxyOptions.filter(({ record: r }) => proxyRecordIds.has(r.id)).map(({ record: r }) => r),
    [proxyOptions, proxyRecordIds]
  )

  function toggleProxy(recordId) {
    setProxyRecordIds((prev) => {
      const next = new Set(prev)
      next.has(recordId) ? next.delete(recordId) : next.add(recordId)
      return next
    })
  }

  if (total === 0) return null

  const paidPayments = groupPayments.filter((p) => p.status === 'paid' || p.status === 'manual')
  const paidCount = paidPayments.length
  const totalMembers = collectionSize ?? feeCtx?.totalMembers ?? members.length
  const myIsPaid = myRecord && (myRecord.status === 'paid' || myRecord.status === 'manual')

  const guestRecruitment = isFixedCount && shuttleCost > 0 && collection
    ? computeGuestRecruitment({ feeCtx, perMember, shuttleCost, period: shuttlePeriod, slots, settings })
    : null

  return (
    <div className="bg-slate-900 text-white px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-300">
            {effectiveCount} {isFixedCount ? t('slots_per_session') : t('members')}
          </span>
        </div>
        <div className="text-right">
          <p className={cx('font-mono text-2xl font-black', (hasCommitted || isFixedCount) ? 'text-lime-400' : 'text-yellow-400')}>{fmtVND(perMember)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t('timeline_per_member')}</p>
          {!hasCommitted && !isFixedCount && (
            <p className="text-[10px] text-slate-500 mt-0.5">{t('no_cycle_committed')}</p>
          )}
        </div>
      </div>


      {canEdit && nextAdjustedFee > 0 && isLast && (
        <div className={cx('rounded-xl px-4 py-3 flex items-center justify-between mt-1', projectedSurplus ? 'bg-lime-900/40' : 'bg-red-900/30')}>
          <p className="text-xs text-slate-400">{t('dash_next_topup_fee')}</p>
          <div className="text-right">
            <p className={cx('font-mono text-lg font-black', projectedSurplus ? 'text-lime-400' : 'text-red-400')}>{fmtVND(nextAdjustedFee)}</p>
            {projectedBalance !== 0 && <p className="text-[10px] text-slate-500 mt-0.5">{t('dash_incl_carryover')}</p>}
          </div>
        </div>
      )}

      {/* ── Payment collection status ── */}
      <div className="border-t border-slate-700 pt-3 space-y-2">
        {/* Admin: no collection yet → open button (always available) */}
        {!collection && canEdit && (
          <Button variant="volt" size="sm" className="w-full" onClick={onOpenCollection} disabled={openingCollection}>
            {openingCollection ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <PlusCircle className="h-4 w-4" /> {t('collection_open_btn')}
              </>
            )}
          </Button>
        )}

        {/* Collection open: show member payment status */}
        {collection && (
          <>
            {/* Paid member avatars + count progress + copy link + admin view button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {paidPayments.length > 0 && (
                  <>
                    <span className="text-xs text-slate-400">{t('collection_paid_members_label')}</span>
                    <PaidAvatars paidPayments={paidPayments} members={members} />
                  </>
                )}
                <span className="text-xs text-slate-400">{paidCount}/{totalMembers}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {onCopyLink && (
                  <button
                    onClick={onCopyLink}
                    title={t('collection_copy_link')}
                    className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-700 px-2 py-1.5 text-xs font-semibold text-slate-400 hover:border-slate-500 hover:text-slate-200 transition active:scale-[0.97]"
                  >
                    <Link className="h-3 w-3" />
                    <span>{t('collection_copy_link')}</span>
                  </button>
                )}
                {canEdit && (
                  <Button variant="darkSubtle" size="sm" className="hidden sm:inline-flex" onClick={onViewCollection}>
                    {t('collection_view_btn')}
                  </Button>
                )}
              </div>
            </div>

            {/* Member own payment status + QR (if PayOS ready) — shown for both member and admin */}
            {currentMemberId && (
              <div className="flex flex-col gap-2">
                {/* Status row: paid/pending + icon buttons (copy + view) */}
                <div className="flex items-center justify-between gap-3">
                  {myIsPaid ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-lime-400" />
                      <span className="text-sm font-semibold text-lime-400">{t('payment_status_paid')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-400">{t('payment_status_pending')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 sm:hidden">
                    {onCopyLink && (
                      <button
                        onClick={onCopyLink}
                        title={t('collection_copy_link')}
                        className="flex items-center gap-1 rounded-xl border border-slate-700 px-2 py-1.5 text-xs font-semibold text-slate-400 hover:border-slate-500 hover:text-slate-200 transition active:scale-[0.97]"
                      >
                        <Link className="h-3 w-3" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={onViewCollection}
                        title={t('collection_view_btn')}
                        className="flex items-center gap-1 rounded-xl border border-slate-700 px-2 py-1.5 text-xs font-semibold text-slate-400 hover:border-slate-500 hover:text-slate-200 transition active:scale-[0.97]"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Proxy picker + QR button — side by side */}
                {!myIsPaid && myRecord && payosConfigured && (
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    {proxyOptions.length > 0 && (
                      <div className="relative flex-1 rounded-xl border border-slate-700 overflow-visible">
                        <button
                          onClick={() => setProxyOpen((v) => !v)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-slate-800 rounded-xl"
                        >
                          <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {t('proxy_pay_section')}
                          </span>
                          {proxyRecordIds.size > 0 && (
                            <span className="rounded-full bg-lime-900/60 px-2 py-0.5 text-xs font-bold text-lime-400">
                              +{proxyRecordIds.size}
                            </span>
                          )}
                          {proxyOpen
                            ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                            : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                        </button>
                        {proxyOpen && (
                          <ul className="absolute left-0 right-0 top-full z-10 mt-1 divide-y divide-slate-800 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                            {proxyOptions.map(({ record: r, member: m }) => (
                              <li key={r.id}>
                                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-slate-800 first:rounded-t-xl last:rounded-b-xl">
                                  <input
                                    type="checkbox"
                                    checked={proxyRecordIds.has(r.id)}
                                    onChange={() => toggleProxy(r.id)}
                                    className="h-4 w-4 accent-lime-400 cursor-pointer"
                                  />
                                  <span className="text-sm font-medium text-slate-300">{m.name}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    <Button
                      variant="volt"
                      size="sm"
                      className="shrink-0"
                      onClick={() => onPayQR(perMember, proxyRecords)}
                    >
                      <QrCode className="h-4 w-4" />
                      {proxyRecords.length > 0
                        ? t('proxy_pay_total', { amount: fmtVND(perMember * (1 + proxyRecords.length)), n: 1 + proxyRecords.length })
                        : t('payment_qr_btn')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main PaymentTimeline ──────────────────────────────────────────────────────
export function PaymentTimeline({
  slots,
  settings,
  memberCount,
  committedCount,
  sport,
  showRunning = true,
  canEdit = false,
  nextAdjustedFee = 0,
  projectedBalance = 0,
  projectedSurplus = true,
  collections = [],
  memberPayments = [],
  currentMemberId = null,
  payosConfigured = false,
  plan = 'free',
  members = [],
  clubId,
  toast,
  onReload,
  pollTally = null,
  cycleVoteProps = null,
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const [openingGroup, setOpeningGroup] = useState(null) // period_start of the group being opened
  const [qrModal, setQrModal] = useState(null) // { record, memberName }
  const [collectionModal, setCollectionModal] = useState(null) // { collection, groupPayments, committedUserIds }
  const settingsWithEquip = useMemo(
    () => ({
      ...settings,
      _hasEquipment: sport?.hasEquipment ?? true,
    }),
    [settings, sport]
  )

  const timeline = useMemo(() => computePaymentTimeline(slots, settingsWithEquip, memberCount, committedCount ?? null), [slots, settingsWithEquip, memberCount, committedCount])

  const effectiveCountFor = (ps) =>
    resolveFeeContext({ settings, memberCount, committedCount, pollTally, periodStart: ps })

  const paymentGroups = useMemo(() => {
    const groups = buildBasePaymentGroups(timeline)

    // Collect period_starts already covered by upcoming groups
    const coveredPeriodStarts = new Set(
      [...groups.values()].map((g) => {
        if (g.courtItems[0]?.nextPeriod) return periodStart(g.courtItems[0].nextPeriod)
        if (g.shuttleItem?.period) return periodStart(g.shuttleItem.period)
        return null
      }).filter(Boolean)
    )

    // Inject open collections that are past their period but still have pending members
    for (const col of (collections || [])) {
      if (col.status !== 'open') continue
      if (coveredPeriodStarts.has(col.period_start)) continue
      const hasPending = (memberPayments || []).some((p) => p.collection_id === col.id && p.status === 'pending')
      if (!hasPending) continue
      const deadline = col.deadline ? new Date(col.deadline) : null
      const daysUntil = deadline ? Math.ceil((deadline - new Date()) / 86400000) : null
      const key = col.period_start ?? `orphan-${col.id}`
      groups.set(key, { deadline, daysUntil, courtItems: [], shuttleItem: null, _orphanCollection: col })
    }

    return [...groups.values()].sort((a, b) => {
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline - b.deadline
    })
  }, [timeline, collections, memberPayments])

  async function openCollection(group, courtCost) {
    const ps = group.courtItems[0]?.nextPeriod ? periodStart(group.courtItems[0].nextPeriod) : null
    if (!ps || !clubId) return

    const { effectiveCount: groupEffectiveCount } = effectiveCountFor(ps)
    const perMember = groupEffectiveCount > 0 ? Math.ceil(courtCost / groupEffectiveCount) : 0
    const title = group.courtItems[0]?.slot?.name || t('collection_open_btn')

    setOpeningGroup(ps)
    try {
      // Insert collection
      const { data: col, error: colErr } = await supabase
        .from('payment_collections')
        .insert({
          club_id: clubId,
          period_start: ps,
          deadline: group.deadline ? group.deadline.toISOString().slice(0, 10) : null,
          title,
          amount_per_member: perMember,
          status: 'open',
        })
        .select()
        .single()
      if (colErr) throw colErr

      // Ensure synthetic host has a real club_members row before creating payment records
      let resolvedMembers = members
      const syntheticHost = members.find((m) => m._synthetic)
      if (syntheticHost) {
        const { data: hostRow } = await supabase
          .from('club_members')
          .upsert(
            { club_id: clubId, user_id: syntheticHost.user_id, name: syntheticHost.name },
            { onConflict: 'club_id,user_id', ignoreDuplicates: false }
          )
          .select()
          .single()
        if (hostRow) {
          resolvedMembers = members.map((m) => (m._synthetic ? { ...m, id: hostRow.id, _synthetic: false } : m))
        }
      }

      // Insert one record per member (all now have real UUIDs)
      if (resolvedMembers.length > 0) {
        const records = resolvedMembers.map((m) => ({
          collection_id: col.id,
          club_id: clubId,
          member_id: m.id,
          amount: perMember,
        }))
        const { error: rErr } = await supabase.from('member_payment_records').insert(records)
        if (rErr) throw rErr
      }

      toast?.(t('collection_opened'))
      onReload?.()
    } catch (e) {
      toast?.(e.message || t('err_generic'))
    } finally {
      setOpeningGroup(null)
    }
  }

  if (!slots || !slots.length) {
    return <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm">{t('timeline_no_slots')}</div>
  }

  const locale = lang === 'vi' ? 'vi-VN' : 'en-US'

  return (
    <div className="space-y-6">
      {showRunning && (
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700 mb-3">{t('timeline_running_title')}</p>
          <div className="space-y-3">
            {timeline.running.map((r, i) => (
              <RunningSlotCard key={r.slot.id || i} result={r} lang={lang} t={t} />
            ))}
          </div>
        </div>
      )}

      {paymentGroups.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700">{t('timeline_upcoming_title')}</p>
          {paymentGroups.map((group, gi) => {
            const isLastGroup = gi === paymentGroups.length - 1

            // Match this group to a payment_collection by period_start
            // Fall back to shuttle period when there are no court items in this group
            const psFromSlots = group.courtItems[0]?.nextPeriod
              ? periodStart(group.courtItems[0].nextPeriod)
              : group.shuttleItem?.period
              ? periodStart(group.shuttleItem.period)
              : null
            // Orphan groups carry their collection directly (past period, still pending)
            const collection = group._orphanCollection ?? (psFromSlots ? collections.find((c) => c.period_start === psFromSlots) : null)
            // For orphan groups psFromSlots is null; fall back to collection.period_start so vote binding works
            const ps = psFromSlots ?? collection?.period_start ?? null
            const groupPayments = collection ? memberPayments.filter((p) => p.collection_id === collection.id) : []

            const myRecord = currentMemberId ? groupPayments.find((p) => p.member_id === currentMemberId) : null
            const feeCtx = effectiveCountFor(ps)
            const { hasCommitted, effectiveCount } = feeCtx
            const orphanShuttleData = group._orphanCollection && group.courtItems.length === 0 && !group.shuttleItem
              ? computeShuttleForPeriodStart(collection?.period_start, slots, settings)
              : null
            const courtCost = group._orphanCollection
              ? 0
              : group.courtItems.reduce((s, r) => s + r.nextCourtCost, 0)
            const shuttleCost = orphanShuttleData?.cost ?? group.shuttleItem?.cost ?? 0
            const openSpots =
              feeCtx.votePeriodMatch && settings.fee_split_mode === 'total_members' && committedCount !== null
                ? Math.max(0, memberCount - committedCount)
                : 0

            return (
              <div key={gi}>
              <div className="rounded-3xl border border-slate-200 overflow-hidden">
                {group.deadline && (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">
                      {t('timeline_deadline')} {group.deadline.toLocaleDateString(locale)}
                    </span>
                    <DeadlineBadge daysUntilNext={group.daysUntil} t={t} />
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  {orphanShuttleData && (() => {
                    const shuttleData = orphanShuttleData
                    return (
                      <div className="p-4 flex items-start justify-between gap-3 bg-white">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Feather className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-sm text-slate-900">{collection.title || t('timeline_shuttle_estimate')}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatPeriodLabel(shuttleData.period, lang)}
                            {shuttleData.totalSessions > 0 && <> · {fmtNum(shuttleData.totalSessions)} {t('dash_sessions')}</>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm font-bold text-slate-900">{fmtVND(shuttleData.cost)}</p>
                          <p className="text-[11px] text-slate-400">{fmtNum(shuttleData.boxes)} {t('shuttle_box_unit')}</p>
                        </div>
                      </div>
                    )
                  })()}
                  {group.courtItems.map((r, i) => (
                    <UpcomingSlotCard key={r.slot.id || i} result={r} lang={lang} memberCount={effectiveCount} t={t} />
                  ))}
                  {group.shuttleItem && (
                    <div className="p-4 flex items-start justify-between gap-3 bg-white">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Feather className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-sm text-slate-900">{t('timeline_shuttle_estimate')}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatPeriodLabel(group.shuttleItem.period, lang)}
                          {group.shuttleItem.totalSessions > 0 && <> · {fmtNum(group.shuttleItem.totalSessions)} {t('dash_sessions')}</>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold text-slate-900">{fmtVND(group.shuttleItem.cost)}</p>
                        <p className="text-[11px] text-slate-400">{fmtNum(group.shuttleItem.boxes)} {t('shuttle_box_unit')}</p>
                      </div>
                    </div>
                  )}
                </div>

                {openSpots > 0 && (
                  <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-800">{t('timeline_open_spots', { n: openSpots })}</p>
                      <p className="text-amber-700 text-xs mt-0.5">{t('timeline_open_spots_hint')}</p>
                    </div>
                  </div>
                )}

                <GroupSummary
                  courtCost={courtCost}
                  shuttleCost={shuttleCost}
                  effectiveCount={effectiveCount}
                  hasCommitted={hasCommitted}
                  feeCtx={feeCtx}
                  shuttlePeriod={group.shuttleItem?.period ?? null}
                  slots={slots}
                  settings={settings}
                  t={t}
                  isLast={isLastGroup}
                  canEdit={canEdit}
                  nextAdjustedFee={nextAdjustedFee}
                  projectedBalance={projectedBalance}
                  projectedSurplus={projectedSurplus}
                  collection={collection}
                  groupPayments={groupPayments}
                  myRecord={myRecord}
                  currentMemberId={currentMemberId}
                  members={members}
                  openingCollection={openingGroup === ps}
                  onOpenCollection={() => openCollection(group, courtCost)}
                  onViewCollection={() => setCollectionModal({ collection, groupPayments, committedUserIds: pollTally?.committedUserIds })}
                  onCopyLink={collection ? () => {
                    const url = `${window.location.origin}/club/${clubId}/pay/${collection.id}`
                    navigator.clipboard.writeText(url).then(() => toast?.(t('public_pay_link_copied')))
                  } : undefined}
                  onPayQR={(liveAmount, proxyRecords) => {
                    const m = members.find((m) => m.id === currentMemberId)
                    setQrModal({ record: myRecord, memberName: m?.name || '', liveAmount, proxyRecords: proxyRecords ?? [] })
                  }}
                  isPro={plan === 'pro'}
                  payosConfigured={payosConfigured}
                  collectionSize={group._orphanCollection ? (feeCtx.committedCount > 0 ? feeCtx.committedCount : groupPayments.length || undefined) : undefined}
                />

                {/* Inline cycle vote — shown per collection, 1:1 bound by period_start */}
                {cycleVoteProps && collection && ps && (() => {
                  const total = courtCost + shuttleCost
                  const effectiveCnt = feeCtx?.effectiveCount || memberCount
                  const perMember = effectiveCnt > 0 ? Math.ceil(total / effectiveCnt) : 0
                  const guestRecruitment = feeCtx?.isFixed && shuttleCost > 0 && collection
                    ? computeGuestRecruitment({ feeCtx, perMember, shuttleCost, period: group.shuttleItem?.period ?? orphanShuttleData?.period ?? null, slots, settings })
                    : null
                  return <CycleVoteInline {...cycleVoteProps} periodStart={ps} guestRecruitment={guestRecruitment} />
                })()}
              </div>
              </div>
            )
          })}
        </div>
      )}

      {/* QR payment modal (member) */}
      <PaymentQRModal
        key={`${qrModal?.record?.id}-${(qrModal?.proxyRecords ?? []).map((r) => r.id).sort().join(',')}`}
        open={!!qrModal}
        onClose={() => setQrModal(null)}
        record={qrModal?.record}
        memberName={qrModal?.memberName}
        liveAmount={qrModal?.liveAmount}
        proxyRecords={qrModal?.proxyRecords}
        toast={toast}
      />

      {/* Collection detail modal (admin) */}
      <PaymentCollectionModal
        open={!!collectionModal}
        onClose={() => setCollectionModal(null)}
        collection={collectionModal?.collection}
        memberPayments={collectionModal ? memberPayments.filter((p) => p.collection_id === collectionModal.collection?.id) : []}
        members={members}
        committedUserIds={collectionModal?.committedUserIds}
        toast={toast}
        onSynced={onReload}
        onChanged={() => {
          setCollectionModal(null)
          onReload?.()
        }}
      />
    </div>
  )
}
