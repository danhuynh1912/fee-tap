async function callCreatePayment(body, accessToken) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Fall back to anon key for anonymous callers (public pay page).
  // create-payment uses // no-verify-jwt so any valid project key is accepted.
  const token = accessToken || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error || 'Lỗi tạo QR')
  return json
}

// Single-member payment — stores QR on member_payment_records (original path).
export function createPaymentQR(recordId, amount, accessToken) {
  return callCreatePayment({ record_id: recordId, amount }, accessToken)
}

// Multi-member group payment — creates a payment_group + junction rows.
// amountPerRecord × recordIds.length = total charged to PayOS.
export function createGroupPaymentQR(recordIds, amountPerRecord, accessToken) {
  return callCreatePayment({ record_ids: recordIds, amount_per_record: amountPerRecord }, accessToken)
}
