import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MapPin, Package, Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { DeliveryHistory } from '../../components/shop/DeliveryHistory'
import { DeliveryModal } from '../../components/shop/DeliveryModal'
import { ShuttlecockIcon } from '../../components/club/ShuttleTubeWidget'
import { navigate } from '../../router'
import { fmtDate, cx, shuttleStockSummary } from '../../lib/utils'
import { BALLS_PER_BOX } from '../../constants'

// Horizontal tube — one row of 12 shuttlecocks per box
function HorizontalTubes({ totalBalls }) {
  if (totalBalls <= 0) return null
  const totalBoxes = Math.floor(totalBalls / BALLS_PER_BOX)
  const remainder = totalBalls % BALLS_PER_BOX
  const tubes = Array.from({ length: totalBoxes + (remainder > 0 ? 1 : 0) }, (_, i) =>
    i < totalBoxes ? BALLS_PER_BOX : remainder
  )

  return (
    <div className="space-y-1.5">
      {tubes.map((filled, boxIdx) => (
        <div
          key={boxIdx}
          className="flex items-center gap-[3px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 w-fit"
        >
          {Array.from({ length: BALLS_PER_BOX }, (_, i) => (
            <ShuttlecockIcon key={i} filled={i < filled} />
          ))}
        </div>
      ))}
    </div>
  )
}

function InventoryBlock({ stats, t }) {
  const { totalBalls, sessionsLeft, isLowStock, nextBuyDate } = stats || {}
  const isEmpty = (totalBalls ?? 0) <= 0

  return (
    <div className="space-y-4">
      {/* Horizontal tubes */}
      {isEmpty ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm font-semibold text-red-700">{t('shuttle_stock_empty')}</span>
        </div>
      ) : (
        <>
          <HorizontalTubes totalBalls={totalBalls} />
          <p className="font-mono text-sm font-semibold text-slate-600">
            {shuttleStockSummary(totalBalls, t, BALLS_PER_BOX)}
          </p>
        </>
      )}

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {!isEmpty && (
          <span className={cx(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
            isLowStock ? 'bg-amber-100 text-amber-700' : 'bg-lime-100 text-lime-800'
          )}>
            {isLowStock ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            ~{sessionsLeft ?? 0} {t('shuttle_sessions_left_short')}
          </span>
        )}
        {nextBuyDate && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
            <Clock className="h-3 w-3" />
            {t('shop_restock_by', { date: fmtDate(nextBuyDate) })}
          </span>
        )}
      </div>
    </div>
  )
}

export function ShopClubDetailPage({ shop, entry, loading, toast, onReload }) {
  const { t } = useTranslation()
  const [deliveryOpen, setDeliveryOpen] = useState(false)

  if (loading && !entry) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (!entry) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-sm text-slate-400">
        <p>{t('club_not_found')}</p>
        <button onClick={() => navigate('/shop')} className="font-medium text-slate-600 underline underline-offset-2">
          {t('shop_back_dashboard')}
        </button>
      </div>
    )
  }

  const { club, stats, weekdays, slots, deliveries } = entry
  const venues = [...new Set(slots.map((s) => s.venue_name).filter(Boolean))]

  return (
    <div className="flex flex-1 flex-col">
      {/* Page header */}
      <div className="border-b border-slate-100 bg-white px-8 py-5">
        <button
          onClick={() => navigate('/shop')}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('shop_back_dashboard')}
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">{club.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {weekdays.map((wd) => (
                <span key={wd} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {t('shop_weekly_day', { day: t(`wd_full_${wd}`) })}
                </span>
              ))}
              {venues.map((v) => (
                <span key={v} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500">
                  <MapPin className="h-3 w-3 shrink-0" />{v}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setDeliveryOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-lime-400 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-lime-300 active:scale-95"
          >
            <Package className="h-4 w-4" />
            {t('shop_record_delivery')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50/40 px-8 py-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">

          {/* Left col: inventory + schedule */}
          <div className="space-y-6">
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                {t('shop_inventory_title')}
              </p>
              <InventoryBlock stats={stats} t={t} />
            </section>

          </div>

          {/* Right col: delivery history */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              {t('shop_deliveries_title')}
            </p>
            <DeliveryHistory deliveries={deliveries} />
          </section>
        </div>
      </div>

      <DeliveryModal
        open={deliveryOpen}
        shopId={shop.id}
        club={club}
        onClose={() => setDeliveryOpen(false)}
        onDone={onReload}
        toast={toast}
      />
    </div>
  )
}
