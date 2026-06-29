import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Store, Settings, LogOut, Menu, X, LayoutDashboard } from 'lucide-react'
import { Logo } from '../../components/layout/Nav'
import { Modal } from '../../components/ui/Modal'
import { useShopData } from '../../hooks/useShopData'
import { matchPath, navigate } from '../../router'
import { cx } from '../../lib/utils'
import { ShopDashboardPage } from './ShopDashboardPage'
import { ShopClubDetailPage } from './ShopClubDetailPage'
import { ShopSettingsPage } from './ShopSettingsPage'

function ShopSidebar({ shop, path, onSignOut, open, onClose }) {
  const { t } = useTranslation()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const isSettings = path.startsWith('/shop/settings')
  const isDetail = path.startsWith('/shop/clubs/')

  const nav = [
    { id: 'dashboard', label: t('shop_nav_dashboard'), icon: LayoutDashboard, to: '/shop' },
    { id: 'settings', label: t('shop_nav_settings'), icon: Settings, to: '/shop/settings' },
  ]
  const activeId = isSettings ? 'settings' : 'dashboard'

  return (
    <aside
      className={cx(
        'fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-slate-900 transition-transform duration-200',
        'md:sticky md:top-0 md:h-screen md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-slate-800">
        <Logo onClick={() => { navigate('/shop'); onClose() }} light />
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:text-slate-300 transition md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Shop identity */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime-400 text-slate-900">
            <Store className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-bold text-white">{shop?.name}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
        {nav.map(({ id, label, icon: Icon, to }) => {
          const active = id === activeId
          return (
            <button
              key={id}
              onClick={() => { navigate(to); onClose() }}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                active
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              )}
            >
              <Icon className={cx('h-4 w-4 shrink-0', active ? 'text-lime-400' : '')} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={() => setConfirmSignOut(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t('signOut')}
        </button>
      </div>

      <Modal open={confirmSignOut} onClose={() => setConfirmSignOut(false)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-900">
              <LogOut className="h-5 w-5 text-lime-400" />
            </span>
            <div>
              <p className="font-black text-slate-900">{t('signout_confirm_title')}</p>
              <p className="mt-0.5 text-sm text-slate-400">{t('signout_confirm_sub')}</p>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setConfirmSignOut(false)}
              className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-[0.98]"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => { setConfirmSignOut(false); onSignOut() }}
              className="flex-1 rounded-2xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition active:scale-[0.98]"
            >
              {t('signOut')}
            </button>
          </div>
        </div>
      </Modal>
    </aside>
  )
}

export function ShopLayout({ session, shop, setShop, onSignOut, path, toast, reloadShop }) {
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const data = useShopData(shop)

  const detailMatch = matchPath('/shop/clubs/:id', path)
  const isSettings = path.startsWith('/shop/settings')

  let body
  if (isSettings) {
    body = <ShopSettingsPage shop={shop} setShop={setShop} reloadShop={reloadShop} toast={toast} />
  } else if (detailMatch) {
    const entry = data.linkedClubs.find((c) => c.club.id === detailMatch.params.id)
    body = (
      <ShopClubDetailPage
        shop={shop}
        entry={entry}
        loading={data.loading}
        toast={toast}
        onReload={data.reload}
      />
    )
  } else {
    body = <ShopDashboardPage shop={shop} data={data} toast={toast} />
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <ShopSidebar
        shop={shop}
        path={path}
        onSignOut={onSignOut}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Content */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-slate-900">{shop?.name}</span>
        </div>

        {data.error ? (
          <div className="flex flex-1 items-center justify-center py-20 text-sm text-slate-400">
            {t('err_generic')}
          </div>
        ) : (
          body
        )}
      </div>
    </div>
  )
}
