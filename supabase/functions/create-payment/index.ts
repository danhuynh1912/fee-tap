import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { record_id, amount: passedAmount } = await req.json()
    if (!record_id) return new Response(JSON.stringify({ error: 'record_id required' }), { status: 400, headers: CORS })

    // Service role: bypasses RLS to read club_payment_config + member info
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Load payment record + member name
    const { data: rec, error: recErr } = await supabase
      .from('member_payment_records')
      .select('*, club_members(name), payment_collections(title, period_start)')
      .eq('id', record_id)
      .single()

    if (recErr || !rec) {
      return new Response(JSON.stringify({ error: 'record_not_found' }), { status: 404, headers: CORS })
    }

    const amount = passedAmount ?? rec.amount

    // Idempotency: return cached order only if amount hasn't changed
    if (rec.payos_order_code && rec.payos_checkout_url && amount === rec.amount) {
      return new Response(JSON.stringify({
        orderCode: rec.payos_order_code,
        checkoutUrl: rec.payos_checkout_url,
        qrCode: rec.payos_qr_code,
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Load the club's PayOS config (per-club keys for multi-tenant)
    const { data: payosConfig, error: configErr } = await supabase
      .from('club_payment_config')
      .select('payos_client_id, payos_api_key, payos_checksum_key')
      .eq('club_id', rec.club_id)
      .single()

    if (configErr || !payosConfig) {
      return new Response(
        JSON.stringify({ error: 'payos_not_configured', message: 'Club host chưa kết nối PayOS' }),
        { status: 422, headers: CORS }
      )
    }

    // Check club is Pro (only Pro can use payments)
    const { data: clubRow } = await supabase
      .from('clubs')
      .select('plan')
      .eq('id', rec.club_id)
      .single()

    if (clubRow?.plan !== 'pro') {
      return new Response(
        JSON.stringify({ error: 'pro_required', message: 'Tính năng chỉ dành cho Pro plan' }),
        { status: 403, headers: CORS }
      )
    }

    const { payos_client_id: clientId, payos_api_key: apiKey, payos_checksum_key: checksumKey } = payosConfig
    const appUrl = Deno.env.get('APP_URL') || 'https://spofund.vercel.app'

    // Get next unique order code from DB sequence
    const { data: seqData } = await supabase.rpc('next_payos_order_code')
    const orderCode: number = seqData as number

    // Description max 25 chars (visible in bank transfer note)
    const memberName: string = (rec.club_members as { name: string })?.name || 'Member'
    const shortName = memberName.split(' ').pop() || memberName
    const periodStart: string = (rec.payment_collections as { period_start: string })?.period_start || ''
    const periodStr = periodStart
      ? (() => { const d = new Date(periodStart); return `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}` })()
      : ''
    const description = `SPOFUND ${periodStr} ${shortName}`.replace(/\s+/g, ' ').trim().slice(0, 25)

    const cancelUrl = `${appUrl}/club/${rec.club_id}`
    const returnUrl = `${appUrl}/club/${rec.club_id}`

    // PayOS signature: sorted key=value pairs joined by &
    const sigData = `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`
    const signature = await hmacSha256(checksumKey, sigData)

    const payload = { orderCode, amount, description, cancelUrl, returnUrl, signature }

    const payosRes = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
      method: 'POST',
      headers: {
        'x-client-id': clientId,
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const payosJson = await payosRes.json()

    if (payosJson.code !== '00') {
      console.error('PayOS error:', payosJson)
      return new Response(JSON.stringify({ error: payosJson.desc || 'payos_error' }), { status: 502, headers: CORS })
    }

    const { checkoutUrl, qrCode } = payosJson.data

    // Persist order info to DB
    await supabase.from('member_payment_records').update({
      payos_order_code: orderCode,
      payos_checkout_url: checkoutUrl,
      payos_qr_code: qrCode,
    }).eq('id', record_id)

    return new Response(JSON.stringify({ orderCode, checkoutUrl, qrCode }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
