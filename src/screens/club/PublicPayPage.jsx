'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, QrCode, Clock, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmtVND } from '../../lib/utils'
import { computePaymentTimeline } from '../../engine/forecast'
import { resolveFeeContext } from '../../engine/fee/resolveFeeContext'
import { SPORT_CONFIGS } from '../../constants/index.js'
import { PaymentQRModal } from '../../components/club/PaymentQRModal'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Toast } from '../../components/ui/Toast'

const STORAGE_KEY = (collectionId) => `pay-identity-${collectionId}`

// Same helper as PaymentTimeline.jsx
function periodStart(period) {
  if (!period?.months?.length) return null
  const m = period.months[0]
  return `${m.year}-${String(m.month0 + 1).padStart(2, '0')}-01`
}

// Mirrors the payment-group building logic in PaymentTimeline.jsx
function buildPaymentGroups(timeline) {
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
  for (const r of timeline.upcoming) {
    const g = getOrCreate(r.nextDeadline, r.daysUntilNext)
    g.courtItems.push(r)
  }
  for (const si of (timeline.upcomingShuttleItems || [])) {
    const g = getOrCreate(si.deadline, si.daysUntil)
    g.shuttleItem = si
  }
  return [...groups.values()]
}

// Compute live perMember + totalMembers for the given collection — same formula as GroupSummary in PaymentTimeline
function computeLiveFee({ collection, slots, settings, memberCount, committedCount, pollTally, sport }) {
  if (!slots?.length || !settings || !collection) return null
  const settingsWithEquip = { ...settings, _hasEquipment: sport?.hasEquipment ?? true }
  const timeline = computePaymentTimeline(slots, settingsWithEquip, memberCount, committedCount ?? null)
  const groups = buildPaymentGroups(timeline)

  for (const group of groups) {
    const ps = group.courtItems[0]?.nextPeriod
      ? periodStart(group.courtItems[0].nextPeriod)
      : group.shuttleItem?.period
      ? periodStart(group.shuttleItem.period)
      : null
    if (ps !== collection.period_start) continue

    const courtCost = group.courtItems.reduce((s, r) => s + r.nextCourtCost, 0)
    const shuttleCost = group.shuttleItem?.cost ?? 0
    const feeCtx = resolveFeeContext({ settings, memberCount, committedCount, pollTally, periodStart: ps })
    const { effectiveCount, isFixed, committedCount: feeCommitted } = feeCtx
    if (effectiveCount <= 0) return null
    const perMember = Math.ceil((courtCost + shuttleCost) / effectiveCount)
    // Mirror GroupSummary: in fixed mode use committedCount as display total, else effectiveCount
    const totalMembers = isFixed && feeCommitted > 0 ? feeCommitted : effectiveCount
    return { perMember, totalMembers }
  }
  return null
}

function usePublicPayData(clubId, collectionId, initialData) {
  const [club, setClub] = useState(initialData?.club ?? null)
  const [collection, setCollection] = useState(initialData?.collection ?? null)
  const [members, setMembers] = useState(initialData?.members ?? [])
  const [payments, setPayments] = useState(initialData?.payments ?? [])
  const [settings, setSettings] = useState(initialData?.settings ?? null)
  const [slots, setSlots] = useState(initialData?.slots ?? [])
  const [pollTally, setPollTally] = useState(initialData?.pollTally ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [notFound, setNotFound] = useState(initialData?.notFound ?? false)

  const load = useCallback(async () => {
    if (!clubId || !collectionId) return
    const [
      { data: clubRow },
      { data: colRow },
      { data: memberRows },
      { data: paymentRows },
      { data: settingsRow },
      { data: slotRows },
    ] = await Promise.all([
      supabase.from('clubs').select('id, name, sport_type').eq('id', clubId).single(),
      supabase.from('payment_collections').select('*').eq('id', collectionId).eq('club_id', clubId).single(),
      supabase.from('club_members').select('id, name, user_id').eq('club_id', clubId).order('name'),
      supabase.from('member_payment_records').select('*').eq('collection_id', collectionId),
      supabase.from('club_settings').select('*').eq('club_id', clubId).single(),
      supabase.from('court_slots').select('*').eq('club_id', clubId),
    ])

    setClub(clubRow ?? null)
    setMembers(memberRows ?? [])
    setPayments(paymentRows ?? [])
    setSettings(settingsRow ?? null)
    setSlots(slotRows ?? [])

    if (!colRow || colRow.status !== 'open') {
      setNotFound(true)
    } else {
      setCollection(colRow)
    }

    const { data: voteRows } = await supabase
      .from('votes')
      .select('id, cycle_period_start, cycle_period_end')
      .eq('club_id', clubId)
      .eq('vote_type', 'membership_cycle')
      .order('created_at', { ascending: false })
      .limit(1)

    if (voteRows?.length) {
      const { data: responses } = await supabase
        .from('responses')
        .select('attending, anonymous_user_id')
        .eq('vote_id', voteRows[0].id)
      const attending = (responses ?? []).filter((r) => r.attending)
      setPollTally({
        count: attending.length,
        source: 'poll',
        committedUserIds: new Set(attending.map((r) => r.anonymous_user_id)),
        voteId: voteRows[0].id,
        cyclePeriodStart: voteRows[0].cycle_period_start,
        cyclePeriodEnd: voteRows[0].cycle_period_end,
      })
    } else {
      setPollTally(null)
    }

    setLoading(false)
  }, [clubId, collectionId])

  useEffect(() => {
    // Always refresh from DB after mount — SSR initialData may be stale if members
    // were added/deleted after the page was server-rendered.
    load()
  }, [load])

  // Realtime: watch payment status changes on this collection
  useEffect(() => {
    if (!collectionId) return
    const channel = supabase
      .channel(`public-pay-${collectionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'member_payment_records',
        filter: `collection_id=eq.${collectionId}`,
      }, (payload) => {
        setPayments((prev) => {
          const idx = prev.findIndex((p) => p.id === payload.new.id)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = { ...prev[idx], ...payload.new }
          return next
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [collectionId])

  return { club, collection, members, payments, settings, slots, pollTally, loading, notFound }
}

export function PublicPayPage({ clubId, collectionId, initialData }) {
  const { t, i18n } = useTranslation()
  const { club, collection, members, payments, settings, slots, pollTally, loading, notFound } = usePublicPayData(clubId, collectionId, initialData)

  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useState(null)
  const toast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimer[0])
    toastTimer[0] = setTimeout(() => setToastMsg(null), 2600)
  }, [toastTimer])

  const [selectedId, setSelectedId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY(collectionId)) ?? '' } catch { return '' }
  })
  // Set of record IDs the user chose to pay on behalf of
  const [proxyRecordIds, setProxyRecordIds] = useState(new Set())
  const [proxyOpen, setProxyOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  function handleSelect(memberId) {
    setSelectedId(memberId)
    setProxyRecordIds(new Set()) // reset proxy when identity changes
    setQrOpen(false)
    try { localStorage.setItem(STORAGE_KEY(collectionId), memberId) } catch { /* ignore */ }
  }

  function toggleProxy(recordId) {
    setProxyRecordIds((prev) => {
      const next = new Set(prev)
      next.has(recordId) ? next.delete(recordId) : next.add(recordId)
      return next
    })
  }

  const selectedMember = members.find((m) => m.id === selectedId) ?? null
  const myRecord = selectedMember ? payments.find((p) => p.member_id === selectedMember.id) ?? null : null
  const myIsPaid = myRecord && (myRecord.status === 'paid' || myRecord.status === 'manual')

  const paidCount = payments.filter((p) => p.status === 'paid' || p.status === 'manual').length

  // Other pending members available for proxy selection
  const proxyOptions = useMemo(
    () =>
      payments
        .filter((r) => r.member_id !== selectedMember?.id && r.status === 'pending')
        .map((r) => ({ record: r, member: members.find((m) => m.id === r.member_id) }))
        .filter(({ member }) => !!member),
    [payments, selectedMember?.id, members]
  )

  // Pre-resolved proxy records passed directly to modal (no picker inside modal)
  const proxyRecords = useMemo(
    () => proxyOptions.filter(({ record: r }) => proxyRecordIds.has(r.id)).map(({ record: r }) => r),
    [proxyOptions, proxyRecordIds]
  )

  // Live fee — same computation as dashboard GroupSummary
  const sport = club ? (SPORT_CONFIGS[club.sport_type] ?? null) : null
  const committedCount = pollTally?.count ?? null
  const liveFee = useMemo(() => computeLiveFee({
    collection,
    slots,
    settings,
    memberCount: members.length,
    committedCount,
    pollTally,
    sport,
  }), [collection, slots, settings, members.length, committedCount, pollTally, sport])

  const livePerMember = liveFee?.perMember ?? null
  const totalInCollection = liveFee?.totalMembers ?? payments.length

  const periodLabel = collection?.period_start
    ? new Date(collection.period_start).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', { month: 'long', year: 'numeric' })
    : null

  const deadline = collection?.deadline ? new Date(collection.deadline) : null
  const daysLeft = deadline
    ? Math.ceil((deadline.setHours(23, 59, 59, 0) - Date.now()) / 86_400_000)
    : null

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  // ── Not found / closed ───────────────────────────────────────────────────────
  if (!club || notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/50 px-4">
        <p className="text-center text-slate-500">
          {!club ? t('public_pay_club_not_found') : t('public_pay_collection_not_found')}
        </p>
      </div>
    )
  }

  // Display amount: live-computed (SSOT) if available, else fall back to record.amount
  const displayAmount = livePerMember ?? myRecord?.amount ?? collection.amount_per_member

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50 text-slate-900 antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <span className="text-sm font-black tracking-tight text-slate-900">SPOFUND</span>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-600">{club.name}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 space-y-4">
        {/* Collection info card */}
        <div className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-900/[0.03] overflow-hidden">
          {/* Title row */}
          <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">{t('payment_collection_label')}</p>
              <h1 className="font-black text-lg text-slate-900 leading-tight">{collection.title}</h1>
              {periodLabel && <p className="text-sm text-slate-500 mt-0.5">{periodLabel}</p>}
            </div>
            {daysLeft !== null && (
              <Badge tone={daysLeft < 0 ? 'red' : daysLeft <= 7 ? 'red' : daysLeft <= 30 ? 'amber' : 'slate'}>
                {daysLeft < 0
                  ? t('timeline_overdue')
                  : daysLeft === 0
                  ? t('timeline_due_today')
                  : t('timeline_days_left', { n: daysLeft })}
              </Badge>
            )}
          </div>

          {/* Amount + progress */}
          <div className="bg-slate-900 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{t('timeline_per_member')}</span>
              {/* livePerMember is the SSOT — same formula as dashboard GroupSummary */}
              <span className="font-mono text-3xl font-black text-lime-400">{fmtVND(displayAmount)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 className={paidCount > 0 ? 'h-3.5 w-3.5 text-lime-400' : 'h-3.5 w-3.5 text-slate-600'} />
              <span>{t('collection_paid_count', { paid: paidCount, total: totalInCollection })}</span>
            </div>
          </div>

          {/* Member selector */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">{t('public_pay_select_member')}</p>
            <select
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 focus:border-slate-400 focus:outline-none"
            >
              <option value="">{t('public_pay_select_placeholder')}</option>
              {/* Only show members who have a payment record in this collection */}
              {payments.map((rec) => {
                const m = members.find((m) => m.id === rec.member_id)
                if (!m) return null
                const paid = rec.status === 'paid' || rec.status === 'manual'
                return (
                  <option key={m.id} value={m.id}>
                    {m.name}{paid ? ' ✓' : ''}
                  </option>
                )
              })}
            </select>

            {/* Own payment status */}
            {selectedMember && (
              <div className="flex items-center justify-between gap-3 pt-1">
                {myIsPaid ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-lime-500" />
                    <span className="text-sm font-semibold text-lime-600">{t('payment_status_paid')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500">{t('payment_status_pending')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Proxy picker — collapsible, shown when identity selected and not yet paid */}
            {selectedMember && !myIsPaid && proxyOptions.length > 0 && (
              <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <button
                  onClick={() => setProxyOpen((v) => !v)}
                  className="flex w-full items-center gap-2 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                >
                  <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t('proxy_pay_section')}
                  </span>
                  {proxyRecordIds.size > 0 && (
                    <span className="rounded-full bg-lime-100 px-2 py-0.5 text-xs font-bold text-lime-700">
                      +{proxyRecordIds.size}
                    </span>
                  )}
                  {proxyOpen
                    ? <ChevronUp className="h-4 w-4 text-slate-400" />
                    : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {proxyOpen && (
                  <ul className="divide-y divide-slate-50 bg-white">
                    {proxyOptions.map(({ record: r, member: m }) => (
                      <li key={r.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={proxyRecordIds.has(r.id)}
                            onChange={() => toggleProxy(r.id)}
                            className="h-4 w-4 accent-lime-500 cursor-pointer"
                          />
                          <span className="text-sm font-medium text-slate-700">{m.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* QR button */}
            {selectedMember && !myIsPaid && myRecord && (
              <Button variant="volt" className="w-full" onClick={() => setQrOpen(true)}>
                <QrCode className="h-4 w-4" />
                {proxyRecordIds.size > 0
                  ? t('proxy_pay_total', { amount: fmtVND((livePerMember ?? myRecord.amount) * (1 + proxyRecordIds.size)), n: 1 + proxyRecordIds.size })
                  : t('payment_qr_btn')}
              </Button>
            )}

            {/* No record for member — edge case fallback */}
            {selectedMember && !myRecord && (
              <p className="text-xs text-slate-400">{t('payment_status_pending')}</p>
            )}
          </div>
        </div>
      </main>

      {/* QR Modal — key=myRecord.id forces remount on member change, resetting internal localRecord state */}
      {myRecord && (
        <PaymentQRModal
          key={`${myRecord.id}-${[...proxyRecordIds].sort().join(',')}`}
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          record={myRecord}
          memberName={selectedMember?.name ?? ''}
          liveAmount={livePerMember ?? myRecord.amount}
          proxyRecords={proxyRecords}
          toast={toast}
        />
      )}

      <Toast toast={toastMsg} />
    </div>
  )
}

export default PublicPayPage
