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
  // PayOS always POSTs JSON
  if (req.method !== 'POST') return new Response('ok', { status: 200 })

  try {
    const body = await req.json()
    const checksumKey = Deno.env.get('PAYOS_CHECKSUM_KEY')!

    // Verify PayOS signature
    // Signature covers: amount, code, desc, orderCode, reference, transactionDateTime
    const { data: d, signature: receivedSig } = body
    if (!d || !receivedSig) return new Response('bad_request', { status: 400 })

    const sigFields = ['amount', 'code', 'desc', 'orderCode', 'reference', 'transactionDateTime']
    const sigStr = sigFields
      .filter((k) => d[k] !== undefined && d[k] !== null)
      .map((k) => `${k}=${d[k]}`)
      .join('&')

    const expectedSig = await hmacSha256(checksumKey, sigStr)

    if (expectedSig !== receivedSig) {
      console.warn('PayOS signature mismatch', { expected: expectedSig, received: receivedSig })
      return new Response('signature_invalid', { status: 401 })
    }

    // Only process successful payments
    if (body.code !== '00' || !body.success) {
      return new Response('ignored', { status: 200 })
    }

    const orderCode: number = d.orderCode
    if (!orderCode) return new Response('no_order_code', { status: 200 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Find the payment record by order code
    const { data: rec } = await supabase
      .from('member_payment_records')
      .select('id, status')
      .eq('payos_order_code', orderCode)
      .maybeSingle()

    if (!rec) {
      // Unknown order code — log and ignore
      console.warn('Unknown PayOS order code:', orderCode)
      return new Response('unknown_order', { status: 200 })
    }

    // Atomic confirm via RPC (handles idempotency internally)
    const { data: result } = await supabase.rpc('confirm_member_payment', {
      p_record_id: rec.id,
      p_confirmed_by: 'payos_webhook',
    })

    console.log('confirm_member_payment result:', result)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    // Return 200 so PayOS doesn't retry — log the error instead
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200 })
  }
})
