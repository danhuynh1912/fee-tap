import { useTranslation } from 'react-i18next'
import { BarChart3, FileSpreadsheet, FileText } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ProLock } from '../monetize/ProLock'
import { fmtVND, cx } from '../../lib/utils'

export function AdvancedForecast({ totalMonthlyCost, plan, canEdit, onUnlock }) {
  const { t } = useTranslation()
  const locked = plan !== 'pro'
  if (locked && !canEdit) return null

  const factors = [1, 1.08, 0.96, 1.14]
  const projections = factors.map((fac, i) => ({ label: t('adv_q', { n: i + 1 }), cost: totalMonthlyCost * fac }))
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
              <Button size="sm" variant="ghost" onClick={locked ? undefined : onUnlock}>
                <FileSpreadsheet className="h-4 w-4" /> {t('export_excel')}
              </Button>
              <Button size="sm" variant="ghost" onClick={locked ? undefined : onUnlock}>
                <FileText className="h-4 w-4" /> {t('export_pdf')}
              </Button>
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
