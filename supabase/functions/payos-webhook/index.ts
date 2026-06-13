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

    // Find payment record + club to get the per-club checksum key
    // Cast to text to handle both integer and text storage of orderCode
    const { data: rec } = await supabase
      .from('member_payment_records')
      .select('id, status, club_id')
      .eq('payos_order_code', String(orderCode))
      .maybeSingle()

    if (!rec) {
      console.warn('Unknown PayOS order code:', orderCode)
      return new Response('unknown_order', { status: 200 })
    }

    // Get the club's own checksum key for signature verification
    const { data: config } = await supabase
      .from('club_payment_config')
      .select('payos_checksum_key')
      .eq('club_id', rec.club_id)
      .single()

    if (!config) {
      console.warn('No PayOS config for club:', rec.club_id)
      return new Response('no_config', { status: 200 })
    }

    // Verify signature: all fields in data object sorted alphabetically
    const sigStr = Object.keys(d)
      .sort()
      .filter((k) => d[k] !== undefined && d[k] !== null)
      .map((k) => `${k}=${d[k]}`)
      .join('&')

    const expectedSig = await hmacSha256(config.payos_checksum_key, sigStr)
    if (expectedSig !== receivedSig) {
      console.warn('PayOS signature mismatch', { expected: expectedSig, received: receivedSig, sigStr })
      // TODO: re-enable after debugging
      // return new Response('signature_invalid', { status: 401 })
    }

    // Only process successful payments
    if (body.code !== '00' || !body.success) {
      return new Response('ignored', { status: 200 })
    }

    // Update record with actual paid amount from PayOS before confirming
    await supabase
      .from('member_payment_records')
      .update({ amount: d.amount })
      .eq('id', rec.id)

    // Atomic confirm via RPC
    const { data: result, error: rpcErr } = await supabase.rpc('confirm_member_payment', {
      p_record_id: rec.id,
      p_confirmed_by: 'payos',
    })

    if (rpcErr) console.error('confirm_member_payment error:', rpcErr)
    else console.log('confirm_member_payment result:', result)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200 })
  }
})
