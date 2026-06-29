import { useTranslation } from 'react-i18next'
import { Store, Settings, LogOut, Loader2 } from 'lucide-react'
import { Logo } from '../../components/layout/Nav'
import { useShopData } from '../../hooks/useShopData'
import { matchPath, navigate } from '../../router'
import { cx } from '../../lib/utils'
import { ShopDashboardPage } from './ShopDashboardPage'
import { ShopClubDetailPage } from './ShopClubDetailPage'
import { ShopSettingsPage } from './ShopSettingsPage'

function ShopHeader({ shop, path, onSignOut }) {
  const { t } = useTranslation()
  const tabs = [
    { key: 'dashboard', label: t('shop_nav_dashboard'), to: '/shop' },
    { key: 'settings', label: t('shop_nav_settings'), to: '/shop/settings' },
  ]
  const isSettings = path.startsWith('/shop/settings')
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <Logo onClick={() => navigate('/shop')} />
          <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 sm:inline-flex">
            <Store className="h-3.5 w-3.5" /> {shop?.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {tabs.map((tab) => {
            const active = tab.key === 'settings' ? isSettings : !isSettings
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.to)}
                className={cx(
                  'rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                  active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {tab.label}
              </button>
            )
          })}
          <button
            onClick={onSignOut}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            title={t('signOut')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

export function ShopLayout({ session, shop, setShop, onSignOut, path, toast, reloadShop }) {
  const { t } = useTranslation()
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
    <div className="flex min-h-screen flex-1 flex-col">
      <ShopHeader shop={shop} path={path} onSignOut={onSignOut} />
      {data.error ? (
        <div className="mx-auto w-full max-w-5xl px-5 py-16 text-center text-slate-400">
          {t('err_generic')}
        </div>
      ) : (
        body
      )}
    </div>
  )
}
