import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Package, Plus, AlertTriangle, ChevronRight, X } from 'lucide-react'
import { cx, fmtDate } from '../../lib/utils'
import { BALLS_PER_BOX } from '../../constants'
import { Badge } from '../ui/Badge'

// ── Single shuttlecock icon ───────────────────────────────────────────────────
function ShuttlecockIcon({ filled }) {
  const feather = filled ? '#a3e635' : '#e2e8f0'
  const line    = filled ? '#3f6212' : '#94a3b8'
  const cork    = filled ? '#84cc16' : '#d1d5db'
  const sw      = '0.9'

  // Drawn upright (feathers up, cork down), then rotated -35° as a unit
  return (
    <svg viewBox="0 0 20 22" className="w-5 h-5 shrink-0" fill="none">
      <g transform="rotate(-35, 10, 11)">
        {/* 4 feather ovals — each slightly rotated to fan out */}
        <ellipse cx="7"  cy="8.5" rx="1.9" ry="6.5" transform="rotate(-22, 7,  8.5)"
          fill={feather} stroke={line} strokeWidth={sw} />
        <ellipse cx="9.5" cy="7.5" rx="1.9" ry="7"  transform="rotate(-7,  9.5, 7.5)"
          fill={feather} stroke={line} strokeWidth={sw} />
        <ellipse cx="12" cy="7.5" rx="1.9" ry="7"   transform="rotate(7,  12,  7.5)"
          fill={feather} stroke={line} strokeWidth={sw} />
        <ellipse cx="14.5" cy="8.5" rx="1.9" ry="6.5" transform="rotate(22, 14.5, 8.5)"
          fill={feather} stroke={line} strokeWidth={sw} />
        {/* 3 band stripes */}
        <line x1="6"   y1="14"   x2="15"  y2="14"   stroke={line} strokeWidth="1.1" strokeLinecap="round" />
        <line x1="6.5" y1="12.5" x2="14.5" y2="12.5" stroke={line} strokeWidth="1.1" strokeLinecap="round" />
        <line x1="7"   y1="11"   x2="14"  y2="11"   stroke={line} strokeWidth="1.1" strokeLinecap="round" />
        {/* Cork — pill shape */}
        <rect x="7" y="15" width="6.5" height="6" rx="3.25"
          fill={cork} stroke={line} strokeWidth={sw} />
      </g>
    </svg>
  )
}

// ── One tube (box of 12) ──────────────────────────────────────────────────────
function ShuttleTube({ filledCount, totalSlots = BALLS_PER_BOX, label, compact = false }) {
  const slots = Array.from({ length: totalSlots }, (_, i) => i < filledCount)

  if (compact) {
    // Mini version for modal grid on large counts
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex flex-col-reverse gap-[2px] rounded-xl border-2 border-slate-200 bg-slate-50 p-1 w-7">
          {slots.map((filled, i) => (
            <div
              key={i}
              className={cx('w-4 h-4 rounded-full mx-auto', filled ? 'bg-lime-400' : 'bg-slate-100')}
            />
          ))}
        </div>
        {label && <span className="text-[10px] font-mono text-slate-400">{label}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-col-reverse gap-1.5 rounded-2xl border-2 border-slate-200 bg-slate-50 p-2 w-10">
        {slots.map((filled, i) => (
          <div key={i} className="flex justify-center">
            <ShuttlecockIcon filled={filled} />
          </div>
        ))}
      </div>
      {label && <span className="text-xs font-mono text-slate-400">{label}</span>}
    </div>
  )
}

// ── Full-screen modal with all tubes ─────────────────────────────────────────
function ShuttleTubeModal({ tubes, totalBalls, onClose }) {
  const { t } = useTranslation()
  const totalBoxes = Math.floor(totalBalls / BALLS_PER_BOX)
  const remainder = totalBalls % BALLS_PER_BOX

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl rounded-3xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t('shuttle_stock_title')}</h2>
            <p className="text-sm text-slate-500">
              {totalBoxes > 0 && `${totalBoxes} ${t('shuttle_box_unit')} `}
              {remainder > 0 && `+ ${remainder} ${t('shuttle_ball_unit')}`}
              {totalBalls === 0 && t('shuttle_stock_empty')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Grid: 3 cols mobile, 4 tablet, 6 desktop */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {tubes.map((filled, i) => (
            <ShuttleTube key={i} filledCount={filled} label={`${t('shuttle_box_unit')} ${i + 1}`} compact />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────
const COMPACT_THRESHOLD = 6  // boxes — above this threshold, switch to compact display

export function ShuttleTubeWidget({ shuttleStatus, onRestock, canEdit }) {
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)

  const { totalBalls = 0, sessionsLeft = 0, nextBuyDate = null, unloggedCount = 0, projectedStock = 0, isLowStock = false } = shuttleStatus || {}

  const totalBoxes = Math.floor(totalBalls / BALLS_PER_BOX)
  const remainder = totalBalls % BALLS_PER_BOX
  const totalTubes = totalBoxes + (remainder > 0 ? 1 : 0)

  // Build per-tube filled counts
  const tubes = Array.from({ length: totalTubes }, (_, i) => {
    if (i < totalBoxes) return BALLS_PER_BOX
    return remainder
  })

  const isEmpty = totalBalls <= 0
  const isLow = isLowStock && !isEmpty

  const compactMode = totalTubes > COMPACT_THRESHOLD

  return (
    <>
      <div className="space-y-4">
        {/* Tube display */}
        {isEmpty ? (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-sm font-semibold text-red-700">{t('shuttle_stock_empty')}</span>
          </div>
        ) : compactMode ? (
          // Compact: show count + click to expand
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300 hover:bg-slate-50 transition active:scale-[0.98] text-left"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100">
              <Package className="h-5 w-5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">
                {totalBoxes} {t('shuttle_box_unit')}
                {remainder > 0 && <span className="font-normal text-slate-500"> + {remainder} {t('shuttle_ball_unit')}</span>}
              </p>
              <p className="text-xs text-slate-400">{totalBalls} {t('shuttle_ball_unit')} {t('shuttle_total_label')}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>
        ) : (
          // Inline tubes
          <div className="flex flex-wrap gap-2">
            {tubes.map((filled, i) => (
              <ShuttleTube key={i} filledCount={filled} />
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-3">
          {!isEmpty && (
            <div className={cx(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
              isLow
                ? 'bg-amber-100 text-amber-700'
                : 'bg-lime-100 text-lime-700'
            )}>
              {isLow && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              {t('shuttle_sessions_left', { n: sessionsLeft })}
            </div>
          )}

          {nextBuyDate && (
            <Badge tone={isEmpty ? 'red' : 'amber'}>
              {isEmpty
                ? t('shuttle_buy_now')
                : t('shuttle_buy_before', { date: fmtDate(nextBuyDate) })}
            </Badge>
          )}

          {unloggedCount > 0 && (
            <span className="text-xs text-slate-400 italic">
              {t('shuttle_unlogged_deducted', { n: unloggedCount })}
            </span>
          )}
        </div>

        {/* Restock button */}
        {canEdit && (
          <button
            onClick={onRestock}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <Plus className="h-4 w-4" />
            {t('shuttle_restock')}
          </button>
        )}
      </div>

      {modalOpen && <ShuttleTubeModal tubes={tubes} totalBalls={totalBalls} onClose={() => setModalOpen(false)} />}
    </>
  )
}
