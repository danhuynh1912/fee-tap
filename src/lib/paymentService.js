export async function createPaymentQR(recordId, amount, accessToken) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const res = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ record_id: recordId, amount }),
  })
  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error || 'Lỗi tạo QR')
  return json
}
