import { useTranslation } from 'react-i18next'
import { TrendingUp, AlertTriangle } from 'lucide-react'
import { fmtVND } from '../../lib/utils'

export function DeficitCallout({ projectedSurplus, projectedBalance, projectedDeficit, perMemberTopUp, memberCount }) {
  const { t } = useTranslation()

  if (projectedSurplus) {
    return (
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
    )
  }

  return (
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
}
