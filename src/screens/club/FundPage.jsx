import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClub } from '../../contexts/ClubContext'
import { handleError } from '../../lib/handleError'
import { Plus, Wallet, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { inputCls } from '../../components/ui/Field'
import { cx, num, fmtVND, fmtDate, sumCollected } from '../../lib/utils'
import { supabase } from '../../lib/supabase'

export function FundPage({ toast }) {
  const { club, fundTxns, members, canEdit, reload, liveFundBalance } = useClub()
  const onTopUp = reload
  const { t } = useTranslation()
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const amt = num(amount)
    if (!amt || busy) return
    setBusy(true)
    try {
      // Append-only ledger: no current_fund update, no UPDATE to existing rows
      const { error } = await supabase.from('fund_transactions').insert({
        club_id: club.id,
        amount: amt,
        note: note.trim() || null,
        type: 'top_up',
        source: 'manual',
      })
      if (error) throw error
      toast(t('fund_added'))
      setAmount('')
      setNote('')
      setTopUpOpen(false)
      onTopUp()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setBusy(false)
    }
  }

  const total = sumCollected(fundTxns)

  // Build member name lookup for attributed transactions
  const memberMap = Object.fromEntries((members || []).map((m) => [m.id, m]))

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">{t('fund_history_title')}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{t('fund_history_sub')}</p>
        </div>
        {canEdit && (
          <Button variant="volt" size="sm" onClick={() => setTopUpOpen((v) => !v)}>
            <Plus className="h-4 w-4" /> {t('fund_topup_btn')}
          </Button>
        )}
      </div>

      {topUpOpen && canEdit && (
        <div className="rounded-3xl border border-lime-200 bg-lime-50 p-5 space-y-3 animate-fade-in">
          <p className="font-semibold text-slate-800">{t('fund_topup_title')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <input
                type="number"
                min="0"
                autoFocus
                className={cx(inputCls, 'pr-10 font-mono')}
                placeholder={t('fund_topup_amount_ph')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
            </div>
            <input className={inputCls} placeholder={t('fund_topup_note_ph')} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="volt" size="sm" className="flex-1" onClick={submit} disabled={busy || !amount}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" /> {t('fund_topup_submit')}
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTopUpOpen(false)
                setAmount('')
                setNote('')
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-slate-900 p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-lime-400 text-slate-900">
            <Wallet className="h-5 w-5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('fund_history_total')}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{t('fund_history_total')}</p>
            <p className="font-mono text-xl font-black text-lime-400">{fmtVND(total)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{t('dash_fund_live')}</p>
            <p className="font-mono text-xl font-black text-white">{fmtVND(liveFundBalance)}</p>
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {fundTxns.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">{t('fund_history_empty')}</li>
        )}
        {fundTxns.map((tx) => {
          const isPositive = num(tx.amount) >= 0
          const memberName = tx.member_id ? memberMap[tx.member_id]?.name : null
          const displayNote = tx.note || (memberName ? `${t('fund_topup_default_note')} — ${memberName}` : t('fund_topup_default_note'))
          const isPayos = tx.source === 'payos'

          return (
            <li
              key={tx.id}
              className={cx(
                'flex items-center gap-3 rounded-2xl border px-4 py-3',
                isPositive ? 'border-slate-100 bg-white' : 'border-red-100 bg-red-50'
              )}
            >
              <span
                className={cx(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                  isPositive ? 'bg-lime-50 text-lime-600' : 'bg-red-100 text-red-500'
                )}
              >
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{displayNote}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-400">{fmtDate(tx.created_at?.slice(0, 10))}</p>
                  {isPayos && <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">PayOS</span>}
                  {memberName && <span className="text-xs text-slate-400">{memberName}</span>}
                </div>
              </div>
              <p className={cx('font-mono text-base font-black', isPositive ? 'text-lime-600' : 'text-red-500')}>
                {isPositive ? '+' : ''}
                {fmtVND(num(tx.amount))}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
