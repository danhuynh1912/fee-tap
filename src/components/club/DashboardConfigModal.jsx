import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { cx } from '../../lib/utils'

const SECTIONS = [
  { key: 'remaining_forecast', labelKey: 'dash_section_remaining' },
  { key: 'end_of_period',      labelKey: 'dash_section_end_period',  adminOnly: true },
  { key: 'running_slots',      labelKey: 'dash_section_running_slots' },
  { key: 'venue_cards',        labelKey: 'dash_section_venue_cards' },
  { key: 'cost_by_cycle',      labelKey: 'dash_section_cost_cycle' },
  { key: 'deficit_callout',    labelKey: 'dash_section_deficit',     adminOnly: true },
]

export function DashboardConfigModal({ open, onClose, clubId, sections, onSaved }) {
  const { t } = useTranslation()
  const [local, setLocal] = useState(() => sections || {})

  useEffect(() => {
    if (open) setLocal(sections || {})
  }, [open, sections])
  const [saving, setSaving] = useState(false)

  function toggle(key) {
    setLocal((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }))
  }

  const DEFAULT_SECTIONS = { running_slots: false, cost_by_cycle: false, deficit_callout: false }
  const isVisible = (key) => {
    if (key in local) return local[key] !== false
    return DEFAULT_SECTIONS[key] ?? true
  }

  async function save() {
    setSaving(true)
    const { data: { session: authSession } } = await supabase.auth.getSession()
    console.log('[DashboardConfig] auth uid:', authSession?.user?.id, '| clubId:', clubId)
    const { error } = await supabase
      .from('club_settings')
      .update({ dashboard_sections: local })
      .eq('club_id', clubId)

    // Verify: read back immediately to confirm DB state
    const { data: verify } = await supabase
      .from('club_settings')
      .select('dashboard_sections')
      .eq('club_id', clubId)
      .maybeSingle()
    console.log('[DashboardConfig] DB row keys:', verify ? Object.keys(verify) : 'null')
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
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900">
          <Settings2 className="h-5 w-5 text-lime-400" />
        </span>
        <div>
          <p className="font-black text-slate-900 text-base leading-tight">{t('dash_config_title')}</p>
          <p className="text-xs text-slate-400">{t('dash_config_sub')}</p>
        </div>
      </div>

      <div className="space-y-2">
        {SECTIONS.map(({ key, labelKey, adminOnly }) => {
          const visible = isVisible(key)
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={cx(
                'w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]',
                visible
                  ? 'border-slate-200 bg-white hover:border-slate-300'
                  : 'border-slate-100 bg-slate-50 hover:border-slate-200',
              )}
            >
              <span className={cx(
                'grid h-8 w-8 shrink-0 place-items-center rounded-xl transition',
                visible ? 'bg-lime-400 text-slate-900' : 'bg-slate-200 text-slate-400',
              )}>
                {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className={cx('text-sm font-semibold', visible ? 'text-slate-900' : 'text-slate-400')}>
                  {t(labelKey)}
                </p>
                {adminOnly && (
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="h-3 w-3" /> {t('dash_config_admin_note')}
                  </p>
                )}
              </div>
              <span className={cx(
                'shrink-0 text-[10px] font-bold uppercase tracking-wide',
                visible ? 'text-lime-600' : 'text-slate-400',
              )}>
                {visible ? 'ON' : 'OFF'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="volt" onClick={save} disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
      </div>
    </Modal>
  )
}
