import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Vote, Users, Link } from 'lucide-react'
import { cx, num } from '../../lib/utils'
import { useClub } from '../../contexts/ClubContext'
import { NextSessionVoteTab } from '../../components/club/vote/NextSessionVoteTab'
import { CycleVoteTab } from '../../components/club/vote/CycleVoteTab'
import { computePaymentTimeline, formatPeriodLabel, periodDateRange } from '../../engine/forecast'

export function VotePage({ toast }) {
  const { club, settings, slots, members, sport, canEdit, session, pollTally } = useClub()
  const { t, i18n } = useTranslation()
  const user = session?.user

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'cycle') return 'cycle'
    return 'vote'
  })

  const memberCount = members?.length || 0

  const upcomingFeeInfo = useMemo(() => {
    if (!slots?.length || !settings) return null
    const sportHasEquipment = sport?.hasEquipment ?? true
    const timeline = computePaymentTimeline(slots, { ...settings, _hasEquipment: sportHasEquipment }, memberCount)
    const nextShuttleItem = timeline.upcomingShuttleItems?.[0] ?? null
    if (!timeline.upcoming?.length && !nextShuttleItem) return null

    const monthKey = (d) => (d ? `${d.getFullYear()}-${d.getMonth()}` : 'no-deadline')
    const groups = new Map()
    const getOrCreate = (deadline, daysUntil) => {
      const key = monthKey(deadline)
      if (!groups.has(key)) groups.set(key, { deadline, daysUntil, courtItems: [], shuttleItem: null })
      return groups.get(key)
    }
    if (nextShuttleItem) {
      const g = getOrCreate(nextShuttleItem.deadline, nextShuttleItem.daysUntil)
      g.shuttleItem = nextShuttleItem
    }
    for (const r of timeline.upcoming) {
      getOrCreate(r.nextDeadline, r.daysUntilNext).courtItems.push(r)
    }
    const sorted = [...groups.values()].sort((a, b) => {
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline - b.deadline
    })
    const first = sorted[0]
    if (!first) return null

    const courtCost = first.courtItems.reduce((s, r) => s + r.nextCourtCost, 0)
    const shuttleCost = first.shuttleItem?.cost ?? 0
    const total = courtCost + shuttleCost

    const period = first.courtItems[0]?.nextPeriod || first.shuttleItem?.period
    const ps = period ? periodDateRange(period).start : null
    const matchesVotePeriod = (() => {
      if (!ps || !pollTally?.cyclePeriodStart) return false
      const d = new Date(ps)
      const start = new Date(pollTally.cyclePeriodStart)
      const end = pollTally.cyclePeriodEnd ? new Date(pollTally.cyclePeriodEnd) : start
      return d >= start && d <= end
    })()
    const hasCommitted = matchesVotePeriod && pollTally?.count != null && pollTally.count > 0
    const effectiveCount = hasCommitted ? pollTally.count : timeline.effectiveMemberCount

    const perMember = effectiveCount > 0 ? Math.ceil(total / effectiveCount) : 0
    const periodSource = first.courtItems[0]?.nextPeriod ?? first.shuttleItem?.period ?? null
    const periodLabel = periodSource ? formatPeriodLabel(periodSource, i18n.language) : ''
    return { perMember, periodLabel, deadline: first.deadline, hasCommitted }
  }, [slots, settings, memberCount, sport, i18n.language, pollTally])

  return (
    <div className="mx-auto max-w-[1150px] space-y-4">
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
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/club/${club.id}/vote`
                  navigator.clipboard.writeText(url)
                  toast?.(t('vote_link_copied'))
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition active:scale-[0.98]"
              >
                <Link className="h-3.5 w-3.5" />
                {t('vote_copy_link')}
              </button>
            </div>
          )}
          <NextSessionVoteTab club={club} settings={settings} members={members} canEdit={canEdit} user={user} toast={toast} />
        </div>
      )}

      {activeTab === 'cycle' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/club/${club.id}/vote?tab=cycle`
                  navigator.clipboard.writeText(url)
                  toast?.(t('vote_link_copied'))
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition active:scale-[0.98]"
              >
                <Link className="h-3.5 w-3.5" />
                {t('cycle_vote_copy_link')}
              </button>
            </div>
          )}
          <CycleVoteTab
            club={club}
            members={members}
            settings={settings}
            slots={slots}
            canEdit={canEdit}
            user={user}
            toast={toast}
            upcomingFeeInfo={upcomingFeeInfo}
          />
        </div>
      )}
    </div>
  )
}
