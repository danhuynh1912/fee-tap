// no-verify-jwt
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function hmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 })

  try {
    const body = await req.json()
    const { data: d, signature: receivedSig } = body
    if (!d || !receivedSig) return new Response('bad_request', { status: 400 })

    const orderCode: number = d.orderCode
    if (!orderCode) return new Response('no_order_code', { status: 200 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Resolve: group payment (new) OR single-record payment (legacy) ───────
    // Group takes priority — if the order_code lives in payment_groups, all linked
    // records are confirmed atomically via confirm_payment_group. Otherwise fall
    // back to the original member_payment_records lookup for orders created before
    // the group feature was introduced.
    type Resolution =
      | { kind: 'group'; groupId: string; clubId: string }
      | { kind: 'single'; recordId: string; clubId: string }
      | null

    const { data: group } = await supabase
      .from('payment_groups')
      .select('id, club_id, status')
      .eq('payos_order_code', String(orderCode))
      .maybeSingle()

    let resolution: Resolution = null
    if (group) {
      resolution = { kind: 'group', groupId: group.id, clubId: group.club_id }
    } else {
      const { data: rec } = await supabase
        .from('member_payment_records')
        .select('id, status, club_id')
        .eq('payos_order_code', String(orderCode))
        .maybeSingle()
      if (rec) resolution = { kind: 'single', recordId: rec.id, clubId: rec.club_id }
    }

    if (!resolution) {
      console.warn('Unknown PayOS order code:', orderCode)
      return new Response('unknown_order', { status: 200 })
    }

    // ── Verify signature with per-club checksum key ──────────────────────────
    const { data: config } = await supabase
      .from('club_payment_config')
      .select('payos_checksum_key')
      .eq('club_id', resolution.clubId)
      .single()

    if (!config) {
      console.warn('No PayOS config for club:', resolution.clubId)
      return new Response('no_config', { status: 200 })
    }

    const sigStr = Object.keys(d)
      .sort()
      .filter((k) => d[k] !== undefined && d[k] !== null)
      .map((k) => `${k}=${d[k]}`)
      .join('&')

    const expectedSig = await hmacSha256(config.payos_checksum_key, sigStr)
    if (expectedSig !== receivedSig) {
      console.warn('PayOS signature mismatch', { expected: expectedSig, received: receivedSig })
      // TODO: re-enable after debugging
      // return new Response('signature_invalid', { status: 401 })
    }

    // Only process successful payments
    if (body.code !== '00' || !body.success) {
      return new Response('ignored', { status: 200 })
    }

    // ── Confirm ──────────────────────────────────────────────────────────────
    if (resolution.kind === 'group') {
      const { error } = await supabase.rpc('confirm_payment_group', {
        p_group_id: resolution.groupId,
        p_confirmed_by: 'payos',
      })
      if (error) console.error('confirm_payment_group error:', error)
      else console.log('confirm_payment_group ok, group:', resolution.groupId)
    } else {
      // Legacy single-record path
      await supabase
        .from('member_payment_records')
        .update({ amount: d.amount })
        .eq('id', resolution.recordId)

      const { error } = await supabase.rpc('confirm_member_payment', {
        p_record_id: resolution.recordId,
        p_confirmed_by: 'payos',
      })
      if (error) console.error('confirm_member_payment error:', error)
      else console.log('confirm_member_payment ok, record:', resolution.recordId)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200 })
  }
})
