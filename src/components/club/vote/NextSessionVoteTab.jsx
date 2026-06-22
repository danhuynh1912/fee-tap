import { useMemo } from 'react'
import { Calendar, CalendarClock, Clock, Lock, Loader2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNextVote } from '../../../hooks/useNextVote'
import { useCountdown } from '../../../hooks/useCountdown'
import { fmtDate } from '../../../lib/utils'
import { Badge } from '../../ui/Badge'
import { AdminVoteForm } from './AdminVoteForm'
import { VotePanel } from './VotePanel'
import { ResultsPanel } from './ResultsPanel'
import { ProxyVotePanel } from './ProxyVotePanel'

export function NextSessionVoteTab({ club, settings, members, canEdit, user, toast, pickerProps }) {
  const { t } = useTranslation()
  const { vote, previousVote, previousCount, responses, loading, reload } = useNextVote(club.id)
  const countdown = useCountdown(vote?.deadline)
  const closed = !!vote && (vote.is_closed || countdown.closed)

  // Session is in the past when match_date has already passed
  const sessionPast = !!vote && closed && vote.match_date && new Date(vote.match_date) < new Date()

  const memberAvatarMap = useMemo(() => {
    const map = Object.fromEntries((members || []).filter((m) => m.user_id).map((m) => [m.user_id, m.avatar_url]))
    if (club?.owner_id && club?.owner?.avatar_url) {
      map[club.owner_id] = club.owner.avatar_url
    }
    return map
  }, [members, club])

  const attendees = useMemo(
    () =>
      responses
        .filter((r) => r.attending)
        .map((r) => ({
          ...r,
          avatar_url: r.anonymous_user_id === user?.id ? user?.user_metadata?.avatar_url || null : memberAvatarMap[r.anonymous_user_id] || null,
        })),
    [responses, memberAvatarMap, user]
  )
  const filledSlots = useMemo(() => attendees.reduce((sum, r) => sum + 1 + (r.guests || 0), 0), [attendees])

  const myResponse = responses.find((r) => r.anonymous_user_id === user?.id)
  const userName = user?.user_metadata?.full_name || user?.email || ''

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  // When session is past, treat as if there's no active vote for the main UI
  const effectiveVote = sessionPast ? null : vote
  const effectiveClosed = sessionPast ? false : closed

  // ── Normal view ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Minimal recap card — shown when last vote's session has already passed */}
      {sessionPast && (
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200">
            <Lock className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('vote_last_result_label')}</p>
            <p className="truncate text-sm font-bold text-slate-700">{vote.title}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-500">
              {vote.match_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {fmtDate(vote.match_date)}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {filledSlots}/{vote.max_slots} {t('vote_previous_attendees')}
              </span>
            </div>
          </div>
          <Badge tone="slate" icon={Lock} className="shrink-0">
            {t('vote_closed_label')}
          </Badge>
        </div>
      )}

      {/* Previous vote recap pill */}
      {previousVote && !sessionPast && (
        <div className="flex justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            {t('vote_previous_label')}: {fmtDate(previousVote.match_date)} · {previousCount} {t('vote_previous_attendees')}
          </span>
        </div>
      )}

      {/* Vote header */}
      {effectiveVote && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {effectiveClosed ? (
              <Badge tone="red" icon={Lock}>
                {t('vote_closed_label')}
              </Badge>
            ) : (
              <Badge tone="cyan" icon={Clock}>
                {t('vote_closes_in')} {countdown.label}
              </Badge>
            )}
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{effectiveVote.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
            {effectiveVote.match_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {fmtDate(effectiveVote.match_date)}
              </span>
            )}
            {effectiveVote.deadline && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" /> {t('vote_deadline_label')} {fmtDate(effectiveVote.deadline)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="sm:grid gap-6 sm:space-y-0 space-y-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          {canEdit && (
            <AdminVoteForm
              vote={effectiveVote}
              closed={effectiveClosed}
              filledSlots={filledSlots}
              club={club}
              settings={settings}
              members={members}
              toast={toast}
              onChanged={reload}
            />
          )}

          {effectiveVote && (
            <VotePanel
              vote={effectiveVote}
              closed={effectiveClosed}
              filledSlots={filledSlots}
              myResponse={myResponse}
              userId={user?.id}
              userName={userName}
              toast={toast}
              onChanged={reload}
              pickerProps={pickerProps}
            />
          )}

          {effectiveVote && !effectiveClosed && user?.id && (
            <ProxyVotePanel
              vote={effectiveVote}
              members={members}
              responses={responses}
              userId={user?.id}
              toast={toast}
              onChanged={reload}
            />
          )}

          {!effectiveVote && !canEdit && (
            <div className="rounded-3xl border border-dashed border-slate-200 py-14 text-center">
              <Calendar className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-500">{t('vote_no_vote_member')}</p>
            </div>
          )}
        </div>

        {effectiveVote && (
          <div className="lg:col-span-3">
            <ResultsPanel vote={effectiveVote} attendees={attendees} responses={responses} filledSlots={filledSlots} meId={user?.id} />
          </div>
        )}
      </div>
    </div>
  )
}
