import { useMemo } from 'react'
import { CheckCircle2, XCircle, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../../lib/utils'

function MemberVoteRow({ member, attending, avatarUrl }) {
  const committed = attending === true
  const declined = attending === false

  return (
    <div className={cx('flex items-center gap-3 rounded-2xl border px-3 py-2.5',
      committed ? 'border-lime-200 bg-lime-50' : declined ? 'border-slate-100 bg-white' : 'border-slate-100 bg-white'
    )}>
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={member.name} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-slate-900 grid place-items-center">
            <span className="text-xs font-black text-lime-400">{member.name[0]?.toUpperCase()}</span>
          </div>
        )}
        {committed && (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-lime-400">
            <CheckCircle2 className="h-3 w-3 text-slate-900" />
          </span>
        )}
      </div>
      <p className="flex-1 text-sm font-semibold text-slate-900 truncate">{member.name}</p>
      {committed && <span className="text-xs font-semibold text-lime-600">✓</span>}
      {declined && <XCircle className="h-4 w-4 text-slate-300 shrink-0" />}
    </div>
  )
}

export function CycleResultsPanel({ responses, members, meId }) {
  const { t } = useTranslation()

  const responseMap = useMemo(() => {
    const m = {}
    for (const r of responses) m[r.anonymous_user_id] = r
    return m
  }, [responses])

  // Build display list: members who responded first (committed on top), then others
  const rows = useMemo(() => {
    const committed = []
    const declined = []
    const noAnswer = []

    for (const m of members) {
      const r = m.user_id ? responseMap[m.user_id] : null
      if (r?.attending === true) committed.push({ member: m, attending: true })
      else if (r?.attending === false) declined.push({ member: m, attending: false })
      else noAnswer.push({ member: m, attending: null })
    }
    return [...committed, ...declined, ...noAnswer]
  }, [members, responseMap])

  const committedCount = rows.filter((r) => r.attending === true).length

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-6 backdrop-blur-xl space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{t('cycle_vote_committed_title')}</span>
        </div>
        <span className="rounded-full bg-lime-100 px-3 py-0.5 text-xs font-bold text-lime-700">
          {t('committed_members_count', { count: committedCount, total: members.length })}
        </span>
      </div>

      {/* Member list */}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">{t('cycle_vote_no_responses')}</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {rows.map(({ member, attending }) => (
            <MemberVoteRow
              key={member.id}
              member={member}
              attending={attending}
              avatarUrl={member.avatar_url}
            />
          ))}
        </div>
      )}
    </div>
  )
}
