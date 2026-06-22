// no-verify-jwt
//
// Triggered by a pg_net trigger on INSERT on public.votes.
// The trigger sends Authorization: Bearer <service_role_key> — no custom secret needed.
//
// Required env vars (set via `supabase secrets set`):
//   TELEGRAM_BOT_TOKEN    — from BotFather
//   TELEGRAM_MINI_APP_URL — e.g. https://fee-tap.vercel.app

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN    = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const MINI_APP_URL = Deno.env.get('TELEGRAM_MINI_APP_URL')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`

// ---------- helpers ----------

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

function fmtDeadline(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

async function sendMessage(chatId: bigint, text: string, replyMarkup: unknown) {
  const res = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:      chatId.toString(),
      text,
      parse_mode:   'HTML',
      reply_markup: replyMarkup,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telegram sendMessage failed: ${err}`)
  }
  return res.json()
}

// ---------- main ----------

serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 })

  let body: { type: string; record: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return new Response('bad_json', { status: 400 })
  }

  // Only act on INSERT events
  if (body.type !== 'INSERT') return new Response('ignored', { status: 200 })

  const vote = body.record
  const clubId = vote.club_id as string | null

  if (!clubId) return new Response('no_club_id', { status: 200 })

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // 2. Check if this club has a Telegram group configured
  const { data: config } = await supabase
    .from('telegram_club_configs')
    .select('group_chat_id')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .maybeSingle()

  if (!config) {
    console.log(`No active Telegram config for club ${clubId} — skipping`)
    return new Response('no_config', { status: 200 })
  }

  // 3. Fetch club name for a nicer message
  const { data: club } = await supabase
    .from('clubs')
    .select('name')
    .eq('id', clubId)
    .maybeSingle()

  const clubName  = club?.name ?? 'CLB'
  const voteId    = vote.id as string
  const title     = vote.title as string
  const matchDate = vote.match_date as string | null
  const deadline  = vote.deadline as string

  // 4. Build the message
  const text = [
    `🏸 <b>${clubName}</b> — Vote buổi tới`,
    ``,
    `📋 <b>${title}</b>`,
    matchDate ? `📅 Ngày chơi: <b>${fmtDate(matchDate)}</b>` : null,
    `⏰ Deadline: <b>${fmtDeadline(deadline)}</b>`,
    ``,
    `Bấm nút bên dưới để vote ↓`,
  ].filter(Boolean).join('\n')

  // 5. Inline keyboard: single "Open Mini App" button
  const miniAppUrl = `${MINI_APP_URL}/tg/vote/${voteId}`
  const replyMarkup = {
    inline_keyboard: [[
      { text: '🗳️ Mở vote', web_app: { url: miniAppUrl } },
    ]],
  }

  try {
    await sendMessage(config.group_chat_id, text, replyMarkup)
    console.log(`Sent vote card for ${voteId} to chat ${config.group_chat_id}`)
  } catch (err) {
    console.error('Failed to send Telegram message:', err)
    // Return 200 so DB webhook doesn't keep retrying (transient Telegram errors)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200 })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
