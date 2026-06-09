import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, RefreshCw, Lock, Plus, Trash2, Crown } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { inputCls } from '../../components/ui/Field'
import { cx } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { FREE_MEMBER_LIMIT } from '../../constants'

function MemberAvatar({ name, avatarUrl, isHost }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-xs font-bold text-lime-400">
      {isHost ? <Crown className="h-4 w-4" /> : (name?.[0]?.toUpperCase() || '?')}
    </span>
  )
}

export function MembersPanel({ club, members, plan, pollTally, hostName, hostAvatar, currentUserId, canEdit, onChanged, onHitLimit, toast }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const filteredMembers = members.filter((m) => m.user_id !== club.owner_id)
  const count = filteredMembers.length
  const atLimit = plan === 'free' && count >= FREE_MEMBER_LIMIT
  const isViewerHost = currentUserId === club.owner_id

  async function add(e) {
    e.preventDefault()
    if (!canEdit || !name.trim() || busy) return
    if (atLimit) { onHitLimit(); return }
    setBusy(true)
    try {
      const { error } = await supabase.from('club_members').insert({ club_id: club.id, name: name.trim() })
      if (error) throw error
      setName('')
      onChanged()
    } catch (e) { toast(e.message || t('err_generic')) }
    finally { setBusy(false) }
  }

  async function remove(id) {
    if (!canEdit) return
    try {
      const { error } = await supabase.from('club_members').delete().eq('id', id)
      if (error) throw error
      onChanged()
    } catch (e) { toast(e.message || t('err_generic')) }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-900">{t('mem_title')}</h3>
        </div>
        <Badge tone={atLimit ? 'amber' : plan === 'pro' ? 'volt' : 'slate'}>
          {plan === 'pro' ? t('mem_sub_pro', { count }) : t('mem_sub_free', { count })}
        </Badge>
      </div>

      {plan === 'free' && (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cx('h-full rounded-full transition-all duration-500', atLimit ? 'bg-amber-400' : 'bg-lime-400')}
            style={{ width: `${Math.min(100, (count / FREE_MEMBER_LIMIT) * 100)}%` }}
          />
        </div>
      )}

      {pollTally?.source === 'poll' && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-700">
          <RefreshCw className="h-3.5 w-3.5" /> {t('mem_poll_synced')}: {pollTally.count}
        </p>
      )}

      {canEdit && (
        <form onSubmit={add} className="mt-4 flex gap-2">
          <input
            className={cx(inputCls, 'flex-1')}
            placeholder={t('mem_add_ph')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant={atLimit ? 'volt' : 'primary'} disabled={busy || !name.trim()}>
            {atLimit ? <><Lock className="h-4 w-4" /> {t('mem_limit_reached')}</> : <><Plus className="h-4 w-4" /> {t('add')}</>}
          </Button>
        </form>
      )}

      <ul className="mt-4 space-y-2">
        {hostName && (
          <li className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="relative shrink-0">
              <MemberAvatar name={hostName} avatarUrl={hostAvatar} isHost />
              <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-slate-900">
                <Crown className="h-2.5 w-2.5 text-white" />
              </span>
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{hostName}</span>
            {isViewerHost && <Badge tone="cyan">{t('badge_you')}</Badge>}
          </li>
        )}
        {count === 0 && !hostName && (
          <li className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            {t('mem_empty')}
          </li>
        )}
        {filteredMembers.map((m, i) => {
          const isYou = m.user_id && m.user_id === currentUserId
          return (
            <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 transition hover:border-slate-200">
              {m.avatar_url
                ? <img src={m.avatar_url} alt={m.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-xs font-bold text-lime-400">{String(i + 1).padStart(2, '0')}</span>
              }
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{m.name}</span>
              {isYou && <Badge tone="cyan">{t('badge_you')}</Badge>}
              {canEdit && (
                <button onClick={() => remove(m.id)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
