import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MapPin, Package, Loader2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ShuttleTubeWidget } from '../../components/club/ShuttleTubeWidget'
import { WeekdayChips } from '../../components/shop/WeekdayChips'
import { DeliveryHistory } from '../../components/shop/DeliveryHistory'
import { DeliveryModal } from '../../components/shop/DeliveryModal'
import { navigate } from '../../router'

export function ShopClubDetailPage({ shop, entry, loading, toast, onReload }) {
  const { t } = useTranslation()
  const [deliveryOpen, setDeliveryOpen] = useState(false)

  if (loading && !entry) {
    return (
      <div className="grid flex-1 place-items-center py-20 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }
  if (!entry) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-16 text-center">
        <p className="text-slate-400">{t('club_not_found')}</p>
        <button onClick={() => navigate('/shop')} className="mt-4 text-sm font-medium text-slate-600 underline">
          {t('shop_back_dashboard')}
        </button>
      </main>
    )
  }

  const { club, stats, weekdays, slots, deliveries } = entry
  const venues = [...new Set(slots.map((s) => s.venue_name).filter(Boolean))]

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <button
        onClick={() => navigate('/shop')}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" /> {club.name}
      </button>

      <div className="space-y-5">
        {/* Inventory */}
        <Card>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('shop_inventory_title')}</p>
          <ShuttleTubeWidget shuttleStatus={stats} canEdit={false} />
        </Card>

        {/* Fixed schedule */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('shop_schedule_title')}</p>
          <WeekdayChips weekdays={weekdays} />
          {venues.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <MapPin className="h-4 w-4 text-slate-400" />
              {venues.join(' · ')}
            </div>
          )}
        </Card>

        {/* Deliveries */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('shop_deliveries_title')}</p>
            <Button size="sm" variant="volt" onClick={() => setDeliveryOpen(true)}>
              <Package className="h-4 w-4" /> {t('shop_record_delivery')}
            </Button>
          </div>
          <DeliveryHistory deliveries={deliveries} />
        </Card>
      </div>

      <DeliveryModal
        open={deliveryOpen}
        shopId={shop.id}
        club={club}
        onClose={() => setDeliveryOpen(false)}
        onDone={onReload}
        toast={toast}
      />
    </main>
  )
}
