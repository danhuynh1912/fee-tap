export async function createPaymentQR(recordId, amount, accessToken) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  // Fall back to anon key for anonymous callers (public pay page).
  // create-payment uses // no-verify-jwt so any valid project key is accepted.
  const token = accessToken || import.meta.env.VITE_SUPABASE_ANON_KEY
  const res = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ record_id: recordId, amount }),
  })
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error || 'Lỗi tạo QR')
  return json
}
