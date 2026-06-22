import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, CheckCircle2, Link2, Loader2, Unlink } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { inputCls } from '../ui/Field'
import { cx } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { handleError } from '../../lib/handleError'

export function TelegramSettings({ club, canEdit, currentUserId, onChanged, toast }) {
  const { t } = useTranslation()

  // Group chat config
  const [config, setConfig]       = useState(null)   // telegram_club_configs row
  const [chatId, setChatId]       = useState('')
  const [savingChat, setSavingChat] = useState(false)

  // Admin account linking
  const [link, setLink]           = useState(null)   // telegram_links row
  const [linkCode, setLinkCode]   = useState('')
  const [verifying, setVerifying] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [showLinkInstr, setShowLinkInstr] = useState(false)

  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!club?.id) return
    load()
  }, [club?.id, currentUserId])

  async function load() {
    setLoading(true)
    const [{ data: cfg }, { data: lnk }] = await Promise.all([
      supabase
        .from('telegram_club_configs')
        .select('group_chat_id, is_active')
        .eq('club_id', club.id)
        .maybeSingle(),
      currentUserId
        ? supabase
            .from('telegram_links')
            .select('telegram_id, telegram_name')
            .eq('user_id', currentUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    setConfig(cfg)
    setChatId(cfg ? String(cfg.group_chat_id) : '')
    setLink(lnk)
    setLoading(false)
  }

  // ── Save group chat ID ──────────────────────────────────────────────

  async function saveChat() {
    let parsed = parseInt(chatId.trim(), 10)
    if (!parsed) return
    // Group IDs are always negative — auto-fix if user pastes positive number
    if (parsed > 0) parsed = -parsed
    setSavingChat(true)
    try {
      const { error } = await supabase
        .from('telegram_club_configs')
        .upsert({ club_id: club.id, group_chat_id: parsed, is_active: true }, { onConflict: 'club_id' })
      if (error) throw error
      toast(t('tg_chat_saved'))
      onChanged?.()
      await load()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setSavingChat(false)
    }
  }

  async function removeChat() {
    setSavingChat(true)
    try {
      const { error } = await supabase
        .from('telegram_club_configs')
        .delete()
        .eq('club_id', club.id)
      if (error) throw error
      setConfig(null)
      setChatId('')
      toast(t('tg_chat_removed'))
      onChanged?.()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setSavingChat(false)
    }
  }

  // ── Verify link code ────────────────────────────────────────────────

  async function verifyCode() {
    if (!linkCode.trim()) return
    setVerifying(true)
    try {
      const { data, error } = await supabase.rpc('consume_link_token', { p_token: linkCode.trim().toUpperCase() })
      if (error) throw error
      if (!data.ok) throw new Error(t(`tg_link_err_${data.error}`) || data.error)
      toast(t('tg_link_success', { name: data.telegram_name }))
      setLinkCode('')
      setShowLinkInstr(false)
      await load()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setVerifying(false)
    }
  }

  async function unlinkAccount() {
    setUnlinking(true)
    try {
      const { error } = await supabase
        .from('telegram_links')
        .delete()
        .eq('user_id', currentUserId)
      if (error) throw error
      setLink(null)
      toast(t('tg_unlinked'))
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setUnlinking(false)
    }
  }

  if (loading) return null

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-slate-900">
          <Send className="h-4 w-4 text-lime-400" />
        </span>
        <div>
          <p className="font-black text-slate-900">{t('tg_title')}</p>
          <p className="text-xs text-slate-500">{t('tg_subtitle')}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* ── Section 1: Group Chat ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{t('tg_group_section')}</p>

          {config ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{t('tg_group_connected')}</p>
                <p className="text-xs text-slate-500 font-mono">ID: {config.group_chat_id}</p>
              </div>
              {canEdit && (
                <button
                  onClick={removeChat}
                  disabled={savingChat}
                  className="text-xs text-red-500 hover:text-red-600 font-semibold transition shrink-0"
                >
                  {t('tg_disconnect')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">{t('tg_group_hint')}</p>
              {canEdit && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    className={cx(inputCls, 'flex-1 font-mono')}
                    placeholder="5386528770"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={saveChat}
                    disabled={savingChat || !chatId.trim()}
                  >
                    {savingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : t('tg_save_btn')}
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-slate-400">{t('tg_group_id_hint')}</p>
            </div>
          )}
        </div>

        {/* ── Section 2: Admin Account Linking ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('tg_account_section')}</p>
          <p className="text-xs text-slate-400 mb-3">{t('tg_account_section_hint')}</p>

          {link ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{link.telegram_name}</p>
                <p className="text-xs text-slate-500">{t('tg_account_linked')}</p>
              </div>
              <button
                onClick={unlinkAccount}
                disabled={unlinking}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 font-semibold transition shrink-0"
              >
                {unlinking
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><Unlink className="h-3.5 w-3.5" /> {t('tg_unlink_btn')}</>
                }
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {!showLinkInstr ? (
                <Button
                  variant="subtle"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowLinkInstr(true)}
                >
                  <Link2 className="h-4 w-4" /> {t('tg_link_btn')}
                </Button>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 animate-fade-in">
                  <p className="text-xs font-semibold text-slate-700">{t('tg_link_step1')}</p>
                  <div className="rounded-xl bg-slate-900 px-4 py-3">
                    <p className="text-xs text-slate-400 mb-1">{t('tg_link_open_bot')}</p>
                    <p className="font-mono text-sm text-lime-400 select-all">/link</p>
                  </div>
                  <p className="text-xs text-slate-500">{t('tg_link_step2')}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className={cx(inputCls, 'flex-1 font-mono uppercase tracking-widest')}
                      placeholder="ABC-123"
                      maxLength={7}
                      value={linkCode}
                      onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
                    />
                    <Button
                      variant="volt"
                      size="sm"
                      onClick={verifyCode}
                      disabled={verifying || linkCode.length < 7}
                    >
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : t('tg_verify_btn')}
                    </Button>
                  </div>
                  <button
                    className="text-xs text-slate-400 hover:text-slate-600 transition"
                    onClick={() => { setShowLinkInstr(false); setLinkCode('') }}
                  >
                    {t('cancel')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
