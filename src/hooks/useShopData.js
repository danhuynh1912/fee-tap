import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { computeShuttleStock } from '../engine/forecast'

// useShopData — loads everything a shop needs in ONE batch RPC (no N+1, no
// Realtime). The inventory algorithm stays the single source of truth in
// engine/forecast.js (computeShuttleStock); this hook only fetches the raw,
// access-scoped rows and runs that one algorithm per linked club.
export function useShopData(shop) {
  const shopId = shop?.id
  const [rawClubs, setRawClubs] = useState([]) // active linked clubs + their data
  const [pendingLinks, setPendingLinks] = useState([]) // pending requests (in/out)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    setError(null)
    try {
      const [{ data: clubsData, error: rpcErr }, { data: links, error: linkErr }] = await Promise.all([
        supabase.rpc('get_shop_clubs_data', { p_shop_id: shopId }),
        supabase
          .from('shop_club_links')
          .select('id, club_id, status, initiated_by, created_at, clubs(name)')
          .eq('shop_id', shopId)
          .eq('status', 'pending'),
      ])
      if (rpcErr) throw rpcErr
      if (linkErr) throw linkErr
      setRawClubs(Array.isArray(clubsData) ? clubsData : [])
      setPendingLinks(links || [])
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

  // Per-club inventory stats via the SSOT algorithm.
  const linkedClubs = useMemo(() => {
    return rawClubs.map((row) => {
      const slots = row.slots || []
      const stats = computeShuttleStock(row.shuttleTxns || [], slots, row.settings || {}, row.logs || [])
      const weekdays = [...new Set(slots.flatMap((s) => (Array.isArray(s.weekdays) ? s.weekdays : [])))].sort()
      return {
        club: row.club,
        link: row.link,
        stats,
        weekdays,
        slots,
        deliveries: row.deliveries || [],
      }
    })
  }, [rawClubs])

  const summary = useMemo(() => {
    const lowStock = linkedClubs.filter((c) => c.stats.isLowStock)
    const weekdaysUnion = new Set()
    linkedClubs.forEach((c) => c.weekdays.forEach((wd) => weekdaysUnion.add(wd)))
    return {
      clubCount: linkedClubs.length,
      lowStockCount: lowStock.length,
      lowStockClubs: lowStock,
      activeWeekdays: weekdaysUnion.size,
    }
  }, [linkedClubs])

  return { linkedClubs, pendingLinks, summary, loading, error, reload: load }
}
