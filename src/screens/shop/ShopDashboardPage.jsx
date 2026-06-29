import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Calendar, AlertTriangle, Plus, ChevronRight, Loader2, Link2, Check, X } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, inputCls } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { WeekdayChips } from '../../components/shop/WeekdayChips'
import { DeliveryModal } from '../../components/shop/DeliveryModal'
import { navigate } from '../../router'
import { cx } from '../../lib/utils'
import { handleError } from '../../lib/handleError'
import { parseClubRef, createLink, acceptLink, rejectLink } from '../../lib/shopLinks'

function StatCard({ icon: Icon, value, label, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    amber: 'text-amber-600',
  }
  return (
    <Card className="flex items-center gap-4">
      <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100', tones[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className={cx('text-2xl font-black tracking-tight font-mono tabular-nums', tones[tone])}>{value}</p>
        <p className="text-xs font-semibold text-slate-400">{label}</p>
      </div>
    </Card>
  )
}

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
          <input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t('shop_add_club_ph')} autoFocus />
        </Field>
        <Button variant="primary" className="w-full" onClick={submit} disabled={!parseClubRef(ref) || busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t('shop_link_send')}
        </Button>
      </div>
    </Modal>
  )
}

function PendingLinkRow({ link, onReload, toast }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const incoming = link.initiated_by === 'club'

  async function act(fn) {
    if (busy) return
    setBusy(true)
    try {
      await fn(link.id)
      onReload?.()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{link.clubs?.name || link.club_id}</p>
        <p className="text-xs text-slate-400">{incoming ? t('shop_link_incoming') : t('shop_link_waiting')}</p>
      </div>
      {incoming ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => act(acceptLink)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> {t('shop_link_accept')}
          </button>
          <button
            onClick={() => act(rejectLink)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition active:scale-95 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> {t('shop_link_reject')}
          </button>
        </div>
      ) : (
        <Badge tone="amber">{t('shop_delivery_pending')}</Badge>
      )}
    </li>
  )
}

export function ShopDashboardPage({ shop, data, toast }) {
  const { t } = useTranslation()
  const { linkedClubs, pendingLinks, summary, loading, reload } = data
  const [addOpen, setAddOpen] = useState(false)
  const [deliveryClub, setDeliveryClub] = useState(null)

  if (loading) {
    return (
      <div className="grid flex-1 place-items-center py-20 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Building2} value={summary.clubCount} label={t('shop_stat_clubs')} />
        <StatCard icon={Calendar} value={summary.activeWeekdays} label={t('shop_stat_active_days')} />
        <StatCard icon={AlertTriangle} value={summary.lowStockCount} label={t('shop_stat_low_stock')} tone={summary.lowStockCount > 0 ? 'amber' : 'slate'} />
      </div>

      {/* Pending links */}
      {pendingLinks.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">{t('shop_pending_title')}</h2>
          <ul className="space-y-2">
            {pendingLinks.map((link) => (
              <PendingLinkRow key={link.id} link={link} onReload={reload} toast={toast} />
            ))}
          </ul>
        </section>
      )}

      {/* Low stock alerts */}
      {summary.lowStockClubs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-600">
            <AlertTriangle className="h-4 w-4" /> {t('shop_low_stock_title')}
          </h2>
          <div className="space-y-2">
            {summary.lowStockClubs.map((entry) => (
              <Card key={entry.club.id} className="border-amber-200 bg-amber-50/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button onClick={() => navigate(`/shop/clubs/${entry.club.id}`)} className="text-left">
                      <p className="font-bold text-slate-900 hover:underline">{entry.club.name}</p>
                    </button>
                    <p className="mt-0.5 font-mono text-sm text-slate-600">
                      {t('shop_balls_left', { n: entry.stats.totalBalls })} · {t('shuttle_sessions_left', { n: entry.stats.sessionsLeft })}
                    </p>
                    <WeekdayChips weekdays={entry.weekdays} className="mt-2" />
                  </div>
                  <Button size="sm" variant="volt" onClick={() => setDeliveryClub(entry.club)}>
                    {t('shop_record_delivery')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Linked clubs */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">{t('shop_clubs_title')}</h2>
          <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> {t('shop_add_club')}
          </Button>
        </div>
        {linkedClubs.length === 0 ? (
          <Card className="text-center text-sm text-slate-400">{t('shop_no_clubs')}</Card>
        ) : (
          <div className="grid gap-2">
            {linkedClubs.map((entry) => (
              <button
                key={entry.club.id}
                onClick={() => navigate(`/shop/clubs/${entry.club.id}`)}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{entry.club.name}</p>
                  <p className="font-mono text-xs text-slate-500">
                    {t('shop_balls_left', { n: entry.stats.totalBalls })} · {t('shuttle_sessions_left', { n: entry.stats.sessionsLeft })}
                  </p>
                </div>
                {entry.stats.isLowStock && <Badge tone="amber">{t('shop_low')}</Badge>}
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        )}
      </section>

      <AddClubModal open={addOpen} shopId={shop.id} onClose={() => setAddOpen(false)} onDone={reload} toast={toast} />
      <DeliveryModal
        open={!!deliveryClub}
        shopId={shop.id}
        club={deliveryClub}
        onClose={() => setDeliveryClub(null)}
        onDone={reload}
        toast={toast}
      />
    </main>
  )
}
