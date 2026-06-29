import { configured, serverDb } from './serverDb'

export type PayClub = { id: string; name: string; sport_type: string }
export type PayMember = { id: string; name: string; user_id: string | null }
export type PayCollection = Record<string, unknown>
export type PayRecord = Record<string, unknown>
export type PaySettings = Record<string, unknown>
export type PaySlot = Record<string, unknown>

export type PollTallyData = {
  count: number
  source: 'poll'
  voteId: string
  cyclePeriodStart: string | null
  cyclePeriodEnd: string | null
  // committedUserIds omitted — not needed in PublicPayPage, not serializable as Set
}

export type PayPageData = {
  club: PayClub | null
  collection: PayCollection | null
  members: PayMember[]
  payments: PayRecord[]
  settings: PaySettings | null
  slots: PaySlot[]
  pollTally: PollTallyData | null
  notFound: boolean
}

export async function fetchPayPageData(clubId: string, collectionId: string): Promise<PayPageData> {
  const empty: PayPageData = {
    club: null, collection: null, members: [], payments: [],
    settings: null, slots: [], pollTally: null, notFound: false,
  }
  if (!configured) return empty
  try {
    const db = serverDb()
    const [
      { data: club },
      { data: collection },
      { data: members },
      { data: payments },
      { data: settings },
      { data: slots },
    ] = await Promise.all([
      db.from('clubs').select('id, name, sport_type').eq('id', clubId).single(),
      db.from('payment_collections').select('*').eq('id', collectionId).eq('club_id', clubId).single(),
      db.from('club_members').select('id, name, user_id').eq('club_id', clubId).order('name'),
      db.from('member_payment_records').select('*').eq('collection_id', collectionId),
      db.from('club_settings').select('*').eq('club_id', clubId).single(),
      db.from('court_slots').select('*').eq('club_id', clubId),
    ])

    const col = collection as PayCollection | null
    const notFound = !col || (col as { status?: string }).status !== 'open'

    // Poll tally — two sequential queries (need vote id first)
    let pollTally: PollTallyData | null = null
    const { data: voteRows } = await db
      .from('votes')
      .select('id, cycle_period_start, cycle_period_end')
      .eq('club_id', clubId)
      .eq('vote_type', 'membership_cycle')
      .order('created_at', { ascending: false })
      .limit(1)

    if (voteRows?.length) {
      const vote = voteRows[0] as { id: string; cycle_period_start: string | null; cycle_period_end: string | null }
      const { data: responses } = await db
        .from('responses')
        .select('attending')
        .eq('vote_id', vote.id)
      const attendingCount = (responses ?? []).filter((r: { attending: boolean }) => r.attending).length
      pollTally = {
        count: attendingCount,
        source: 'poll',
        voteId: vote.id,
        cyclePeriodStart: vote.cycle_period_start,
        cyclePeriodEnd: vote.cycle_period_end,
      }
    }

    return {
      club: (club as PayClub) ?? null,
      collection: notFound ? null : col,
      members: (members as PayMember[]) ?? [],
      payments: (payments as PayRecord[]) ?? [],
      settings: (settings as PaySettings) ?? null,
      slots: (slots as PaySlot[]) ?? [],
      pollTally,
      notFound,
    }
  } catch {
    return empty
  }
}
