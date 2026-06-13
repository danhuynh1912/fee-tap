import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Eye, EyeOff, ShieldCheck, Settings2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { cx } from '../../lib/utils'

const SECTIONS = [
  { key: 'remaining_forecast', labelKey: 'dash_section_remaining' },
  { key: 'end_of_period', labelKey: 'dash_section_end_period', adminOnly: true },
  { key: 'running_slots', labelKey: 'dash_section_running_slots' },
  { key: 'venue_cards', labelKey: 'dash_section_venue_cards' },
  { key: 'cost_by_cycle', labelKey: 'dash_section_cost_cycle' },
  { key: 'deficit_callout', labelKey: 'dash_section_deficit', adminOnly: true },
  { key: 'carryover_row', labelKey: 'dash_section_carryover', adminOnly: true },
]

export function DashboardConfigDrawer({ open, onClose, clubId, sections, venueCount = 1, onSaved, onLiveChange }) {
  const { t } = useTranslation()
  const [local, setLocal] = useState(() => sections || {})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setLocal(sections || {})
  }, [open, sections])

  const DEFAULT_SECTIONS = { running_slots: false, cost_by_cycle: false, deficit_callout: false, carryover_row: false }
  const isVisible = (key) => {
    if (key in local) return local[key] !== false
    return DEFAULT_SECTIONS[key] ?? true
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('club_settings').update({ dashboard_sections: local }).eq('club_id', clubId)
    if (error) {
      alert('Lưu thất bại: ' + error.message)
      setSaving(false)
      return
    }
    onSaved(local)
    setSaving(false)
    onClose()
  }

  return (
    <>
      {/* Invisible close area — tap outside drawer to close */}
      {open && <div className="fixed inset-0 z-40" onClick={onClose} />}

      {/* Drawer */}
      <div
        className={cx(
          'fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl shadow-slate-900/20',
          'w-[340px] md:w-[500px] transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900">
            <Settings2 className="h-4 w-4 text-lime-400" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-900 text-sm leading-tight">{t('dash_config_title')}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{t('dash_config_sub')}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toggle list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {SECTIONS.filter(({ key }) => key !== 'venue_cards' || venueCount >= 2).map(({ key, labelKey, adminOnly }) => {
            const visible = isVisible(key)
            return (
              <button
                key={key}
                onClick={() => {
                  const next = { ...local, [key]: local[key] === false ? true : false }
                  setLocal(next)
                  onLiveChange?.(next)
                }}
                className={cx(
                  'w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]',
                  visible ? 'border-slate-200 bg-white hover:border-slate-300' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                )}
              >
                <span
                  className={cx(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-xl transition',
                    visible ? 'bg-lime-400 text-slate-900' : 'bg-slate-200 text-slate-400'
                  )}
                >
                  {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cx('text-sm font-semibold', visible ? 'text-slate-900' : 'text-slate-400')}>{t(labelKey)}</p>
                  {adminOnly && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="h-3 w-3" /> {t('dash_config_admin_note')}
                    </p>
                  )}
                </div>
                <span
                  className={cx(
                    'shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
                    visible ? 'bg-lime-400' : 'bg-slate-200'
                  )}
                >
                  <span
                    className={cx(
                      'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200',
                      visible ? 'translate-x-5' : 'translate-x-0.5'
                    )}
                  />
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="volt" className="flex-1" onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </div>
    </>
  )
}
