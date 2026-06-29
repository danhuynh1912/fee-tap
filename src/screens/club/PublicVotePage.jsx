import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Vote, Users, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cx } from '../../lib/utils'
import { NextSessionVoteTab } from '../../components/club/vote/NextSessionVoteTab'
import { CycleVoteTab } from '../../components/club/vote/CycleVoteTab'
import { Toast } from '../../components/ui/Toast'

function usePublicVoteData(clubId) {
  const [club, setClub] = useState(null)
  const [members, setMembers] = useState([])
  const [settings, setSettings] = useState(null)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clubId) return
    const [{ data: clubRow }, { data: memberRows }, { data: settingsRow }, { data: slotRows }] = await Promise.all([
      supabase.from('clubs').select('id, name, sport_type, owner_id').eq('id', clubId).single(),
      supabase.from('club_members').select('id, name, user_id').eq('club_id', clubId).order('name'),
      supabase.from('club_settings').select('*').eq('club_id', clubId).single(),
      supabase.from('court_slots').select('*').eq('club_id', clubId),
    ])
    setClub(clubRow ?? null)
    setMembers(memberRows ?? [])
    setSettings(settingsRow ?? null)
    setSlots(slotRows ?? [])
    setLoading(false)
  }, [clubId])

  useEffect(() => { load() }, [load])

  return { club, members, settings, slots, loading }
}

const STORAGE_KEY = (clubId) => `vote-identity-${clubId}`

export function PublicVotePage({ clubId }) {
  const { t } = useTranslation()
  const { club, members, settings, slots, loading } = usePublicVoteData(clubId)
  const [toastMsg, setToastMsg] = useState(null)
  const toastRef = useState(null)

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastRef[0])
    toastRef[0] = setTimeout(() => setToastMsg(null), 2600)
  }, [toastRef])

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') === 'cycle' ? 'cycle' : 'vote'
  })

  const [selectedId, setSelectedId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY(clubId)) ?? '' } catch { return '' }
  })

  function handleSelect(memberId) {
    setSelectedId(memberId)
    try { localStorage.setItem(STORAGE_KEY(clubId), memberId) } catch { /* ignore */ }
  }

  const selectedMember = members.find((m) => m.id === selectedId) ?? null

  // Prefer user_id (auth UUID) so public votes share identity with authenticated votes.
  // Fall back to club_members.id for manually-added members with no auth account.
  const syntheticUser = selectedMember
    ? { id: selectedMember.user_id || selectedMember.id, user_metadata: { full_name: selectedMember.name } }
    : null

  const pickerProps = { members, selectedId, onSelect: handleSelect }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!club) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/50">
        <p className="text-slate-500">{t('vote_public_club_not_found')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50 text-slate-900 antialiased">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1150px] items-center px-4">
          <span className="text-sm font-black tracking-tight text-slate-900">SPOFUND</span>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-600">{club.name}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1150px] flex-1 px-4 py-6 space-y-4">
        {/* Tab switcher */}
        <div className="flex gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-1">
          <button
            onClick={() => setActiveTab('vote')}
            className={cx(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
              activeTab === 'vote' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Vote className="hidden sm:block h-4 w-4" />
            {t('tab_next_vote')}
          </button>
          <button
            onClick={() => setActiveTab('cycle')}
            className={cx(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
              activeTab === 'cycle' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Users className="hidden sm:block h-4 w-4" />
            {t('tab_cycle_vote')}
          </button>
        </div>

        {activeTab === 'vote' && (
          <NextSessionVoteTab
            club={club}
            settings={settings}
            members={members}
            canEdit={false}
            user={syntheticUser}
            toast={toast}
            pickerProps={pickerProps}
          />
        )}

        {activeTab === 'cycle' && (
          <CycleVoteTab
            club={club}
            members={members}
            settings={settings}
            slots={slots}
            canEdit={false}
            user={syntheticUser}
            toast={toast}
            upcomingFeeInfo={null}
            pickerProps={pickerProps}
          />
        )}
      </main>

      <Toast toast={toastMsg} />
    </div>
  )
}
