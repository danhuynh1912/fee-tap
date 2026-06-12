import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Clock, Coins, RefreshCw, Calendar, Hash, Layers } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, inputCls } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { WeekdayPicker } from './WeekdayPicker'
import { cx, num, fmtVND, fmtNum, fmtInputNum, parseInputNum } from '../../lib/utils'
import { computeSlot, formatPeriodLabel, monthName, cycleLabelShort } from '../../engine/forecast'

const EMPTY_SLOT = {
  name: '',
  venue_name: '',
  weekdays: [],
  price_per_hour: '',
  hours_per_session: 2,
  payment_mode: 'session',
  cycle_months: 1,
  cycle_start_month: 1,
  renewal_day: '',
  sort_order: 0,
}

export function CourtSlotModal({ slot, onSave, onClose }) {
  const { t, i18n } = useTranslation()
  const isEdit = !!slot?.id
  const [form, setForm] = useState(() => slot ? { ...EMPTY_SLOT, ...slot } : { ...EMPTY_SLOT })
  // courtCount only used when creating new slots
  const [courtCount, setCourtCount] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(slot ? { ...EMPTY_SLOT, ...slot } : { ...EMPTY_SLOT })
    setCourtCount(1)
    setError('')
  }, [slot])

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })) }

  function handleSave() {
    if (!form.weekdays.length) { setError(t('slot_no_weekdays')); return }
    if (!form.venue_name.trim() && !form.name.trim()) { setError(t('slot_name')); return }
    setError('')

    const base = {
      ...form,
      venue_name: form.venue_name.trim() || null,
      price_per_hour: num(form.price_per_hour),
      hours_per_session: num(form.hours_per_session) || 2,
      renewal_day: form.renewal_day ? Math.min(31, Math.max(1, parseInt(form.renewal_day, 10))) : null,
      cycle_months: Math.max(1, parseInt(form.cycle_months, 10) || 1),
      cycle_start_month: Math.max(1, Math.min(12, parseInt(form.cycle_start_month, 10) || 1)),
    }

    if (isEdit) {
      // editing — save single slot with its own name
      onSave({ ...base, name: form.name.trim() || form.venue_name.trim() })
      return
    }

    // creating — produce N slots
    const n = Math.max(1, Math.min(10, courtCount))
    const venueName = form.venue_name.trim() || form.name.trim()
    if (n === 1) {
      const slotName = form.name.trim() || venueName
      onSave([{ ...base, name: slotName }])
    } else {
      const slots = Array.from({ length: n }, (_, i) => ({
        ...base,
        name: `${venueName} · Sân ${i + 1}`,
      }))
      onSave(slots)
    }
  }

  // Live preview
  const previewSlot = {
    ...form,
    price_per_hour: num(form.price_per_hour),
    hours_per_session: num(form.hours_per_session) || 2,
    cycle_months: Math.max(1, parseInt(form.cycle_months, 10) || 1),
    cycle_start_month: Math.max(1, Math.min(12, parseInt(form.cycle_start_month, 10) || 1)),
  }
  const preview = previewSlot.weekdays.length && num(form.price_per_hour) > 0
    ? computeSlot(previewSlot) : null

  const n = Math.max(1, Math.min(10, courtCount))
  const totalCost = preview ? preview.courtCost * n : 0

  return (
    <Modal open onClose={onClose} maxW="max-w-2xl">
      <h2 className="text-lg font-bold text-slate-900 mb-5">
        {isEdit ? t('slot_edit') : t('slot_add')}
      </h2>

      <div className="space-y-5">
        {/* Row 1: Tên cụm sân + Ngày đánh */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên cụm sân" icon={MapPin} hint="Dùng để nhóm các sân trong cùng địa điểm">
            <input className={inputCls} placeholder="vd: Sân ABC, Nhà thi đấu Thể công"
              value={form.venue_name} onChange={(e) => set('venue_name', e.target.value)} />
          </Field>

          {/* Số sân (chỉ hiện khi tạo mới) */}
          {!isEdit && (
            <Field label="Số sân" icon={Layers} hint="Tạo nhiều slot cùng lúc cho các sân giống nhau">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setCourtCount((c) => Math.max(1, c - 1))}
                  className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-700 hover:bg-slate-100 transition">
                  −
                </button>
                <span className="flex-1 text-center font-mono text-xl font-black text-slate-900">{n}</span>
                <button type="button" onClick={() => setCourtCount((c) => Math.min(10, c + 1))}
                  className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-700 hover:bg-slate-100 transition">
                  +
                </button>
              </div>
              {n > 1 && (
                <p className="mt-1.5 text-xs text-slate-400">
                  Tạo: {Array.from({ length: n }, (_, i) => `Sân ${i + 1}`).join(', ')}
                </p>
              )}
            </Field>
          )}
        </div>

        {/* Row 2: Tên slot (chỉ hiện khi tạo 1 sân hoặc đang edit) */}
        {(isEdit || n === 1) && (
          <Field label={t('slot_name')} icon={Hash} hint={isEdit ? undefined : 'Để trống sẽ dùng tên cụm sân'}>
            <input className={inputCls} placeholder={form.venue_name || t('slot_name_ph')}
              value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
        )}

        {/* Ngày đánh */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">{t('slot_weekdays')}</p>
          <WeekdayPicker value={form.weekdays} onChange={(v) => set('weekdays', v.slice(-1))} />
        </div>

        {/* Giá + giờ */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('slot_price')} icon={Coins}>
            <div className="relative">
              <input type="text" inputMode="numeric" className={cx(inputCls, 'pr-10 font-mono')}
                value={fmtInputNum(form.price_per_hour)} onChange={(e) => set('price_per_hour', parseInputNum(e.target.value))} />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
            </div>
          </Field>
          <Field label={t('slot_hours')} icon={Clock}>
            <input type="number" min="0.5" step="0.5" className={cx(inputCls, 'font-mono')}
              value={form.hours_per_session} onChange={(e) => set('hours_per_session', e.target.value)} />
          </Field>
        </div>

        {/* Hình thức + chu kỳ */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('slot_payment_mode')} icon={Coins}>
            <Segmented value={form.payment_mode} onChange={(v) => set('payment_mode', v)}
              options={[{ value: 'session', label: t('court_mode_session') }, { value: 'cycle', label: t('court_mode_cycle') }]} />
          </Field>
          <Field label={t('slot_billing_cycle')} icon={RefreshCw}
            hint={cycleLabelShort(parseInt(form.cycle_months, 10) || 1, i18n.language)}>
            <div className="relative">
              <input type="number" min="1" max="12" className={cx(inputCls, 'pr-16 font-mono')}
                value={form.cycle_months} onChange={(e) => set('cycle_months', e.target.value)} />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">tháng</span>
            </div>
          </Field>
        </div>

        {/* Cycle start month — only when cycle > 1 month */}
        {parseInt(form.cycle_months, 10) > 1 && (
          <Field label={t('slot_cycle_start')} icon={Calendar}>
            <select className={inputCls} value={form.cycle_start_month}
              onChange={(e) => set('cycle_start_month', e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{monthName(m, i18n.language)}</option>
              ))}
            </select>
          </Field>
        )}

        {/* Deadline */}
        <Field label={t('slot_renewal_day')} icon={Calendar} hint={t('slot_renewal_day_hint')}>
          <input type="number" min="1" max="31" className={cx(inputCls, 'font-mono')}
            placeholder={t('slot_renewal_day_ph')}
            value={form.renewal_day} onChange={(e) => set('renewal_day', e.target.value)} />
        </Field>

        {/* Live preview */}
        {preview && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-1.5 animate-fade-in">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {formatPeriodLabel(preview.period, i18n.language)}
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t('set_cost_sessions')}</span>
              <span className="font-mono font-bold text-slate-900">{fmtNum(preview.totalSessions)}{n > 1 ? ` × ${n} sân` : ''}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t('timeline_court_cost')}</span>
              <span className="font-mono font-bold text-slate-900">{fmtVND(totalCost)}</span>
            </div>
            {preview.nextDeadline && (
              <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span>{t('timeline_deadline')}</span>
                <span className="font-semibold">
                  {preview.nextDeadline.toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
                </span>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="primary" className="flex-1" onClick={handleSave}>
            {!isEdit && n > 1 ? `Tạo ${n} sân` : t('save')}
          </Button>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
