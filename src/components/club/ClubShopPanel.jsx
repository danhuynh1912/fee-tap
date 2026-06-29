import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Store, Search, Loader2, Check, X, Unlink, Send } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { inputCls } from '../ui/Field'
import { DeliveryHistory } from '../shop/DeliveryHistory'
import { supabase } from '../../lib/supabase'
import { fmtDate, cx } from '../../lib/utils'
import { handleError } from '../../lib/handleError'
import { createLink, acceptLink, rejectLink, removeLink, confirmDelivery } from '../../lib/shopLinks'

// Club-side counterpart of the shop portal: manage the single partner shop link
// and confirm incoming deliveries (which post to the shuttle_transactions ledger).
export function ClubShopPanel({ club, canEdit, toast }) {
  const { t } = useTranslation()
  const [link, setLink] = useState(null) // active or pending link row (+ shops(name))
  const [deliveries, setDeliveries] = useState([]) // unconfirmed deliveries
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // search state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: links }, { data: dels }] = await Promise.all([
        supabase
          .from('shop_club_links')
          .select('id, status, initiated_by, linked_at, shop_id, shops(name)')
          .eq('club_id', club.id)
          .in('status', ['pending', 'active'])
          .maybeSingle(),
        supabase
          .from('shuttle_deliveries')
          .select('id, boxes, note, delivered_at, confirmed_by_club')
          .eq('club_id', club.id)
          .eq('confirmed_by_club', false)
          .order('delivered_at', { ascending: false }),
      ])
      setLink(links || null)
      setDeliveries(dels || [])
    } finally {
      setLoading(false)
    }
  }, [club.id])

  useEffect(() => {
    load()
  }, [load])

  async function runSearch() {
    if (query.trim().length < 2 || searching) return
    setSearching(true)
    try {
      const { data, error } = await supabase.rpc('search_shops', { p_query: query.trim() })
      if (error) throw error
      setResults(data || [])
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setSearching(false)
    }
  }

  async function act(fn) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      await load()
    } catch (e) {
      handleError(e, toast, t)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
  }

  const isActive = link?.status === 'active'
  const isPendingFromShop = link?.status === 'pending' && link.initiated_by === 'shop'
  const isPendingFromClub = link?.status === 'pending' && link.initiated_by === 'club'

  return (
    <div className="space-y-4">
      {/* Link status */}
      {isActive && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-lime-400">
            <Store className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-slate-900">{link.shops?.name}</p>
            <p className="text-xs text-slate-400">{t('shop_partner_linked_since', { date: fmtDate(link.linked_at) })}</p>
          </div>
          {canEdit && (
            <Button size="sm" variant="danger" onClick={() => act(() => removeLink(link.id))} disabled={busy}>
              <Unlink className="h-4 w-4" /> {t('shop_partner_disconnect')}
            </Button>
          )}
        </div>
      )}

      {isPendingFromShop && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {t('shop_partner_pending_from', { name: link.shops?.name || '' })}
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => act(() => acceptLink(link.id))}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> {t('shop_link_accept')}
              </button>
              <button
                onClick={() => act(() => rejectLink(link.id))}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition active:scale-95 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> {t('shop_link_reject')}
              </button>
            </div>
          )}
        </div>
      )}

      {isPendingFromClub && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-slate-900">{link.shops?.name}</p>
            <p className="text-xs text-slate-400">{t('shop_link_waiting')}</p>
          </div>
          <Badge tone="amber">{t('shop_delivery_pending')}</Badge>
        </div>
      )}

      {/* No link → search & invite */}
      {!link && canEdit && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{t('shop_partner_none')}</p>
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder={t('shop_partner_search_ph')}
            />
            <Button variant="ghost" onClick={runSearch} disabled={query.trim().length < 2 || searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {results.length > 0 && (
            <ul className="space-y-1.5">
              {results.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{s.name}</p>
                    {s.phone && <p className="text-xs text-slate-400">{s.phone}</p>}
                  </div>
                  <button
                    onClick={() => act(() => createLink({ shopId: s.id, clubId: club.id, initiatedBy: 'club' }).then(() => toast(t('shop_link_sent'))))}
                    disabled={busy}
                    className={cx('inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95', busy && 'opacity-50')}
                  >
                    <Send className="h-3.5 w-3.5" /> {t('shop_link_send')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Incoming deliveries to confirm */}
      {deliveries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('shop_deliveries_title')}</p>
          <DeliveryHistory
            deliveries={deliveries}
            onConfirm={canEdit ? (id) => confirmDelivery(id).then(load).catch((e) => handleError(e, toast, t)) : undefined}
          />
        </div>
      )}
    </div>
  )
}
