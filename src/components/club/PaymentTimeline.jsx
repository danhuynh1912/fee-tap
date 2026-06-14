import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, AlertTriangle, Clock, Package, Users, CheckCircle2, QrCode, PlusCircle, Loader2 } from 'lucide-react'
import { cx, fmtVND, fmtNum } from '../../lib/utils'
import { computePaymentTimeline, formatPeriodLabel } from '../../engine/forecast'
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
          <span className="font-semibold text-sm text-slate-900">{slot.name}</span>
          {slot.venue_name && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin className="h-3 w-3" />
              {slot.venue_name}
            </span>
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
          <Package className={cx('h-4 w-4', isLow ? 'text-amber-500' : 'text-slate-400')} />
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
          <Package className="h-4 w-4 text-slate-400" />
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
  onPayQR,
  openingCollection,
  payosConfigured,
}) {
  const total = courtCost + shuttleCost
  const perMember = effectiveCount > 0 ? Math.ceil(total / effectiveCount) : 0
  if (total === 0) return null

  const paidPayments = groupPayments.filter((p) => p.status === 'paid' || p.status === 'manual')
  const paidCount = paidPayments.length
  const totalMembers = effectiveCount || members.length
  const myIsPaid = myRecord && (myRecord.status === 'paid' || myRecord.status === 'manual')

  return (
    <div className="bg-slate-900 text-white px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-300">
            {effectiveCount} {t('members')}
          </span>
        </div>
        <div className="text-right">
          <p className={cx('font-mono text-2xl font-black', hasCommitted ? 'text-lime-400' : 'text-yellow-400')}>{fmtVND(perMember)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t('timeline_per_member')}</p>
          {!hasCommitted && (
            <p className="text-[10px] text-slate-500 mt-0.5">{t('no_cycle_committed')}</p>
          )}
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
            {/* Paid member avatars */}
            {paidPayments.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">{t('collection_paid_members_label')}</span>
                <PaidAvatars paidPayments={paidPayments} members={members} />
              </div>
            )}

            {/* Paid count progress + admin view button */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={cx('h-4 w-4', paidCount > 0 ? 'text-lime-400' : 'text-slate-600')} />
                <span className="text-xs text-slate-400">{t('collection_paid_count', { paid: paidCount, total: totalMembers })}</span>
              </div>
              {canEdit && (
                <Button variant="darkSubtle" size="sm" onClick={onViewCollection}>
                  {t('collection_view_btn')}
                </Button>
              )}
            </div>

            {/* Member own payment status + QR (if PayOS ready) — shown for both member and admin */}
            {currentMemberId && (
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
                {/* QR button only when PayOS configured AND member has a record AND not yet paid */}
                {!myIsPaid && myRecord && payosConfigured && (
                  <Button variant="volt" size="sm" onClick={() => onPayQR(perMember)}>
                    <QrCode className="h-4 w-4" /> {t('payment_qr_btn')}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Derive period_start string from a forecast period object ──────────────────
function periodStart(period) {
  if (!period?.months?.length) return null
  const m = period.months[0]
  return `${m.year}-${String(m.month0 + 1).padStart(2, '0')}-01`
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

  const timeline = useMemo(() => computePaymentTimeline(slots, settingsWithEquip, memberCount), [slots, settingsWithEquip, memberCount])

  const hasCommitted = committedCount != null && committedCount > 0
  const effectiveCount = hasCommitted ? committedCount : timeline.effectiveMemberCount
  const openSpots = !hasCommitted && settings.fee_split_mode === 'total_members' && committedCount !== null ? Math.max(0, memberCount - committedCount) : 0

  const paymentGroups = useMemo(() => {
    const monthKey = (d) => (d ? `${d.getFullYear()}-${d.getMonth()}` : 'no-deadline')
    const groups = new Map()
    const getOrCreate = (deadline, daysUntil) => {
      const key = monthKey(deadline)
      if (!groups.has(key)) {
        groups.set(key, { deadline, daysUntil, courtItems: [], shuttleItem: null })
      } else {
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

  async function openCollection(group, courtCost, shuttleCost) {
    const ps = group.courtItems[0]?.nextPeriod
      ? periodStart(group.courtItems[0].nextPeriod)
      : group.shuttleItem?.period
        ? periodStart(group.shuttleItem.period)
        : null
    if (!ps || !clubId) return

    const perMember = effectiveCount > 0 ? Math.ceil((courtCost + shuttleCost) / effectiveCount) : 0
    const title = group.courtItems[0]?.slot?.name || (group.shuttleItem ? t('timeline_shuttle_estimate') : t('collection_open_btn'))

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
            const courtCost = group.courtItems.reduce((s, r) => s + r.nextCourtCost, 0)
            const shuttleCost = group.shuttleItem?.cost ?? 0
            const isLastGroup = gi === paymentGroups.length - 1

            // Match this group to a payment_collection by period_start
            const ps = group.courtItems[0]?.nextPeriod
              ? periodStart(group.courtItems[0].nextPeriod)
              : group.shuttleItem?.period
                ? periodStart(group.shuttleItem.period)
                : null
            const collection = ps ? collections.find((c) => c.period_start === ps) : null
            const groupPayments = collection ? memberPayments.filter((p) => p.collection_id === collection.id) : []
            const myRecord = currentMemberId ? groupPayments.find((p) => p.member_id === currentMemberId) : null

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
                        <p className="text-[11px] text-slate-400">
                          {fmtNum(group.shuttleItem.boxes)} {t('dash_boxes')}
                        </p>
                      </div>
                    </div>
                  )}
                  {group.courtItems.map((r, i) => (
                    <UpcomingSlotCard key={r.slot.id || i} result={r} lang={lang} memberCount={effectiveCount} t={t} />
                  ))}
                </div>

                {isLastGroup && openSpots > 0 && (
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
                  onOpenCollection={() => openCollection(group, courtCost, shuttleCost)}
                  onViewCollection={() => setCollectionModal({ collection, groupPayments, committedUserIds: pollTally?.committedUserIds })}
                  onPayQR={(liveAmount) => {
                    const m = members.find((m) => m.id === currentMemberId)
                    setQrModal({ record: myRecord, memberName: m?.name || '', liveAmount })
                  }}
                  isPro={plan === 'pro'}
                  payosConfigured={payosConfigured}
                />

                {/* Inline cycle vote — first group only, always rendered */}
                {gi === 0 && cycleVoteProps && (
                  <CycleVoteInline {...cycleVoteProps} />
                )}
              </div>
              </div>
            )
          })}
        </div>
      )}

      {/* QR payment modal (member) */}
      <PaymentQRModal
        open={!!qrModal}
        onClose={() => setQrModal(null)}
        record={qrModal?.record}
        memberName={qrModal?.memberName}
        liveAmount={qrModal?.liveAmount}
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
