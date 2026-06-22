// no-verify-jwt
//
// Receives ALL updates from Telegram for the global bot.
//
// Register this webhook with Telegram once:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
//     -d "url=https://<project>.supabase.co/functions/v1/telegram-bot-webhook" \
//     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
//
// Required env vars (set via `supabase secrets set`):
//   TELEGRAM_BOT_TOKEN       — from BotFather
//   TELEGRAM_WEBHOOK_SECRET  — random string you chose when calling setWebhook
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN      = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`

// ---------- types (minimal) ----------

interface TgUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface TgMessage {
  chat: { id: number; type: string }
  from?: TgUser
  text?: string
}

interface TgUpdate {
  update_id: number
  message?: TgMessage
}

// ---------- helpers ----------

async function sendMessage(chatId: number, text: string) {
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

function displayName(user: TgUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ')
}

// ---------- handlers ----------

async function handleLinkCommand(msg: TgMessage, supabase: ReturnType<typeof createClient>) {
  const from = msg.from!
  const chatId = msg.chat.id
  const name   = displayName(from)

  // Only allow linking via private DM (not in groups)
  if (msg.chat.type !== 'private') {
    await sendMessage(chatId, 'Vui lòng nhắn lệnh /link cho bot qua tin nhắn riêng.')
    return
  }

  // Generate a short human-readable code: "A3F-9K2"
  const part = () => Math.random().toString(36).slice(2, 5).toUpperCase()
  const token = `${part()}-${part()}`

  const { error } = await supabase.from('link_tokens').insert({
    token,
    telegram_id:   from.id,
    telegram_name: name,
    // expires_at defaults to now() + 10 minutes in DB
  })

  if (error) {
    console.error('Failed to create link token:', error)
    await sendMessage(chatId, 'Có lỗi xảy ra, vui lòng thử lại.')
    return
  }

  await sendMessage(chatId,
    `👋 Xin chào <b>${name}</b>!\n\n` +
    `Mã kết nối của bạn:\n\n` +
    `<code>${token}</code>\n\n` +
    `Nhập mã này vào trang Settings → Telegram trong ứng dụng FeeTap.\n` +
    `⏰ Mã hết hạn sau <b>10 phút</b>.`
  )
}

async function handleStart(msg: TgMessage) {
  if (msg.chat.type !== 'private') return

  await sendMessage(msg.chat.id,
    `👋 Xin chào!\n\n` +
    `Bot này phục vụ nhóm câu lạc bộ thể thao FeeTap.\n\n` +
    `Để kết nối tài khoản, gửi lệnh:\n<code>/link</code>`
  )
}

// ---------- main ----------

serve(async (req) => {
  // 1. Verify request is genuinely from Telegram
  //    Telegram sends the secret_token you set in setWebhook as this header
  const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token')
  if (!incomingSecret || incomingSecret !== WEBHOOK_SECRET) {
    // Return 200 to avoid Telegram retrying (but log for ops visibility)
    console.warn('Rejected webhook: bad or missing secret token')
    return new Response('ok', { status: 200 })
  }

  if (req.method !== 'POST') return new Response('ok', { status: 200 })

  let update: TgUpdate
  try {
    update = await req.json()
  } catch {
    return new Response('bad_json', { status: 400 })
  }

  const msg = update.message
  if (!msg || !msg.from) return new Response('ok', { status: 200 })

  const text = (msg.text ?? '').trim()

  // Route commands
  if (text === '/start' || text.startsWith('/start ')) {
    await handleStart(msg)
  } else if (text === '/link') {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    await handleLinkCommand(msg, supabase)
  }
  // Future: handle /unlink, callback_query for vote actions, etc.

  return new Response('ok', { status: 200 })
})
