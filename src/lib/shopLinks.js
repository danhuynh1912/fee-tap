import { supabase } from './supabase'

// Single source of truth for shop ↔ club link mutations. Used by both the shop
// dashboard and the club settings panel so the two sides never drift.

// Extract a club id from a raw id or a pasted /join/:id link.
export function parseClubRef(input) {
  const s = (input || '').trim()
  if (!s) return null
  const m = s.match(/\/join\/([0-9a-f-]+)/i)
  return m ? m[1] : s
}

export async function createLink({ shopId, clubId, initiatedBy }) {
  const { error } = await supabase
    .from('shop_club_links')
    .insert({ shop_id: shopId, club_id: clubId, status: 'pending', initiated_by: initiatedBy })
  if (error) throw error
}

export async function acceptLink(linkId) {
  const { error } = await supabase
    .from('shop_club_links')
    .update({ status: 'active', linked_at: new Date().toISOString() })
    .eq('id', linkId)
  if (error) throw error
}

export async function rejectLink(linkId) {
  const { error } = await supabase.from('shop_club_links').update({ status: 'rejected' }).eq('id', linkId)
  if (error) throw error
}

// Disconnect an active link (either side may sever it).
export async function removeLink(linkId) {
  const { error } = await supabase.from('shop_club_links').delete().eq('id', linkId)
  if (error) throw error
}

export async function confirmDelivery(deliveryId) {
  const { error } = await supabase.rpc('confirm_shuttle_delivery', { p_delivery_id: deliveryId })
  if (error) throw error
}
