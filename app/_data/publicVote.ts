import { configured, serverDb } from './serverDb'

export type VoteClub = { id: string; name: string; sport_type: string; owner_id: string }
export type VoteMember = { id: string; name: string; user_id: string | null }
export type VoteSettings = Record<string, unknown>
export type VoteSlot = Record<string, unknown>

export type VotePageData = {
  club: VoteClub | null
  members: VoteMember[]
  settings: VoteSettings | null
  slots: VoteSlot[]
}

export async function fetchVotePageData(clubId: string): Promise<VotePageData> {
  if (!configured) return { club: null, members: [], settings: null, slots: [] }
  try {
    const db = serverDb()
    const [{ data: club }, { data: members }, { data: settings }, { data: slots }] = await Promise.all([
      db.from('clubs').select('id, name, sport_type, owner_id').eq('id', clubId).single(),
      db.from('club_members').select('id, name, user_id').eq('club_id', clubId).order('name'),
      db.from('club_settings').select('*').eq('club_id', clubId).single(),
      db.from('court_slots').select('*').eq('club_id', clubId),
    ])
    return {
      club: (club as VoteClub) ?? null,
      members: (members as VoteMember[]) ?? [],
      settings: (settings as VoteSettings) ?? null,
      slots: (slots as VoteSlot[]) ?? [],
    }
  } catch {
    return { club: null, members: [], settings: null, slots: [] }
  }
}
