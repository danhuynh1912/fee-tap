import { useMemo } from 'react'
import { Calendar, CalendarClock, Clock, Lock, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNextVote } from '../../../hooks/useNextVote'
import { useCountdown } from '../../../hooks/useCountdown'
import { fmtDate } from '../../../lib/utils'
import { Badge } from '../../ui/Badge'
import { AdminVoteForm } from './AdminVoteForm'
import { VotePanel } from './VotePanel'
import { ResultsPanel } from './ResultsPanel'

export function NextSessionVoteTab({ club, settings, members, canEdit, user, toast }) {
  const { t } = useTranslation()
  const { vote, responses, loading, reload } = useNextVote(club.id)
  const countdown = useCountdown(vote?.deadline)
  const closed = !!vote && (vote.is_closed || countdown.closed)

  const attendees = useMemo(() => responses.filter((r) => r.attending), [responses])
  const filledSlots = useMemo(
    () => attendees.reduce((sum, r) => sum + 1 + (r.guests || 0), 0),
    [attendees]
  )

  const myResponse = responses.find((r) => r.anonymous_user_id === user?.id)
  const userName = user?.user_metadata?.full_name || user?.email || ''

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Vote header — only when a vote exists */}
      {vote && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {closed
              ? <Badge tone="red" icon={Lock}>{t('vote_closed_label')}</Badge>
              : <Badge tone="cyan" icon={Clock}>{t('vote_closes_in')} {countdown.label}</Badge>}
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{vote.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
            {vote.match_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {fmtDate(vote.match_date)}
              </span>
            )}
            {vote.deadline && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" /> {t('vote_deadline_label')} {fmtDate(vote.deadline)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          {/* Admin form — always shown to admin (to create or manage) */}
          {canEdit && (
            <AdminVoteForm
              vote={vote}
              closed={closed}
              filledSlots={filledSlots}
              club={club}
              settings={settings}
              members={members}
              toast={toast}
              onChanged={reload}
            />
          )}

          {/* Vote panel — only when vote exists */}
          {vote && (
            <VotePanel
              vote={vote}
              closed={closed}
              filledSlots={filledSlots}
              myResponse={myResponse}
              userId={user?.id}
              userName={userName}
              toast={toast}
              onChanged={reload}
            />
          )}

          {/* Member empty state — no vote, not admin */}
          {!vote && !canEdit && (
            <div className="rounded-3xl border border-dashed border-slate-200 py-14 text-center">
              <Calendar className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-500">{t('vote_no_vote_member')}</p>
            </div>
          )}
        </div>

        {/* Results panel — only when vote exists */}
        {vote && (
          <div className="lg:col-span-3">
            <ResultsPanel
              vote={vote}
              attendees={attendees}
              responses={responses}
              filledSlots={filledSlots}
              meId={user?.id}
            />
          </div>
        )}
      </div>
    </div>
  )
}
