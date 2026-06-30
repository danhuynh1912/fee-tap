import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock, UserCheck, Loader2, MinusCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { cx, fmtVND } from '../../lib/utils'
import { supabase } from '../../lib/supabase'

// cycleStatus: 'committed' | 'not_committed' | undefined (no vote data)
function MemberRow({ member, paymentRecord, onConfirmManual, confirmingId, cycleStatus }) {
  const { t } = useTranslation()
  const isPaid = paymentRecord?.status === 'paid' || paymentRecord?.status === 'manual'
  const isConfirming = confirmingId === member.id

  return (
    <div className={cx(
      'flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3',
      isPaid ? 'border-lime-200 bg-lime-50' : cycleStatus === 'not_committed' ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-100 bg-white'
    )}>
      {/* Avatar */}
      <div className="relative shrink-0">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.name} className="h-8 w-8 rounded-full object-cover sm:h-9 sm:w-9" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-slate-900 grid place-items-center sm:h-9 sm:w-9">
            <span className="text-xs font-black text-lime-400">{member.name[0].toUpperCase()}</span>
          </div>
        )}
        {isPaid && (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-lime-400">
            <CheckCircle2 className="h-3 w-3 text-slate-900" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{member.name}</p>
        {isPaid && paymentRecord.paid_at && (
          <p className="text-[11px] text-slate-400">
            {new Date(paymentRecord.paid_at).toLocaleDateString('vi-VN')}
            {paymentRecord.confirmed_by === 'admin_manual' && ' · tiền mặt'}
          </p>
        )}
        {!isPaid && <p className="text-[11px] text-slate-400">{t('payment_status_pending')}</p>}
      </div>

      <div className="shrink-0 text-right">
        {isPaid ? (
          <span className="font-mono text-sm font-bold text-lime-600">+{fmtVND(paymentRecord.amount)}</span>
        ) : cycleStatus === 'not_committed' ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <MinusCircle className="h-3.5 w-3.5" />
            {t('not_committed_this_cycle')}
          </span>
        ) : (
          <button
            onClick={() => onConfirmManual(member.id, paymentRecord)}
            disabled={isConfirming}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
          >
            {isConfirming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('payment_confirm_manual')}</span>
                <span className="sm:hidden">✓</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export function PaymentCollectionModal({ open, onClose, collection, memberPayments, members, committedUserIds, toast, onChanged, onSynced }) {
  const { t } = useTranslation()
  const [confirmingId, setConfirmingId] = useState(null)

  // Auto-sync: add records for members joined after collection was opened
  useEffect(() => {
    if (!open || !collection?.amount_per_member || !members.length) return
    const missing = members.filter((m) => !memberPayments.find((p) => p.member_id === m.id))
    if (!missing.length) return
    const records = missing.map((m) => ({
      collection_id: collection.id,
      club_id: collection.club_id,
      member_id: m.id,
      amount: collection.amount_per_member,
    }))
    supabase
      .from('member_payment_records')
      .insert(records)
      .then(({ error }) => {
        if (!error) onSynced?.() // reload data without closing modal
      })
  }, [open, collection?.id, members.length, memberPayments.length])

  if (!collection) return null

  const totalCount = members.length
  const paidCount = memberPayments.filter((p) => p.status === 'paid' || p.status === 'manual').length
  const totalAmount = memberPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const paidAmount = memberPayments.filter((p) => p.status === 'paid' || p.status === 'manual').reduce((s, p) => s + (p.amount || 0), 0)

  async function confirmManual(memberId, record) {
    setConfirmingId(memberId)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // If no record yet (e.g. host added after collection opened), create it first
      let resolvedRecord = record
      if (!resolvedRecord) {
        const { data: newRecord, error: insertErr } = await supabase
          .from('member_payment_records')
          .insert({
            collection_id: collection.id,
            club_id: collection.club_id,
            member_id: memberId,
            amount: collection.amount_per_member || 0,
          })
          .select()
          .single()
        if (insertErr) throw insertErr
        resolvedRecord = newRecord
      }

      const { error } = await supabase.rpc('confirm_member_payment', {
        p_record_id: resolvedRecord.id,
        p_confirmed_by: 'admin_manual',
        p_user_id: user?.id || null,
      })
      if (error) throw error
      toast(t('payment_confirmed_manual'))
      onChanged?.()
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxW="max-w-2xl">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <p className="font-black text-slate-900 text-base">{t('payment_members_title')}</p>
          <p className="text-xs text-slate-500 mt-0.5">{collection.title}</p>
        </div>

        {/* Progress summary */}
        <div className="rounded-2xl bg-slate-900 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('collection_paid_count', { paid: paidCount, total: totalCount })}
            </p>
            <p className="font-mono text-xl font-black text-lime-400 mt-1">{fmtVND(paidAmount)}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              / {fmtVND(totalAmount)} {t('collection_total_label')}
            </p>
          </div>
          {/* Mini progress bar */}
          <div className="w-24 space-y-1">
            <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-lime-400 transition-all"
                style={{ width: totalCount > 0 ? `${(paidCount / totalCount) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-right text-[10px] text-slate-500">{totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0}%</p>
          </div>
        </div>

        {/* Member list — iterate members as source of truth */}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {members.map((m) => {
            const record = memberPayments.find((p) => p.member_id === m.id) || null
            const hasVoteData = committedUserIds !== undefined
            const isCommitted = committedUserIds?.has(m.user_id) || committedUserIds?.has(m.id)
            const cycleStatus = !hasVoteData ? undefined : isCommitted ? 'committed' : 'not_committed'
            return <MemberRow key={m.id} member={m} paymentRecord={record} onConfirmManual={confirmManual} confirmingId={confirmingId} cycleStatus={cycleStatus} />
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 border-t border-slate-100">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{t('payment_manual_hint')}</span>
        </div>

        <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>
          {t('close')}
        </Button>
      </div>
    </Modal>
  )
}
