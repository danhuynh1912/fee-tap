import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QrCode, CheckCircle2, Eye, EyeOff, Check, Loader2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { inputCls } from '../ui/Field'
import { ProLock } from '../monetize/ProLock'
import { cx } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { handleError } from '../../lib/handleError'

export function PayOSSettings({ club, plan, payosConfig, canEdit, onChanged, toast, onUnlock }) {
  const { t } = useTranslation()
  const isPro = plan === 'pro'
  const isConfigured = !!payosConfig
  const [editing, setEditing] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [form, setForm] = useState({ clientId: '', apiKey: '', checksumKey: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.clientId.trim() || !form.apiKey.trim() || !form.checksumKey.trim()) return
    setSaving(true)
    try {
      const payload = {
        club_id: club.id,
        payos_client_id: form.clientId.trim(),
        payos_api_key: form.apiKey.trim(),
        payos_checksum_key: form.checksumKey.trim(),
      }
      const { error } = await supabase.from('club_payment_config').upsert(payload, { onConflict: 'club_id' })
      if (error) throw error
      toast(t('payos_saved'))
      setEditing(false)
      setForm({ clientId: '', apiKey: '', checksumKey: '' })
      onChanged?.()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <div className={cx(!isPro && 'locked-blur')}>
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-slate-900">
              <QrCode className="h-4 w-4 text-lime-400" />
            </span>
            <div>
              <p className="font-black text-slate-900">{t('payos_title')}</p>
              <p className="text-xs text-slate-500">{t('payos_subtitle')}</p>
            </div>
            {isConfigured && !editing && (
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-lime-50 px-3 py-1 text-xs font-semibold text-lime-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('payos_connected')}
              </span>
            )}
          </div>

          {!editing && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-800">{t('payos_how_it_works_title')}</p>
                <p>1. {t('payos_step_1')}</p>
                <p>2. {t('payos_step_2')}</p>
                <p>3. {t('payos_step_3')}</p>
              </div>
              {canEdit && (
                <Button variant={isConfigured ? 'ghost' : 'volt'} size="sm" onClick={() => setEditing(true)}>
                  {isConfigured ? t('payos_reconfigure') : t('payos_connect_btn')}
                </Button>
              )}
            </div>
          )}

          {editing && canEdit && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{t('payos_enter_keys')}</p>
                <button onClick={() => setShowKeys((v) => !v)} className="text-slate-400 hover:text-slate-700 transition">
                  {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <input
                className={inputCls}
                placeholder="Client ID"
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="API Key"
                type={showKeys ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Checksum Key"
                type={showKeys ? 'text' : 'password'}
                value={form.checksumKey}
                onChange={(e) => setForm((f) => ({ ...f, checksumKey: e.target.value }))}
              />
              <p className="text-xs text-slate-400">{t('payos_keys_hint')}</p>
              <div className="flex gap-2">
                <Button
                  variant="volt"
                  size="sm"
                  className="flex-1"
                  onClick={save}
                  disabled={saving || !form.clientId || !form.apiKey || !form.checksumKey}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> {t('save')}
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false)
                    setForm({ clientId: '', apiKey: '', checksumKey: '' })
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
      {!isPro && <ProLock onClick={onUnlock} label={t('locked_pro')} />}
    </div>
  )
}
