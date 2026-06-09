import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Wallet, TrendingUp, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { inputCls } from '../../components/ui/Field'
import { cx, num, fmtVND, fmtDate } from '../../lib/utils'
import { supabase } from '../../lib/supabase'

export function FundPage({ club, fundTxns, settings, canEdit, onTopUp, toast }) {
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
      const newFund = num(settings.current_fund) + amt
      const { error: e1 } = await supabase.from('fund_transactions').insert({ club_id: club.id, amount: amt, note: note.trim() || null })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('club_settings').update({ current_fund: newFund }).eq('club_id', club.id)
      if (e2) throw e2
      toast(t('fund_added'))
      setAmount(''); setNote(''); setTopUpOpen(false)
      onTopUp()
    } catch (e) { toast(e.message || t('err_generic')) }
    finally { setBusy(false) }
  }

  const total = fundTxns.reduce((s, tx) => s + num(tx.amount), 0)

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
                type="number" min="0" autoFocus
                className={cx(inputCls, 'pr-10 font-mono')}
                placeholder={t('fund_topup_amount_ph')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
            </div>
            <input
              className={inputCls}
              placeholder={t('fund_topup_note_ph')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="volt" size="sm" className="flex-1" onClick={submit} disabled={busy || !amount}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> {t('fund_topup_submit')}</>}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setTopUpOpen(false); setAmount(''); setNote('') }}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 rounded-3xl bg-slate-900 p-5 text-white">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime-400 text-slate-900">
          <Wallet className="h-6 w-6" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('fund_history_total')}</p>
          <p className="font-mono text-2xl font-black text-lime-400">{fmtVND(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">{t('dash_fund_live')}</p>
          <p className="font-mono text-lg font-black text-white">{fmtVND(num(settings.current_fund))}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {fundTxns.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            {t('fund_history_empty')}
          </li>
        )}
        {fundTxns.map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lime-50 text-lime-600">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{tx.note || t('fund_topup_default_note')}</p>
              <p className="text-xs text-slate-400">{fmtDate(tx.created_at?.slice(0, 10))}</p>
            </div>
            <p className="font-mono text-base font-black text-lime-600">+{fmtVND(num(tx.amount))}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
