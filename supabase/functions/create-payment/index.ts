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

function buildDescription(memberNames: string[], periodStr: string): string {
  const shorts = memberNames.map((n) => n.split(' ').pop() || n)
  const joined = shorts.join('+')
  return `SPOFUND ${periodStr} ${joined}`.replace(/\s+/g, ' ').trim().slice(0, 25)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()

    // Normalize: accept record_ids[] (group) or legacy record_id (single)
    const recordIds: string[] = body.record_ids
      ? body.record_ids
      : body.record_id
      ? [body.record_id]
      : []

    if (!recordIds.length) {
      return new Response(JSON.stringify({ error: 'record_ids required' }), { status: 400, headers: CORS })
    }

    const isGroup = recordIds.length > 1
    const passedAmountPerRecord: number | undefined = body.amount_per_record ?? body.amount

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Load all records ─────────────────────────────────────────────────────
    const { data: records, error: recErr } = await supabase
      .from('member_payment_records')
      .select('*, club_members(name), payment_collections(title, period_start)')
      .in('id', recordIds)

    if (recErr || !records?.length) {
      return new Response(JSON.stringify({ error: 'records_not_found' }), { status: 404, headers: CORS })
    }

    // All records must belong to the same club + collection
    const clubId: string = records[0].club_id
    const collectionId: string = records[0].collection_id
    const allSameClub = records.every((r) => r.club_id === clubId)
    const allSameCollection = records.every((r) => r.collection_id === collectionId)
    if (!allSameClub || !allSameCollection) {
      return new Response(JSON.stringify({ error: 'records_must_share_club_and_collection' }), { status: 400, headers: CORS })
    }

    const amountPerRecord = passedAmountPerRecord ?? records[0].amount
    const totalAmount = amountPerRecord * records.length

    // ── Single-record idempotency (original path, no group) ──────────────────
    // For single payments that already have a cached QR on the record itself,
    // return the cached data if amount is unchanged. This preserves the existing
    // behaviour for non-group payments.
    if (!isGroup) {
      const rec = records[0]
      if (rec.payos_order_code && rec.payos_checkout_url && amountPerRecord === rec.amount) {
        return new Response(JSON.stringify({
          orderCode: rec.payos_order_code,
          checkoutUrl: rec.payos_checkout_url,
          qrCode: rec.payos_qr_code,
        }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }

    // ── Group idempotency: reuse an existing open group for these exact records ─
    // Only checked for multi-record groups (single still uses the record-level cache above).
    if (isGroup) {
      const { data: existingGroups } = await supabase
        .from('payment_groups')
        .select('id, total_amount, payos_order_code, payos_checkout_url, payos_qr_code, payment_group_members(record_id)')
        .eq('collection_id', collectionId)
        .eq('status', 'pending')

      const sortedNew = [...recordIds].sort()
      const existing = (existingGroups ?? []).find((g) => {
        if (g.total_amount !== totalAmount) return false
        const members = (g.payment_group_members as { record_id: string }[]).map((m) => m.record_id).sort()
        return JSON.stringify(members) === JSON.stringify(sortedNew)
      })
      if (existing?.payos_order_code && existing.payos_checkout_url) {
        return new Response(JSON.stringify({
          groupId: existing.id,
          orderCode: existing.payos_order_code,
          checkoutUrl: existing.payos_checkout_url,
          qrCode: existing.payos_qr_code,
        }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }

    // ── Load PayOS config + verify Pro plan ──────────────────────────────────
    const [{ data: payosConfig }, { data: clubRow }] = await Promise.all([
      supabase.from('club_payment_config').select('payos_client_id, payos_api_key, payos_checksum_key').eq('club_id', clubId).single(),
      supabase.from('clubs').select('plan').eq('id', clubId).single(),
    ])

    if (!payosConfig) {
      return new Response(
        JSON.stringify({ error: 'payos_not_configured', message: 'Club host chưa kết nối PayOS' }),
        { status: 422, headers: CORS }
      )
    }
    if (clubRow?.plan !== 'pro') {
      return new Response(
        JSON.stringify({ error: 'pro_required', message: 'Tính năng chỉ dành cho Pro plan' }),
        { status: 403, headers: CORS }
      )
    }

    const { payos_client_id: clientId, payos_api_key: apiKey, payos_checksum_key: checksumKey } = payosConfig
    const appUrl = Deno.env.get('APP_URL') || 'https://spofund.vercel.app'

    // ── Build description ────────────────────────────────────────────────────
    const memberNames = records.map((r) => (r.club_members as { name: string })?.name || 'Member')
    const periodStart: string = (records[0].payment_collections as { period_start: string })?.period_start || ''
    const periodStr = periodStart
      ? (() => { const d = new Date(periodStart); return `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}` })()
      : ''
    const description = buildDescription(memberNames, periodStr)

    // ── Create PayOS order ───────────────────────────────────────────────────
    const { data: seqData } = await supabase.rpc('next_payos_order_code')
    const orderCode: number = seqData as number

    const cancelUrl = `${appUrl}/club/${clubId}`
    const returnUrl = `${appUrl}/club/${clubId}`
    const sigData = `amount=${totalAmount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`
    const signature = await hmacSha256(checksumKey, sigData)

    const payosRes = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
      method: 'POST',
      headers: { 'x-client-id': clientId, 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderCode, amount: totalAmount, description, cancelUrl, returnUrl, signature }),
    })
    const payosJson = await payosRes.json()

    if (payosJson.code !== '00') {
      console.error('PayOS error:', payosJson)
      return new Response(JSON.stringify({ error: payosJson.desc || 'payos_error' }), { status: 502, headers: CORS })
    }

    const { checkoutUrl, qrCode, accountNumber, accountName, bin } = payosJson.data

    // ── Persist ──────────────────────────────────────────────────────────────
    if (isGroup) {
      // Group path: store on payment_groups + junction table
      const { data: group, error: groupErr } = await supabase
        .from('payment_groups')
        .insert({ club_id: clubId, collection_id: collectionId, payos_order_code: orderCode, payos_checkout_url: checkoutUrl, payos_qr_code: qrCode, total_amount: totalAmount })
        .select('id')
        .single()

      if (groupErr || !group) throw new Error('Failed to create payment_group')

      await supabase.from('payment_group_members').insert(
        recordIds.map((record_id) => ({ group_id: group.id, record_id }))
      )

      return new Response(JSON.stringify({ groupId: group.id, orderCode, checkoutUrl, qrCode, accountNumber, accountName, bin, description }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    } else {
      // Single path (legacy): store directly on member_payment_records
      if (amountPerRecord !== records[0].amount) {
        await supabase.from('member_payment_records').update({ amount: amountPerRecord, payos_order_code: null, payos_checkout_url: null, payos_qr_code: null }).eq('id', recordIds[0])
      }
      await supabase.from('member_payment_records').update({ payos_order_code: orderCode, payos_checkout_url: checkoutUrl, payos_qr_code: qrCode }).eq('id', recordIds[0])

      return new Response(JSON.stringify({ orderCode, checkoutUrl, qrCode, accountNumber, accountName, bin, description }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
