import { useMemo } from 'react'
import { Calendar, CalendarClock, Clock, Lock, Loader2, Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCycleVote } from '../../../hooks/useCycleVote'
import { useCountdown } from '../../../hooks/useCountdown'
import { cx, fmtDate, fmtVND } from '../../../lib/utils'
import { computeMembershipVoteCycle } from '../../../engine/forecast'
import { Badge } from '../../ui/Badge'
import { AdminCycleVoteForm } from './AdminCycleVoteForm'
import { VotePanel } from './VotePanel'
import { CycleResultsPanel } from './CycleResultsPanel'
import { ProxyVotePanel } from './ProxyVotePanel'

export function CycleVoteTab({ club, members, settings, slots, canEdit, user, toast, upcomingFeeInfo, pickerProps }) {
  const { t, i18n } = useTranslation()
  const { vote, responses, loading, reload } = useCycleVote(club.id)
  const countdown = useCountdown(vote?.deadline)
  const closed = !!vote && (vote.is_closed || countdown.closed)

  const { minMonths } = useMemo(() => computeMembershipVoteCycle(slots, settings), [slots, settings])
  const fixedCycleMonths = settings?.fixed_cycle_months ?? minMonths

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
      {/* Upcoming fee info card */}
      {upcomingFeeInfo && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100">
              <Coins className="h-5 w-5 text-slate-500" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('upcoming_fee_label')}</p>
              <p className="text-sm text-slate-700 mt-0.5">{upcomingFeeInfo.periodLabel}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={cx('font-mono text-2xl font-black', upcomingFeeInfo.hasCommitted ? 'text-slate-900' : 'text-yellow-500')}>
              {fmtVND(upcomingFeeInfo.perMember)}
            </p>
            <p className="text-xs text-slate-400">{t('timeline_per_member')}</p>
            {!upcomingFeeInfo.hasCommitted && (
              <p className="text-[10px] text-yellow-500 mt-0.5">{t('no_cycle_committed')}</p>
            )}
          </div>
        </div>
      )}

      {/* Vote header */}
      {vote && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {closed ? (
              <Badge tone="red" icon={Lock}>{t('vote_closed_label')}</Badge>
            ) : (
              <Badge tone="cyan" icon={Clock}>{t('vote_closes_in')} {countdown.label}</Badge>
            )}
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{vote.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
            {vote.cycle_period_start && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {fmtDate(vote.cycle_period_start)} – {fmtDate(vote.cycle_period_end)}
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

      <div className="sm:grid gap-6 sm:space-y-0 space-y-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          {canEdit && (
            <AdminCycleVoteForm
              vote={vote}
              closed={closed}
              club={club}
              settings={settings}
              fixedCycleMonths={fixedCycleMonths}
              toast={toast}
              onChanged={reload}
            />
          )}

          {vote && (
            <VotePanel
              vote={vote}
              closed={closed}
              filledSlots={0}
              myResponse={myResponse}
              userId={user?.id}
              userName={userName}
              toast={toast}
              onChanged={reload}
              hideSlots
              pickerProps={pickerProps}
            />
          )}

          {vote && !closed && user?.id && (
            <ProxyVotePanel
              vote={vote}
              members={members}
              responses={responses}
              userId={user?.id}
              canEdit={canEdit}
              toast={toast}
              onChanged={reload}
            />
          )}

          {!vote && !canEdit && (
            <div className="rounded-3xl border border-dashed border-slate-200 py-14 text-center">
              <Calendar className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-500">{t('cycle_vote_no_vote_member')}</p>
            </div>
          )}
        </div>

        {vote && (
          <div className="lg:col-span-3">
            <CycleResultsPanel vote={vote} responses={responses} members={members} meId={user?.id} />
          </div>
        )}
      </div>
    </div>
  )
}
