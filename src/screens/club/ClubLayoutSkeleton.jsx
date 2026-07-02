import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Settings2, ClipboardList, History, Vote, Building2 } from 'lucide-react'
import { Skeleton } from '../../components/ui/Skeleton'
import { TabContentSkeleton } from '../../components/club/ContentSkeleton'
import { cx } from '../../lib/utils'

const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, key: 'nav_dashboard' },
  { id: 'settings', icon: Settings2, key: 'nav_settings' },
  { id: 'vote', icon: Vote, key: 'nav_vote' },
  { id: 'log', icon: ClipboardList, key: 'nav_log' },
  { id: 'fund', icon: History, key: 'nav_fund' },
]

// Mirrors ClubLayout's real chrome (sidebar width, tab list, content padding)
// so it can stand in during auth resolution, route-chunk loading, and
// per-club data fetching without any layout shift when the real content
// swaps in.
export function ClubLayoutSkeleton({ tab = 'dashboard', clubName }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 bg-grid relative">
      <aside className="hidden md:sticky md:top-[65px] md:flex md:h-[calc(100vh-4rem)] w-56 shrink-0 flex-col border-r border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {clubName ? (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-black text-lime-400">
                {clubName[0].toUpperCase()}
              </span>
            ) : (
              <Skeleton className="h-8 w-8 shrink-0 rounded-xl" />
            )}
            {clubName ? (
              <span className="text-sm font-bold text-slate-900 truncate">{clubName}</span>
            ) : (
              <Skeleton className="h-4 w-28" />
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {TABS.map((tb) => (
            <div
              key={tb.id}
              className={cx(
                'w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold',
                tab === tb.id ? 'bg-lime-400/10 text-lime-700' : 'text-slate-400'
              )}
            >
              <tb.icon className={cx('h-4 w-4 shrink-0', tab === tb.id ? 'text-lime-600' : 'text-slate-300')} />
              {t(tb.key)}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-white/70 px-5 py-3 md:hidden">
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          {clubName ? (
            <h2 className="text-sm font-bold text-slate-900 truncate">{clubName}</h2>
          ) : (
            <Skeleton className="h-4 w-24" />
          )}
          <div className="ml-auto">
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>

        <div className="flex-1 px-5 py-8 pb-24 mx-auto w-full max-w-[1460px]">
          <div className="hidden md:flex flex-wrap items-center justify-between gap-4 mb-8">
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
              {tab === 'settings' ? (
                <>
                  <Settings2 className="h-6 w-6 text-slate-300" /> {t('set_title')}
                </>
              ) : (
                <>
                  <Building2 className="h-6 w-6 text-slate-300" /> {t(`nav_${tab}`)}
                </>
              )}
            </h1>
          </div>
          <TabContentSkeleton tab={tab} />
        </div>
      </main>
    </div>
  )
}
