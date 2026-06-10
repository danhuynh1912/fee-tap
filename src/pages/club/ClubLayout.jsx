import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Settings2, ClipboardList, History,
  Building2, Crown, Zap, Eye, Menu, Link as LinkIcon, Loader2,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { UpsellModal } from '../../components/monetize/UpsellModal'
import { DashboardPage } from './DashboardPage'
import { SettingsPage } from './SettingsPage'
import { SessionLogPage } from './SessionLogPage'
import { FundPage } from './FundPage'
import { useClubData } from '../../hooks/useClubData'
import { cx } from '../../lib/utils'
import { navigate } from '../../router'
import { SPORT_CONFIGS } from '../../constants'
import { supabase } from '../../lib/supabase'

// Routes: /club/:id → dashboard, /club/:id/settings, /club/:id/log, /club/:id/fund
function activeTab(path, clubId) {
  if (path === `/club/${clubId}/settings`) return 'settings'
  if (path === `/club/${clubId}/log`) return 'log'
  if (path === `/club/${clubId}/fund`) return 'fund'
  return 'dashboard'
}

export function ClubLayout({ session, club, setClub, path, toast }) {
  const { t } = useTranslation()
  const role = club.userRole
  const isOwner = role === 'host'
  const [previewMember, setPreviewMember] = useState(false)
  const [upsell, setUpsell] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { settings, setSettings, slots, setSlots, members, logs, fundTxns, pollTally, loading, reload } = useClubData(club.id)

  const canEdit = isOwner && !previewMember
  const plan = club.plan || 'free'
  const hostName = isOwner
    ? (session?.user?.user_metadata?.full_name || session?.user?.email || null)
    : (club.owner?.full_name || null)
  const hostAvatar = isOwner
    ? (session?.user?.user_metadata?.avatar_url || null)
    : (club.owner?.avatar_url || null)
  const currentUserId = session?.user?.id || null
  const sport = SPORT_CONFIGS[club.sport_type] || SPORT_CONFIGS.badminton
  const tab = activeTab(path, club.id)

  async function setPlan(next) {
    try {
      const { error } = await supabase.from('clubs').update({ plan: next }).eq('id', club.id)
      if (error) throw error
      setClub({ ...club, plan: next })
      toast(next === 'pro' ? t('plan_pro') : t('plan_free'))
    } catch (e) { toast(e.message || t('err_generic')) }
  }

  const tabs = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: LayoutDashboard, path: `/club/${club.id}` },
    { id: 'settings', label: t('nav_settings'), icon: Settings2, path: `/club/${club.id}/settings` },
    { id: 'log', label: t('nav_log'), icon: ClipboardList, path: `/club/${club.id}/log` },
    { id: 'fund', label: t('nav_fund'), icon: History, path: `/club/${club.id}/fund` },
  ]

  if (loading || !settings) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 bg-grid relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cx(
        'fixed left-0 top-[65px] bottom-0 z-40 w-56 flex flex-col border-r border-slate-100 bg-white/90 backdrop-blur-xl transition-transform duration-200',
        'md:sticky md:h-[calc(100vh-4rem)] md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-black text-lime-400">
              {club.name[0].toUpperCase()}
            </span>
            <span className="text-sm font-bold text-slate-900 truncate">{club.name}</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => { navigate(tb.path); setSidebarOpen(false) }}
              className={cx(
                'w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition',
                tab === tb.id
                  ? 'bg-lime-400/10 text-lime-700'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <tb.icon className={cx('h-4 w-4 shrink-0', tab === tb.id ? 'text-lime-600' : 'text-slate-400')} />
              {tb.label}
            </button>
          ))}
        </nav>

        {isOwner && (
          <div className="px-3 pb-2">
            <Button
              variant="ghost" size="sm" className="w-full text-xs"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/join/${club.id}`)
                toast(t('join_copied'))
              }}
            >
              <LinkIcon className="h-3.5 w-3.5" /> {t('join_copy')}
            </Button>
          </div>
        )}

        <div className="p-3 border-t border-slate-100 space-y-2">
          {!canEdit && (
            <div className="flex items-center gap-2 px-1">
              <Eye className="h-3.5 w-3.5 text-cyan-600" />
              <span className="text-xs font-semibold text-cyan-700">{t('role_member')}</span>
            </div>
          )}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <Badge tone={plan === 'pro' ? 'volt' : 'slate'} icon={plan === 'pro' ? Crown : Zap}>
              {plan === 'pro' ? t('plan_pro') : t('plan_free')}
            </Badge>
            {plan === 'free' && isOwner && (
              <Button variant="volt" size="sm" className="mt-2.5 w-full text-xs" onClick={() => setUpsell(true)}>
                <Crown className="h-3 w-3" /> {t('sidebar_upgrade')}
              </Button>
            )}
            {plan === 'pro' && isOwner && (
              <Button variant="subtle" size="sm" className="mt-2.5 w-full text-xs" onClick={() => setPlan('free')}>
                {t('sidebar_switch_free')}
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-white/70 px-5 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-bold text-slate-900 truncate">{club.name}</h2>
          <div className="ml-auto">
            <Badge tone={plan === 'pro' ? 'volt' : 'slate'} icon={plan === 'pro' ? Crown : Zap}>
              {plan === 'pro' ? t('plan_pro') : t('plan_free')}
            </Badge>
          </div>
        </div>

        <div className="flex-1 px-5 py-8 pb-24 mx-auto w-full max-w-[1460px]">
          <div className="hidden md:flex flex-wrap items-center justify-between gap-4 mb-8">
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
              {tab === 'settings'
                ? <><Settings2 className="h-6 w-6 text-slate-300" /> {t('set_title')}</>
                : <><Building2 className="h-6 w-6 text-slate-300" /> {t(`nav_${tab}`)}</>
              }
            </h1>
          </div>


          {tab === 'dashboard' && (
            <DashboardPage
              club={club} settings={settings} slots={slots} members={members} logs={logs}
              fundTxns={fundTxns} pollTally={pollTally} plan={plan} sport={sport}
              hostName={hostName} hostAvatar={hostAvatar} currentUserId={currentUserId}
              canEdit={canEdit} onUnlock={() => setUpsell(true)} onChanged={reload} toast={toast}
            />
          )}

          {tab === 'settings' && (
            <SettingsPage
              club={club} settings={settings} slots={slots} sport={sport} members={members}
              plan={plan} pollTally={pollTally} canEdit={canEdit}
              hostName={hostName} hostAvatar={hostAvatar} currentUserId={currentUserId}
              onSaved={(p) => setSettings((s) => ({ ...s, ...p }))}
              onChanged={reload} onHitLimit={() => setUpsell(true)} toast={toast}
            />
          )}

          {tab === 'log' && (
            <SessionLogPage
              club={club} logs={logs} settings={settings} slots={slots} members={members} sport={sport}
              canEdit={canEdit} onChanged={reload} toast={toast} user={session?.user}
            />
          )}

          {tab === 'fund' && (
            <FundPage
              club={club} fundTxns={fundTxns} settings={settings}
              canEdit={canEdit} onTopUp={reload} toast={toast}
            />
          )}
        </div>
      </main>

      <UpsellModal
        open={upsell}
        clubId={club.id}
        onClose={() => setUpsell(false)}
        onUpgraded={() => setClub({ ...club, plan: 'pro' })}
        toast={toast}
      />
    </div>
  )
}
