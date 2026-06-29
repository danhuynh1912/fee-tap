import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Plus, ChevronRight, Loader2, Link2, Check, X, Building2, Package, TrendingDown } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Field, inputCls } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { WeekdayChips } from '../../components/shop/WeekdayChips'
import { DeliveryModal } from '../../components/shop/DeliveryModal'
import { navigate } from '../../router'
import { cx } from '../../lib/utils'
import { handleError } from '../../lib/handleError'
import { parseClubRef, createLink, acceptLink, rejectLink } from '../../lib/shopLinks'

function AddClubModal({ open, shopId, onClose, onDone, toast }) {
  const { t } = useTranslation()
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const clubId = parseClubRef(ref)
    if (!clubId || busy) return
    setBusy(true)
    try {
      await createLink({ shopId, clubId, initiatedBy: 'shop' })
      toast(t('shop_link_sent'))
      setRef('')
      onClose()
      onDone?.()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-lime-400">
          <Link2 className="h-5 w-5" />
        </span>
        <h2 className="text-base font-bold text-slate-900">{t('shop_add_club_title')}</h2>
      </div>
      <div className="space-y-4">
        <Field label={t('shop_add_club_ref')} icon={Building2} hint={t('shop_add_club_hint')}>
          <input
            className={inputCls}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder={t('shop_add_club_ph')}
            autoFocus
          />
        </Field>
        <Button variant="primary" className="w-full" onClick={submit} disabled={!parseClubRef(ref) || busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t('shop_link_send')}
        </Button>
      </div>
    </Modal>
  )
}

function PendingRow({ link, onReload, toast }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const incoming = link.initiated_by === 'club'

  async function act(fn) {
    if (busy) return
    setBusy(true)
    try { await fn(link.id); onReload?.() }
    catch (e) { handleError(e, toast, t) }
    finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition rounded-xl -mx-2">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600">
        <Building2 className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{link.clubs?.name || link.club_id}</p>
        <p className="text-xs text-slate-400">{incoming ? t('shop_link_incoming') : t('shop_link_waiting')}</p>
      </div>
      {incoming ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => act(acceptLink)} disabled={busy}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-40"
          >
            <Check className="h-3 w-3" /> {t('shop_link_accept')}
          </button>
          <button
            onClick={() => act(rejectLink)} disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition active:scale-95 disabled:opacity-40"
          >
            <X className="h-3 w-3" /> {t('shop_link_reject')}
          </button>
        </div>
      ) : (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{t('shop_link_waiting')}</span>
      )}
    </div>
  )
}

// Stock bar: visual indicator of how full the inventory is (0–5+ sessions)
function StockBar({ sessionsLeft, isLowStock }) {
  const capped = Math.min(Math.max(sessionsLeft || 0, 0), 8)
  const pct = (capped / 8) * 100
  const barColor = isLowStock ? 'bg-amber-400' : 'bg-lime-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={cx('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ShopDashboardPage({ shop, data, toast }) {
  const { t } = useTranslation()
  const { linkedClubs, pendingLinks, summary, loading, reload } = data
  const [addOpen, setAddOpen] = useState(false)
  const [deliveryClub, setDeliveryClub] = useState(null)

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Page header */}
      <div className="border-b border-slate-100 bg-white px-8 py-6">
        <h1 className="text-xl font-black tracking-tight text-slate-900">{t('shop_nav_dashboard')}</h1>
        <p className="mt-0.5 text-sm text-slate-400">{shop.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/40 px-8 py-6">
        {/* Stat row */}
        <div className="mb-6 grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {[
            { value: summary.clubCount, label: t('shop_stat_clubs'), icon: Building2, alert: false },
            { value: summary.activeWeekdays, label: t('shop_stat_active_days'), icon: Package, alert: false },
            { value: summary.lowStockCount, label: t('shop_stat_low_stock'), icon: TrendingDown, alert: summary.lowStockCount > 0 },
          ].map(({ value, label, icon: Icon, alert }) => (
            <div key={label} className="flex items-center gap-3 px-6 py-5">
              <span className={cx(
                'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                alert ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400'
              )}>
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className={cx('font-mono text-2xl font-black tabular-nums leading-none', alert ? 'text-amber-500' : 'text-slate-900')}>
                  {value}
                </p>
                <p className="mt-1 text-xs text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pending links */}
        {pendingLinks.length > 0 && (
          <section className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t('shop_pending_title')}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/30 px-2 py-1">
              {pendingLinks.map((link) => (
                <PendingRow key={link.id} link={link} onReload={reload} toast={toast} />
              ))}
            </div>
          </section>
        )}

        {/* Low stock callout */}
        {summary.lowStockClubs.length > 0 && (
          <section className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">{t('shop_low_stock_title')}</p>
            </div>
            <div className="space-y-1">
              {summary.lowStockClubs.map((entry) => (
                <div
                  key={entry.club.id}
                  className="flex items-center gap-4 rounded-xl border-l-2 border-amber-400 bg-white px-4 py-3 shadow-sm shadow-slate-900/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => navigate(`/shop/clubs/${entry.club.id}`)}
                      className="text-left text-sm font-semibold text-slate-900 hover:text-amber-700 transition"
                    >
                      {entry.club.name}
                    </button>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-500">
                        {t('shop_balls_left', { n: entry.stats.totalBalls })}
                      </span>
                      <StockBar sessionsLeft={entry.stats.sessionsLeft} isLowStock />
                      <span className="font-mono text-xs text-amber-600">
                        ~{entry.stats.sessionsLeft} {t('shop_stat_active_days').toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeliveryClub(entry.club)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-lime-400 transition hover:bg-slate-700 active:scale-95"
                  >
                    <Package className="h-3.5 w-3.5" />
                    {t('shop_record_delivery')}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Club table */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t('shop_clubs_title')}</p>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-900 hover:text-slate-900 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" /> {t('shop_add_club')}
            </button>
          </div>

          {linkedClubs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <Building2 className="h-6 w-6" />
              </span>
              <p className="text-sm text-slate-400">{t('shop_no_clubs')}</p>
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-lime-400 transition hover:bg-slate-700 active:scale-95"
              >
                <Plus className="h-4 w-4" /> {t('shop_add_club')}
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {/* Header */}
              <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-2.5">
                <p className="flex-1 text-xs font-semibold text-slate-400">{t('shop_col_club')}</p>
                <p className="w-32 text-right text-xs font-semibold text-slate-400">{t('shop_col_stock')}</p>
                <p className="w-4" />
              </div>
              {/* Rows */}
              {linkedClubs.map((entry, i) => (
                <button
                  key={entry.club.id}
                  onClick={() => navigate(`/shop/clubs/${entry.club.id}`)}
                  className={cx(
                    'flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-slate-50 active:scale-[0.99]',
                    i > 0 && 'border-t border-slate-100'
                  )}
                >
                  {/* Club */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-500">
                      {entry.club.name[0].toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{entry.club.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {entry.weekdays.map((wd) => (
                          <span key={wd} className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-semibold text-slate-500">
                            {t(`wd_${wd}`)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Stock */}
                  <div className="flex w-32 flex-col items-end gap-1">
                    <span className={cx(
                      'font-mono text-sm font-bold tabular-nums',
                      entry.stats.isLowStock ? 'text-amber-500' : 'text-slate-700'
                    )}>
                      {entry.stats.totalBalls}
                      <span className="ml-0.5 text-xs font-normal text-slate-400"> quả</span>
                    </span>
                    <StockBar sessionsLeft={entry.stats.sessionsLeft} isLowStock={entry.stats.isLowStock} />
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <AddClubModal open={addOpen} shopId={shop.id} onClose={() => setAddOpen(false)} onDone={reload} toast={toast} />
      <DeliveryModal
        open={!!deliveryClub}
        shopId={shop.id}
        club={deliveryClub}
        onClose={() => setDeliveryClub(null)}
        onDone={reload}
        toast={toast}
      />
    </div>
  )
}
