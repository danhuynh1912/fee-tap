import { User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function SlotTip({ text, children }) {
  return (
    <div className="group relative">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-150 group-hover:opacity-100 group-hover:-translate-y-0.5">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </div>
    </div>
  )
}

export function SlotGrid({ filledSlots, maxSlots, attendees }) {
  const { t } = useTranslation()
  const slots = []
  attendees.forEach((r) => {
    const count = 1 + (r.guests || 0)
    for (let i = 0; i < count; i++) {
      slots.push({
        filled: true,
        isMain: i === 0,
        initial: r.name.trim().charAt(0).toUpperCase(),
        avatar_url: i === 0 ? r.avatar_url || null : null,
        tooltip: i === 0 ? r.name : t('vote_guest_of', { name: r.name }),
      })
    }
  })
  for (let i = filledSlots; i < maxSlots; i++) slots.push({ filled: false, idx: i - filledSlots })

  const cols = maxSlots <= 6 ? maxSlots : maxSlots <= 10 ? 5 : maxSlots <= 16 ? 8 : 10

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {slots.map((slot, i) =>
        slot.filled ? (
          <SlotTip key={i} text={slot.tooltip}>
            <div className="aspect-square rounded-xl bg-slate-900 flex items-center justify-center cursor-default overflow-hidden">
              {slot.avatar_url ? (
                <img
                  src={slot.avatar_url}
                  alt={slot.initial}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : slot.isMain ? (
                <span className="text-sm font-black text-lime-400">{slot.initial}</span>
              ) : (
                <User className="h-5 w-5 text-slate-500" strokeWidth={1.5} />
              )}
            </div>
          </SlotTip>
        ) : (
          <div key={i} className="aspect-square rounded-xl border-2 border-lime-400/40 bg-lime-400/5 relative overflow-hidden">
            <span
              className="absolute inset-0 rounded-xl animate-ping bg-lime-400/15"
              style={{ animationDelay: `${slot.idx * 180}ms`, animationDuration: '2.4s' }}
            />
          </div>
        )
      )}
    </div>
  )
}
