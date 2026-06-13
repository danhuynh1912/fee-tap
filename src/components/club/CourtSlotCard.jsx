import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Pencil, Trash2, GripVertical } from 'lucide-react'
import { cx, fmtVND } from '../../lib/utils'
import { computeSlot, formatPeriodLabel, cycleLabelShort } from '../../engine/forecast'

export function CourtSlotCard({ slot, canEdit, lang, onEdit, onDelete }) {
  const { t } = useTranslation()
  const result = useMemo(() => computeSlot(slot), [slot])
  const wdLabels = (slot.weekdays || [])
    .slice()
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((w) => t(`wd_${w}`))
    .join(', ')

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 animate-fade-in">
      {canEdit && <GripVertical className="h-4 w-4 shrink-0 text-slate-300 cursor-grab" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900 text-sm truncate">{slot.name}</span>
          {slot.venue_name && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3" />
              {slot.venue_name}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span>{wdLabels}</span>
          <span>
            {fmtVND(slot.price_per_hour ?? 0)}/giờ · {slot.hours_per_session}h
          </span>
          <span>{cycleLabelShort(slot.cycle_months || 1, lang)}</span>
          {slot.renewal_day && (
            <span>
              {t('timeline_deadline')} {t('timeline_days_left', { n: `${slot.renewal_day}` })}
            </span>
          )}
        </div>
        {result.totalSessions > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {t('slot_sessions_preview', { n: result.totalSessions, label: formatPeriodLabel(result.period, lang) })}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-400 hover:text-slate-700">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-xl hover:bg-red-50 transition text-slate-400 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
