import { LayoutGrid, Circle, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../../lib/utils'
import { Badge } from '../../ui/Badge'
import { SlotsHero } from './SlotsHero'
import { SlotGrid } from './SlotGrid'

function Stat({ label, value, accent }) {
  return (
    <div>
      <p className={cx('text-2xl font-black tabular-nums', accent ? 'text-lime-500' : 'text-slate-900')}>{value}</p>
      <p className="text-xs font-medium text-slate-400">{label}</p>
    </div>
  )
}

export function ResultsPanel({ vote, attendees, responses, filledSlots, meId }) {
  const { t } = useTranslation()
  const declined = responses.filter((r) => !r.attending)

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-7 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-5 w-5 text-slate-400" />
        <h3 className="text-lg font-bold text-slate-900">{t('vote_attendees')}</h3>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime-500" />
        </span>
      </div>

      <div className="mt-5">
        <SlotsHero filledSlots={filledSlots} maxSlots={vote.max_slots} />
      </div>

      <div className="mt-4">
        <SlotGrid filledSlots={filledSlots} maxSlots={vote.max_slots} attendees={attendees} />
      </div>

      <ul className="mt-6 space-y-2">
        {attendees.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">{t('vote_no_attendees_yet')}</li>
        )}
        {attendees.map((r, i) => {
          const total = 1 + (r.guests || 0)
          const mine = r.anonymous_user_id === meId
          return (
            <li
              key={r.id}
              className={cx(
                'flex items-center gap-3 rounded-2xl border px-4 py-3 transition',
                mine ? 'border-lime-300 bg-lime-50' : 'border-slate-100 bg-white hover:border-slate-200'
              )}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-xs font-bold text-lime-400">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {r.name}
                  {mine && <span className="ml-2 text-xs font-medium text-lime-600">({t('vote_you')})</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {r.guests > 0
                    ? t(r.guests > 1 ? 'vote_result_guest_line_plural' : 'vote_result_guest_line', { guests: r.guests, total })
                    : t('vote_result_one_slot')}
                </p>
              </div>
              {r.guests > 0 && (
                <Badge tone="volt" icon={Users}>
                  {total}
                </Badge>
              )}
            </li>
          )
        })}
      </ul>

      {declined.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('vote_not_attending')} · {declined.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {declined.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-400 line-through"
              >
                <Circle className="h-2 w-2 fill-slate-300 text-slate-300" /> {r.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-5 text-center">
        <Stat label={t('vote_stat_players')} value={attendees.length} />
        <Stat label={t('vote_stat_guests')} value={attendees.reduce((s, r) => s + (r.guests || 0), 0)} />
        <Stat label={t('vote_stat_total')} value={filledSlots} accent />
      </div>
    </div>
  )
}
