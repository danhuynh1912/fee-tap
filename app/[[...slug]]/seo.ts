import type { Metadata } from 'next'
import { configured, serverDb } from '../_data/serverDb'

function vnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'
}

async function clubName(clubId: string): Promise<string | null> {
  if (!configured) return null
  try {
    const sb = serverDb()
    const { data } = await sb.from('clubs').select('name').eq('id', clubId).maybeSingle()
    return data?.name ?? null
  } catch {
    return null
  }
}

const VI_WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

/**
 * Returns a human-readable title for the latest active vote of a club.
 * - next_session / session → "Vote đánh buổi kế tiếp (Thứ X ngày DD/MM)"
 * - membership_cycle       → "Vote cố định tháng X" / "Vote cố định tháng X - tháng Y"
 */
async function latestVoteTitle(clubId: string, isCycle: boolean): Promise<string | null> {
  if (!configured) return null
  try {
    const sb = serverDb()
    const q = sb
      .from('votes')
      .select('vote_type, match_date, title')
      .eq('club_id', clubId)
      .eq('is_closed', false)
      .order('created_at', { ascending: false })
      .limit(1)

    if (isCycle) {
      q.eq('vote_type', 'membership_cycle')
    } else {
      q.or('vote_type.is.null,vote_type.eq.next_session,vote_type.eq.session')
    }

    const { data } = await q.maybeSingle()

    if (!data) return null
    const row = data as { vote_type: string | null; match_date: string | null; title: string | null }

    if (row.vote_type === 'membership_cycle') {
      // Title stored in DB is e.g. "Vote cố định — tháng 7 năm 2026"
      // Transform: remove the em-dash separator → "Vote cố định tháng 7 năm 2026"
      const cleaned = (row.title ?? '').replace(/\s*[—–-]+\s*/u, ' ').trim()
      return cleaned || 'Vote cố định'
    }

    // next_session / session / null (legacy)
    if (row.match_date) {
      // Use UTC+7 offset so the weekday/day matches Vietnam local time
      const d = new Date(new Date(row.match_date).getTime() + 7 * 60 * 60 * 1000)
      const weekday = VI_WEEKDAYS[d.getUTCDay()]
      const day = String(d.getUTCDate()).padStart(2, '0')
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      return `Vote đánh buổi kế tiếp (${weekday} ngày ${day}/${month})`
    }

    return null
  } catch {
    return null
  }
}

/**
 * Returns "Đóng tiền tháng X năm XXXX" or "Đóng tiền tháng X - tháng Y năm XXXX"
 * by joining the collection's period_start with the club's billing_cycle.
 */
async function paymentPeriodTitle(clubId: string, collectionId?: string): Promise<string | null> {
  if (!configured || !collectionId) return null
  try {
    const sb = serverDb()
    const [{ data: col }, { data: settings }] = await Promise.all([
      sb.from('payment_collections').select('period_start').eq('id', collectionId).maybeSingle(),
      sb.from('club_settings').select('billing_cycle').eq('club_id', clubId).maybeSingle(),
    ])

    const periodStart = (col as { period_start?: string } | null)?.period_start
    if (!periodStart) return null

    // period_start is "YYYY-MM-DD" in UTC — parse as local-midnight to avoid date shift
    const [y, m] = periodStart.split('-').map(Number)
    const startMonth = m   // 1-based
    const year = y

    const billingCycle = (settings as { billing_cycle?: string } | null)?.billing_cycle ?? 'month'
    const isQuarter = billingCycle === 'quarter'

    if (isQuarter) {
      const endMonth = startMonth + 2  // quarter = 3 months
      return `Đóng tiền tháng ${startMonth} - tháng ${endMonth} năm ${year}`
    }

    return `Đóng tiền tháng ${startMonth} năm ${year}`
  } catch {
    return null
  }
}

/**
 * Build per-route Open Graph metadata for the share-critical pages so social
 * crawlers (Zalo / Facebook / Telegram — none run JS) see real titles.
 * Falls back to the default site metadata for everything else (handled by the
 * root layout). Returns `null` when the slug needs no override.
 */
type SearchParams = { [key: string]: string | string[] | undefined }

export async function metadataForSlug(slug: string[], searchParams?: SearchParams): Promise<Metadata | null> {
  // /join/:id — invitation link
  if (slug[0] === 'join' && slug[1]) {
    const name = await clubName(slug[1])
    const title = name ? `Tham gia ${name} trên SPOFUND` : 'Lời mời tham gia câu lạc bộ — SPOFUND'
    const description = name
      ? `Bạn được mời tham gia câu lạc bộ ${name}. Theo dõi quỹ, dự báo chi phí sân & cầu minh bạch.`
      : 'Tham gia câu lạc bộ thể thao của bạn trên SPOFUND.'
    return {
      title,
      description,
      openGraph: { title, description, type: 'website' },
      twitter: { card: 'summary_large_image', title, description },
    }
  }

  // /club/:id/pay/:collectionId — payment link
  if (slug[0] === 'club' && slug[2] === 'pay' && slug[1]) {
    const [name, payTitle] = await Promise.all([
      clubName(slug[1]),
      paymentPeriodTitle(slug[1], slug[3]),
    ])
    const title = payTitle
      ? `${payTitle}${name ? ` — ${name}` : ''}`
      : name
        ? `Đóng quỹ ${name}`
        : 'Đóng quỹ câu lạc bộ'
    const description = name
      ? `Thanh toán phần đóng góp của bạn cho câu lạc bộ ${name} qua SPOFUND.`
      : 'Thanh toán phần đóng góp quỹ câu lạc bộ qua SPOFUND.'
    return {
      title,
      description,
      openGraph: { title, description, type: 'website' },
      twitter: { card: 'summary_large_image', title, description },
    }
  }

  // /club/:id/vote — public vote link
  if (slug[0] === 'club' && slug[2] === 'vote' && slug[1]) {
    const isCycleTab = searchParams?.tab === 'cycle'
    const [name, voteTitle] = await Promise.all([
      clubName(slug[1]),
      latestVoteTitle(slug[1], isCycleTab),
    ])
    const clubPart = name ? ` — ${name}` : ''
    const title = voteTitle
      ? `${voteTitle}${clubPart}`
      : name
        ? `Chốt lịch ${name} — SPOFUND`
        : 'Bình chọn lịch chơi — SPOFUND'
    const description = name
      ? `Bình chọn buổi chơi sắp tới cho câu lạc bộ ${name}.`
      : 'Bình chọn buổi chơi sắp tới cho câu lạc bộ của bạn.'
    return {
      title,
      description,
      openGraph: { title, description, type: 'website' },
      twitter: { card: 'summary_large_image', title, description },
    }
  }

  return null
}
