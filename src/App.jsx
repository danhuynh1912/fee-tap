/* ============================================================================
 *  FEETAP — Fee + Tap
 *  The financial forecasting & fund-management engine for sports clubs.
 *
 *  Standalone React SPA (Vite + Tailwind + Lucide + Supabase), sharing ONE
 *  Supabase project with POLLTAP. It signs members in with Google OAuth 2.0,
 *  forecasts court + shuttlecock costs for the billing cycle, watches the
 *  club fund, and splits any shortfall across the live roster pulled from
 *  PollTap's membership poll.
 *
 *  Roles:   Host (club owner)  → full write access (subject to Free/Pro caps)
 *           Member             → read-only transparency dashboard
 *  Tiers:   FREE  → 15-member cap, locked advanced forecasting & export
 *           PRO   → everything unlocked  (mock VietQR upgrade, 99,000₫/mo)
 *
 *  UI DNA is intentionally identical to PollTap (Volt-green / Deep-slate,
 *  glassmorphism, thin borders, rounded-3xl panels). i18n: EN + VI.
 *
 *  See /supabase/schema.sql for the database. See README.md to run.
 * ========================================================================== */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import {
  Activity, ArrowRight, ArrowLeft, Check, X, Plus, Minus, Users, User,
  Wallet, TrendingUp, TrendingDown, Settings2, Loader2, Lock, Crown,
  AlertTriangle, Sparkles, Calendar, LayoutDashboard, ClipboardList,
  LogOut, Globe, ShieldCheck, Coins, CircleDollarSign, Target, Zap,
  LineChart, BarChart3, FileSpreadsheet, FileText, Trash2, ChevronRight,
  Building2, RefreshCw, CheckCircle2, Gauge, Receipt, PieChart, Eye, Info,
  ChevronDown, Menu, Link as LinkIcon, History,
} from 'lucide-react'

/* ----------------------------------------------------------------------------
 *  ① SUPABASE CONFIG  — replace these, or use a .env file (recommended)
 * ------------------------------------------------------------------------- */
const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL || 'https://YOUR-PROJECT-ref.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY || 'YOUR-ANON-PUBLIC-KEY'

const isConfigured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR-PROJECT') &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes('YOUR-ANON')

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ----------------------------------------------------------------------------
 *  ② CONSTANTS + TINY HELPERS
 * ------------------------------------------------------------------------- */
const FREE_MEMBER_LIMIT = 15
const BALLS_PER_BOX = 12
const PRO_PRICE_VND = 99000
const WEEKS_IN = { month: 4, quarter: 12 }

// Sport configs — add a new entry here to support a new sport.
// hasEquipment: true  → show shuttlecock/ball cost fields & stats
// hasEquipment: false → court rental only
const SPORT_CONFIGS = {
  badminton:   { id: 'badminton',   labelKey: 'sport_badminton',   emoji: '🏸', hasEquipment: true },
  football:    { id: 'football',    labelKey: 'sport_football',    emoji: '⚽', hasEquipment: false },
  basketball:  { id: 'basketball',  labelKey: 'sport_basketball',  emoji: '🏀', hasEquipment: false },
  volleyball:  { id: 'volleyball',  labelKey: 'sport_volleyball',  emoji: '🏐', hasEquipment: false },
  tabletennis: { id: 'tabletennis', labelKey: 'sport_tabletennis', emoji: '🏓', hasEquipment: false },
  pickleball:  { id: 'pickleball',  labelKey: 'sport_pickleball',  emoji: '🎾', hasEquipment: false },
}
const SPORT_LIST = Object.values(SPORT_CONFIGS)

const cx = (...c) => c.filter(Boolean).join(' ')

const fmtVND = (n) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + ' ₫'

const fmtNum = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0)

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

const num = (v, fallback = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

/* ── Calendar engine ──────────────────────────────────────────────────
 * Sessions are derived from the actual calendar: the admin picks which
 * weekdays the club plays (`play_weekdays`, 0=Sun … 6=Sat) and we count how
 * many of each weekday fall inside the billing period. Month mode uses the
 * calendar month containing today; quarter mode uses the 3-month window
 * (aligned to `quarter_start_month`) containing today. The "next" period is
 * the following month / quarter.
 * ------------------------------------------------------------------------ */
const mIdx = (y, m0) => y * 12 + m0
const fromIdx = (i) => ({ year: Math.floor(i / 12), month0: ((i % 12) + 12) % 12 })

// Count weekday occurrences inside one calendar month (local time, leap-safe).
function countWeekdays(year, month0, weekdays) {
  const set = new Set(weekdays)
  const last = new Date(year, month0 + 1, 0).getDate()
  const breakdown = {}
  let total = 0
  for (let d = 1; d <= last; d++) {
    const wd = new Date(year, month0, d).getDay()
    if (set.has(wd)) { total++; breakdown[wd] = (breakdown[wd] || 0) + 1 }
  }
  return { total, breakdown }
}

function makePeriod(kind, startIdx, len) {
  const months = []
  for (let k = 0; k < len; k++) months.push(fromIdx(startIdx + k))
  return { kind, startIdx, len, months }
}

// Resolve the current + next billing period from settings & today.
function resolvePeriods(s, now = new Date()) {
  const cycle = s.billing_cycle === 'quarter' ? 'quarter' : 'month'
  const here = mIdx(now.getFullYear(), now.getMonth())
  if (cycle === 'month') {
    return { cycle, current: makePeriod('month', here, 1), next: makePeriod('month', here + 1, 1) }
  }
  const anchor = Math.min(12, Math.max(1, Math.round(num(s.quarter_start_month, 1)))) - 1
  const off = (((now.getMonth() - anchor) % 3) + 3) % 3 // 0..2 position inside the quarter
  const start = here - off
  return { cycle, current: makePeriod('quarter', start, 3), next: makePeriod('quarter', start + 3, 3) }
}

// Sessions in a period — real weekday count, or a weekly-estimate fallback
// when no play days are set yet (keeps legacy data working).
function sessionsForPeriod(s, period) {
  const wds = Array.isArray(s.play_weekdays) ? s.play_weekdays : []
  if (!wds.length) {
    return { total: Math.round(num(s.sessions_per_week) * 4 * period.len), breakdown: {}, fallback: true }
  }
  let total = 0
  const breakdown = {}
  for (const { year, month0 } of period.months) {
    const c = countWeekdays(year, month0, wds)
    total += c.total
    for (const k in c.breakdown) breakdown[k] = (breakdown[k] || 0) + c.breakdown[k]
  }
  return { total, breakdown, fallback: false }
}

// Count how many scheduled sessions have already happened by `today` within the period.
function sessionsHappenedByNow(s, period, today = new Date()) {
  const wds = Array.isArray(s.play_weekdays) ? s.play_weekdays.map(Number) : []
  const { year: sy, month0: sm0 } = period.months[0]
  const lastM = period.months[period.months.length - 1]
  const periodEnd = new Date(lastM.year, lastM.month0 + 1, 0)
  const cutoff = today <= periodEnd ? today : periodEnd

  if (!wds.length) {
    // fallback: proportional estimate based on sessions_per_week
    const periodStart = new Date(sy, sm0, 1)
    const totalDays = (periodEnd - periodStart) / 86400000 + 1
    const elapsedDays = Math.max(0, Math.floor((cutoff - periodStart) / 86400000) + 1)
    const totalSess = Math.round(num(s.sessions_per_week) * 4 * period.len)
    return Math.min(totalSess, Math.floor((elapsedDays / totalDays) * totalSess))
  }

  const wdSet = new Set(wds)
  const periodStart = new Date(sy, sm0, 1)
  // Normalize cutoff to midnight to avoid time-of-day issues
  const cutoffDay = new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate())
  let count = 0
  const d = new Date(periodStart)
  while (d <= cutoffDay) {
    if (wdSet.has(d.getDay())) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// The forecasting engine — costs for one resolved period.
function computeCycle(s, period, memberCount, hasEquipment = true) {
  const sess = sessionsForPeriod(s, period)
  const totalSessions = sess.total
  const courtCost = num(s.court_price_per_hour) * num(s.hours_per_session) * totalSessions
  const boxes = hasEquipment ? Math.ceil((totalSessions * num(s.estimated_shuttlecocks)) / BALLS_PER_BOX) : 0
  const shuttleCost = hasEquipment ? boxes * num(s.price_per_box) : 0
  const totalCost = courtCost + shuttleCost
  const fund = num(s.current_fund)
  const balance = fund - totalCost
  const deficit = balance < 0 ? -balance : 0
  const perMemberDeficit = memberCount > 0 ? Math.ceil(deficit / memberCount) : 0
  const suggestedFee = memberCount > 0 ? Math.ceil(totalCost / memberCount) : 0
  return {
    period, totalSessions, breakdown: sess.breakdown, fallback: sess.fallback,
    courtCost, boxes, shuttleCost, totalCost, fund, balance, deficit,
    perMemberDeficit, suggestedFee,
  }
}

function formatPeriodLabel(period, lang) {
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US'
  if (period.kind === 'month') {
    const { year, month0 } = period.months[0]
    return new Date(year, month0, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }
  const a = period.months[0], b = period.months[period.len - 1]
  const fmt = (m) => new Date(m.year, m.month0, 1).toLocaleDateString(locale, { month: 'short' })
  return `${fmt(a)}–${fmt(b)} ${b.year}`
}

function monthName(m1, lang) {
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US'
  return new Date(2000, m1 - 1, 1).toLocaleDateString(locale, { month: 'long' })
}

/* ----------------------------------------------------------------------------
 *  ③ RICH FINTECH ILLUSTRATIONS (pure SVG / CSS — no external imagery)
 * ------------------------------------------------------------------------- */

// Animated area + line chart used on the sign-in hero & analytics cards.
function AnalyticsHero({ className = '' }) {
  // a hand-tuned upward path
  const line = 'M0 180 L60 150 L120 162 L180 120 L240 132 L300 78 L360 92 L420 40 L460 30'
  const area = line + ' L460 220 L0 220 Z'
  return (
    <div className={cx('relative overflow-hidden rounded-3xl bg-slate-900 bg-grid-dark', className)}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-10 left-1/3 h-56 w-72 rounded-full bg-lime-400/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative p-6 sm:p-7">
        {/* header strip */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Projected fund balance</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">+ 4.820.000 ₫</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-400">
            <TrendingUp className="h-3.5 w-3.5" /> +18.4%
          </span>
        </div>

        {/* chart */}
        <svg viewBox="0 0 460 220" className="mt-5 w-full" fill="none" aria-hidden>
          <defs>
            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ccff00" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ccff00" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* gridlines */}
          {[40, 90, 140, 190].map((y) => (
            <line key={y} x1="0" y1={y} x2="460" y2={y} stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
          ))}
          <path d={area} fill="url(#fillGrad)" />
          <path
            d={line}
            stroke="#ccff00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="1000" className="animate-draw-line"
          />
          {/* end node */}
          <circle cx="460" cy="30" r="5" fill="#ccff00" />
          <circle cx="460" cy="30" r="10" fill="#ccff00" fillOpacity="0.2" />
        </svg>

        {/* mini bars */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Court', val: '62%', w: '62%' },
            { label: 'Shuttle', val: '28%', w: '28%' },
            { label: 'Buffer', val: '10%', w: '10%' },
          ].map((b, i) => (
            <div key={b.label} className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3">
              <p className="text-[11px] font-medium text-slate-400">{b.label}</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-white">{b.val}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full origin-left rounded-full bg-lime-400 animate-rise"
                  style={{ width: b.w, animationDelay: `${i * 150 + 400}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Decorative line-graph glyph for feature cards.
function GraphGlyph({ className = '' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden>
      <path d="M10 90 L40 70 L60 80 L85 45 L110 25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="110" cy="25" r="4" fill="currentColor" />
      {[20, 50, 80].map((y) => (
        <line key={y} x1="10" y1={y} x2="110" y2={y} stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
      ))}
    </svg>
  )
}

// A deterministic "VietQR-style" matrix for the mock payment.
function MockQR({ size = 168 }) {
  const cells = 21
  const seed = 7
  const isDark = (r, c) => {
    // finder squares in 3 corners
    const inFinder = (R, C) =>
      (R < 7 && C < 7) || (R < 7 && C >= cells - 7) || (R >= cells - 7 && C < 7)
    if (inFinder(r, c)) {
      const fr = r % (cells - 7 === c ? 1 : 7)
      const inRing =
        (r === 0 || r === 6 || c === 0 || c === 6 ||
         r === cells - 7 || r === cells - 1 ||
         c === cells - 7 || c === cells - 1) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
        (r >= 2 && r <= 4 && c >= cells - 5 && c <= cells - 3) ||
        (r >= cells - 5 && r <= cells - 3 && c >= 2 && c <= 4)
      return inRing
    }
    return ((r * 31 + c * 17 + seed * (r ^ c)) % 5) < 2
  }
  const px = size / cells
  const rects = []
  for (let r = 0; r < cells; r++)
    for (let c = 0; c < cells; c++)
      if (isDark(r, c))
        rects.push(<rect key={`${r}-${c}`} x={c * px} y={r * px} width={px} height={px} rx={px * 0.18} fill="#0f172a" />)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-xl">
      <rect width={size} height={size} fill="#ffffff" />
      {rects}
    </svg>
  )
}

/* ----------------------------------------------------------------------------
 *  ④ UI PRIMITIVES  (mirrors PollTap's component conventions)
 * ------------------------------------------------------------------------- */
function Button({ as = 'button', variant = 'primary', size = 'md', className = '', children, ...p }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.98]'
  const sizes = {
    sm: 'text-sm px-4 py-2',
    md: 'text-[15px] px-5 py-3',
    lg: 'text-base px-7 py-4',
  }
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10',
    volt: 'bg-lime-400 text-slate-900 hover:bg-lime-300 shadow-lg shadow-lime-400/30',
    ghost: 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50',
    subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
    darkSubtle: 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700',
  }
  const Comp = as
  return (
    <Comp className={cx(base, sizes[size], variants[variant], className)} {...p}>
      {children}
    </Comp>
  )
}

function Field({ label, icon: Icon, hint, children }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        {label}
        {hint && <span className="text-slate-400 font-normal">· {hint}</span>}
      </span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5'

function Badge({ tone = 'slate', icon: Icon, children, className = '' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    volt: 'bg-lime-400 text-slate-900',
    cyan: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
    red: 'bg-red-50 text-red-600 ring-1 ring-red-200',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    dark: 'bg-slate-900 text-lime-300',
  }
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', tones[tone], className)}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  )
}

function Card({ className = '', children }) {
  return (
    <div className={cx('rounded-3xl border border-slate-100 bg-white/80 p-6 sm:p-7 shadow-xl shadow-slate-900/[0.03] backdrop-blur-xl', className)}>
      {children}
    </div>
  )
}

function Modal({ open, onClose, children, maxW = 'max-w-md' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-md" onClick={onClose} />
      <div className={cx('relative w-full animate-scale-in rounded-3xl border border-slate-100 bg-white/95 p-7 shadow-2xl shadow-slate-900/10 backdrop-blur-xl', maxW)}>
        {children}
      </div>
    </div>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-fade-in">
      <div className="flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
        <CheckCircle2 className="w-4 h-4 text-lime-400" />
        {toast}
      </div>
    </div>
  )
}

// Segmented control (used for billing cycle + month/quarter).
function Segmented({ value, onChange, options, disabled }) {
  return (
    <div className={cx('inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1', disabled && 'opacity-50 pointer-events-none')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-xl px-4 py-2 text-sm font-semibold transition',
            value === o.value ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 *  ⑤ NAV / SHELL
 * ------------------------------------------------------------------------- */
function ClubSwitcher({ myClubs, activeClub, onSelectClub }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!activeClub || !myClubs?.length) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white active:scale-[0.98]"
      >
        <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="max-w-[120px] truncate">{activeClub.name}</span>
        <ChevronDown className={cx('h-3.5 w-3.5 text-slate-400 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 w-64 animate-fade-in rounded-2xl border border-slate-100 bg-white/95 backdrop-blur-xl shadow-xl shadow-slate-900/10 p-2">
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('switcher_your_clubs')}</p>
          {myClubs.map((c) => (
            <button
              key={c.id}
              onClick={() => { onSelectClub(c); setOpen(false) }}
              className={cx(
                'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                c.id === activeClub.id ? 'bg-lime-400/10 text-lime-700 font-semibold' : 'text-slate-700 hover:bg-slate-50 font-medium'
              )}
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-lime-400 text-xs font-bold shrink-0">
                {c.name[0].toUpperCase()}
              </span>
              <span className="flex-1 text-left truncate">{c.name}</span>
              {c.id === activeClub.id && <Check className="h-3.5 w-3.5 shrink-0 text-lime-600" strokeWidth={3} />}
            </button>
          ))}
          <div className="mt-1 pt-1 border-t border-slate-100">
            <button
              onClick={() => { onSelectClub('new'); setOpen(false) }}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 transition"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-dashed border-slate-300 text-slate-400">
                <Plus className="h-3.5 w-3.5" />
              </span>
              {t('switcher_create_new')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Logo({ onClick }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-2.5">
      <span className="relative transition group-hover:scale-105">
        <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden>
          <rect width="32" height="32" rx="8" fill="#0f172a" />
          <path d="M9 22V10h7M9 16h6" fill="none" stroke="#ccff00" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="23" cy="11" r="2" fill="#ccff00" />
        </svg>
      </span>
      <span className="text-lg font-extrabold tracking-tight text-slate-900">
        FEE<span className="text-lime-500">TAP</span>
      </span>
    </button>
  )
}

function LangSwitch() {
  const { i18n } = useTranslation()
  const setLang = (lng) => {
    i18n.changeLanguage(lng)
    try { localStorage.setItem('feetap_lang', lng) } catch {}
  }
  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 p-0.5 text-xs font-bold">
      {['en', 'vi'].map((lng) => (
        <button
          key={lng}
          onClick={() => setLang(lng)}
          className={cx(
            'rounded-full px-2.5 py-1 uppercase transition',
            i18n.language === lng ? 'bg-slate-900 text-lime-400' : 'text-slate-400 hover:text-slate-700'
          )}
        >
          {lng}
        </button>
      ))}
    </div>
  )
}

function Nav({ session, myClubs, activeClub, role, onSignOut, onSelectClub }) {
  const { t } = useTranslation()
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/70 backdrop-blur-xl">
      <div className={`mx-auto flex h-16 items-center gap-3 px-5 ${session ? '' : 'max-w-[1350px]'}`}>
        <Logo onClick={() => navigate('/')} />

        {/* Club switcher — centre slot */}
        {activeClub && myClubs?.length > 0 && (
          <div className="flex-1 flex justify-center">
            <ClubSwitcher myClubs={myClubs} activeClub={activeClub} onSelectClub={onSelectClub} />
          </div>
        )}
        {(!activeClub || !myClubs?.length) && <div className="flex-1" />}

        {/* right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitch />
          {session && (
            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 py-1 pl-1 pr-3 text-sm font-medium text-slate-600 transition hover:border-slate-300"
              title={t('signOut')}
            >
              <img
                src={session.user?.user_metadata?.avatar_url || ''}
                alt=""
                onError={(e) => { e.currentTarget.style.display = 'none' }}
                className="h-7 w-7 rounded-full bg-slate-200 object-cover"
              />
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

function ConfigWarning() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto mt-4 max-w-6xl px-5">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t('cfg_warn')}</p>
      </div>
    </div>
  )
}

function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="border-t border-slate-100 bg-white/50 backdrop-blur">
      <div className="mx-auto flex max-w-[1350px] flex-col items-center justify-between gap-4 px-5 py-6 sm:flex-row">
        <Logo onClick={() => navigate('/')} />
        <p className="hidden text-sm text-slate-400 sm:block">Fee + Tap · {t('brand_tag')}</p>
        <span className="text-xs text-slate-300">© {new Date().getFullYear()} FEETAP</span>
      </div>
    </footer>
  )
}

/* ============================================================================
 *  ⑥ SIGN-IN  (Google OAuth 2.0 via Supabase)
 * ========================================================================== */
function SignInPage({ onGoogle, busy }) {
  const { t } = useTranslation()
  const features = [
    { icon: LineChart, t: 'feat_forecast_t', d: 'feat_forecast_d' },
    { icon: Users, t: 'feat_roster_t', d: 'feat_roster_d' },
    { icon: Gauge, t: 'feat_runway_t', d: 'feat_runway_d' },
  ]
  return (
    <main className="bg-grid flex-1">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-lime-200/40 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-cyan-200/30 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-16 lg:grid-cols-2 lg:pt-24">
          {/* copy + sign-in */}
          <div className="animate-fade-in">
            <Badge tone="dark" icon={CircleDollarSign}>{t('hero_badge')}</Badge>
            <h1 className="mt-6 text-5xl font-black leading-[1.04] tracking-tight text-slate-900 sm:text-6xl">
              {t('hero_title_1')}{' '}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">{t('hero_title_hl')}</span>
                <span className="absolute -bottom-1 left-0 z-0 h-4 w-full -rotate-1 bg-lime-300/70" />
              </span>
              {t('hero_title_2')}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-500">{t('hero_sub')}</p>

            <div className="mt-8 max-w-sm">
              <button
                onClick={onGoogle}
                disabled={busy || !isConfigured}
                className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-700 shadow-lg shadow-slate-900/[0.04] transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon className="h-5 w-5" />}
                {t('signin_google')}
              </button>
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <ShieldCheck className="h-4 w-4 text-lime-500" />
                {t('signin_note')}
              </p>
            </div>
          </div>

          {/* analytics hero */}
          <div className="animate-fade-in [animation-delay:120ms]">
            <AnalyticsHero />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-7 transition hover:border-slate-200 hover:shadow-xl hover:shadow-slate-900/[0.04]">
              <div className="pointer-events-none absolute -right-4 -top-4 text-slate-100 transition group-hover:text-lime-200">
                <GraphGlyph className="h-28 w-28" />
              </div>
              <div className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-lime-400">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{t(f.t)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{t(f.d)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  )
}

function GoogleIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.5-.2-2.6-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 16 2 9.1 6.6 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 46c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.6 36.5 26.9 37.5 24 37.5c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9 41.4 15.9 46 24 46z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.9 35.6 46 30.3 46 24c0-1.5-.2-2.6-.4-3.5z" />
    </svg>
  )
}

/* ============================================================================
 *  ⑦ ONBOARDING  (create a club → become host)
 * ========================================================================== */
function Onboarding({ session, onClubReady, toast }) {
  const { t } = useTranslation()
  const [sport, setSport] = useState('badminton')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function createClub(e) {
    e.preventDefault()
    if (name.trim().length < 2 || busy) return
    setBusy(true)
    try {
      const { data: club, error } = await supabase
        .from('clubs')
        .insert({ name: name.trim(), owner_id: session.user.id, plan: 'free', sport_type: sport })
        .select('*')
        .single()
      if (error) throw error
      await supabase.from('club_settings').insert({ club_id: club.id })
      onClubReady(club)
    } catch (err) {
      toast(err.message || t('err_generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="bg-grid flex-1">
      <div className="mx-auto max-w-xl px-5 py-16">
        <div className="animate-scale-in">
          <div className="mb-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-900 text-lime-400">
              <Building2 className="h-8 w-8" />
            </span>
            <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">{t('onb_title')}</h2>
            <p className="mt-2 text-slate-500">{t('onb_sub')}</p>
          </div>
          <Card>
            <form onSubmit={createClub} className="space-y-6">
              {/* Sport picker */}
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Zap className="h-4 w-4 text-slate-400" /> {t('onb_sport')}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SPORT_LIST.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSport(s.id)}
                      className={cx(
                        'flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3 text-center transition active:scale-[0.97]',
                        sport === s.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      )}
                    >
                      <span className="text-2xl leading-none">{s.emoji}</span>
                      <span className="text-xs font-semibold leading-tight">{t(s.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Club name */}
              <Field label={t('onb_club_name')} icon={Building2}>
                <input
                  className={inputCls}
                  placeholder={t('onb_club_ph')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={name.trim().length < 2 || busy}>
                {busy
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> {t('onb_creating')}</>
                  : <>{t('onb_create')} <ArrowRight className="h-5 w-5 text-lime-400" /></>}
              </Button>
            </form>
          </Card>
          <p className="mt-6 text-center text-sm text-slate-400">{t('onb_no_club')}</p>
        </div>
      </div>
      <Footer />
    </main>
  )
}

/* ============================================================================
 *  ⑦½ CLUB PICKER — choose which club to manage (multi-club support)
 * ========================================================================== */
function ClubCard({ club, onSelect }) {
  const { t } = useTranslation()
  const isHost = club.userRole === 'host'
  return (
    <button
      onClick={() => onSelect(club)}
      className="group relative flex flex-col items-start rounded-3xl border-2 border-slate-100 bg-white p-6 text-left transition hover:border-lime-400 hover:shadow-xl hover:shadow-lime-400/10 active:scale-[0.98]"
    >
      <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 ring-2 ring-lime-400 transition group-hover:opacity-100" />
      <div className="flex w-full items-start justify-between gap-2">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-xl font-black text-lime-400 shrink-0">
          {club.name[0].toUpperCase()}
        </span>
        <Badge tone={isHost ? 'dark' : 'slate'} icon={isHost ? Crown : User}>
          {isHost ? t('role_host') : t('role_member')}
        </Badge>
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900 leading-tight">{club.name}</h3>
      {isHost && (
        <div className="mt-2">
          <Badge tone={club.plan === 'pro' ? 'volt' : 'slate'} icon={club.plan === 'pro' ? Sparkles : Zap}>
            {club.plan === 'pro' ? t('plan_pro') : t('plan_free')}
          </Badge>
        </div>
      )}
      <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-slate-400 transition group-hover:text-lime-600">
        {isHost ? t('picker_manage') : t('picker_view')} <ChevronRight className="h-4 w-4" />
      </div>
    </button>
  )
}

function ClubPicker({ myClubs, onSelect, onCreateNew }) {
  const { t } = useTranslation()
  const hostedClubs = myClubs.filter((c) => c.userRole === 'host')
  const memberClubs = myClubs.filter((c) => c.userRole === 'member')

  return (
    <main className="bg-grid flex-1">
      <div className="mx-auto max-w-4xl px-5 py-16">
        <div className="animate-fade-in space-y-10">
          <div className="text-center">
            <Badge tone="dark" icon={Building2}>{t('picker_workspace')}</Badge>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">{t('picker_title')}</h2>
            <p className="mt-2 text-slate-500">{t('picker_subtitle')}</p>
          </div>

          {/* Section: clubs you host */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{t('picker_hosted')}</h3>
              </div>
              <button
                onClick={onCreateNew}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" /> {t('picker_new_btn')}
              </button>
            </div>

            {hostedClubs.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {hostedClubs.map((c) => <ClubCard key={c.id} club={c} onSelect={onSelect} />)}
                <button
                  onClick={onCreateNew}
                  className="group flex flex-col items-start rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-6 text-left transition hover:border-slate-300 hover:bg-white active:scale-[0.98]"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 transition group-hover:border-slate-400">
                    <Plus className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-400">{t('picker_create_new')}</h3>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 py-12 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                  <Building2 className="h-7 w-7" />
                </span>
                <p className="mt-4 text-base font-bold text-slate-700">{t('picker_no_hosted_title')}</p>
                <p className="mt-1 max-w-xs text-sm text-slate-400">{t('picker_no_hosted_body')}</p>
                <button
                  onClick={onCreateNew}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-lime-400 transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" /> {t('picker_create')}
                </button>
              </div>
            )}
          </section>

          {/* Section: clubs you joined as member */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{t('picker_joined')}</h3>
            </div>

            {memberClubs.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {memberClubs.map((c) => <ClubCard key={c.id} club={c} onSelect={onSelect} />)}
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/60 px-6 py-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-300">
                  <Users className="h-5 w-5" />
                </span>
                <p className="text-sm text-slate-400">{t('picker_no_joined')}</p>
              </div>
            )}
          </section>
        </div>
      </div>
      {/* <Footer /> */}
    </main>
  )
}

/* ============================================================================
 *  ⑧ PAYWALL — Upsell modal (mock VietQR upgrade)
 * ========================================================================== */
function UpsellModal({ open, onClose, onUpgraded, clubId, toast }) {
  const { t } = useTranslation()
  const [stage, setStage] = useState('offer') // offer | qr | processing | success
  const timer = useRef(null)

  useEffect(() => {
    if (!open) { setStage('offer'); clearTimeout(timer.current) }
    return () => clearTimeout(timer.current)
  }, [open])

  async function pay() {
    setStage('processing')
    // mock 3-second confirmation, then flip the club to PRO
    timer.current = setTimeout(async () => {
      try {
        await supabase.from('clubs').update({ plan: 'pro' }).eq('id', clubId)
      } catch {}
      setStage('success')
      onUpgraded()
      timer.current = setTimeout(() => { onClose(); }, 1600)
    }, 3000)
  }

  return (
    <Modal open={open} onClose={stage === 'processing' ? () => {} : onClose} maxW="max-w-lg">
      {stage === 'success' ? (
        <div className="py-6 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-lime-400 animate-pop-in">
            <Crown className="h-8 w-8 text-slate-900" />
          </span>
          <h3 className="mt-5 text-2xl font-black text-slate-900">{t('upsell_success')}</h3>
        </div>
      ) : stage === 'offer' ? (
        <>
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-lime-400">
              <Crown className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-xl font-black text-slate-900">{t('upsell_title')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('upsell_body')}</p>
          </div>

          <div className="mt-6 space-y-2.5">
            {['upsell_feature_1', 'upsell_feature_2', 'upsell_feature_3'].map((k) => (
              <div key={k} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-lime-400 text-slate-900">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <span className="text-sm font-semibold text-slate-700">{t(k)}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-end justify-between rounded-2xl bg-slate-900 px-5 py-4">
            <div>
              <p className="text-xs font-medium text-slate-400">FeeTap Pro</p>
              <p className="font-mono text-2xl font-black text-white">{t('upsell_price')}<span className="ml-1 text-sm font-medium text-slate-500">{t('upsell_price_cycle')}</span></p>
            </div>
            <Button variant="volt" onClick={() => setStage('qr')}>
              {t('upsell_pay')} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <button onClick={onClose} className="mt-3 w-full text-center text-sm font-medium text-slate-400 hover:text-slate-600">{t('upsell_maybe_later')}</button>
        </>
      ) : (
        // qr + processing
        <div className="text-center">
          <h3 className="text-xl font-black text-slate-900">{t('upsell_pay')}</h3>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">{t('upsell_price')}</p>
          <div className="mt-5 inline-block rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/5">
            <MockQR />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
            {stage === 'processing'
              ? <><Loader2 className="h-4 w-4 animate-spin text-slate-700" /> {t('upsell_processing')}</>
              : <><Receipt className="h-4 w-4" /> {t('upsell_scan')}</>}
          </div>
          {stage === 'qr' && (
            <Button variant="primary" size="lg" className="mt-5 w-full" onClick={pay}>
              {t('upsell_pay')} <ArrowRight className="h-5 w-5 text-lime-400" />
            </Button>
          )}
        </div>
      )}
    </Modal>
  )
}

// Lock veil placed over Pro-only sections on the Free plan.
function ProLock({ onClick, label }) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClick}
      className="absolute inset-0 z-10 grid place-items-center rounded-3xl bg-white/30 backdrop-blur-[2px] transition hover:bg-white/20"
    >
      <span className="flex flex-col items-center gap-2 rounded-2xl bg-slate-900/90 px-6 py-4 text-white shadow-xl">
        <Lock className="h-6 w-6 text-lime-400" />
        <span className="text-sm font-bold">{label || t('unlock')}</span>
      </span>
    </button>
  )
}

// Weekday multi-select (Mon-first), 0=Sun … 6=Sat.
function WeekdayPicker({ value, onChange, disabled }) {
  const { t } = useTranslation()
  const order = [1, 2, 3, 4, 5, 6, 0]
  const set = new Set(value || [])
  const toggle = (d) => {
    const n = new Set(set)
    n.has(d) ? n.delete(d) : n.add(d)
    onChange([...n].sort((a, b) => a - b))
  }
  return (
    <div className={cx('flex flex-wrap gap-2', disabled && 'pointer-events-none opacity-60')}>
      {order.map((d) => {
        const on = set.has(d)
        return (
          <button
            key={d} type="button" onClick={() => toggle(d)}
            className={cx(
              'h-11 min-w-[3.25rem] rounded-2xl border-2 px-3 text-sm font-bold transition active:scale-[0.97]',
              on ? 'border-slate-900 bg-slate-900 text-lime-400' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            )}
          >
            {t(`wd_${d}`)}
          </button>
        )
      })}
    </div>
  )
}

// Pills showing how many of each weekday fall in a period.
function SessionBreakdown({ breakdown }) {
  const { t } = useTranslation()
  const order = [1, 2, 3, 4, 5, 6, 0]
  const items = order.filter((d) => breakdown[d])
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((d) => (
        <span key={d} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          <span className="font-mono font-bold text-slate-900">{breakdown[d]}</span> × {t(`wd_${d}`)}
        </span>
      ))}
    </div>
  )
}

/* ============================================================================
 *  ⑨ SETTINGS — the forecasting engine inputs (host only)
 * ========================================================================== */
function SettingsPanel({ club, settings, sport, onSaved, canEdit, toast }) {
  const { t, i18n } = useTranslation()
  const [form, setForm] = useState(() => ({ ...settings }))
  const [busy, setBusy] = useState(false)

  useEffect(() => { setForm({ ...settings }) }, [settings])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.value ?? e }))

  const playDays = Array.isArray(form.play_weekdays) ? form.play_weekdays : []
  const previewPeriods = resolvePeriods(form)
  const previewSess = sessionsForPeriod(form, previewPeriods.current)
  const previewLabel = formatPeriodLabel(previewPeriods.current, i18n.language)

  async function save() {
    if (!canEdit || busy) return
    setBusy(true)
    try {
      const payload = {
        club_id: club.id,
        court_price_per_hour: num(form.court_price_per_hour),
        hours_per_session: num(form.hours_per_session),
        play_weekdays: playDays,
        // keep sessions_per_week in sync as a fallback for legacy consumers
        sessions_per_week: playDays.length || Math.round(num(form.sessions_per_week)),
        billing_cycle: form.billing_cycle === 'quarter' ? 'quarter' : 'month',
        quarter_start_month: Math.min(12, Math.max(1, Math.round(num(form.quarter_start_month, 1)))),
        price_per_box: num(form.price_per_box),
        estimated_shuttlecocks: num(form.estimated_shuttlecocks),
        current_fund: num(form.current_fund),
        court_payment_mode: courtMode,
      }
      const { error } = await supabase
        .from('club_settings')
        .upsert(payload, { onConflict: 'club_id' })
      if (error) throw error
      toast(t('set_saved'))
      onSaved(payload)
    } catch (e) {
      toast(e.message || t('err_generic'))
    } finally {
      setBusy(false)
    }
  }

  const courtMode = form.court_payment_mode === 'cycle' ? 'cycle' : 'session'
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpNote, setTopUpNote] = useState('')
  const [topUpBusy, setTopUpBusy] = useState(false)

  async function submitTopUp() {
    const amount = num(topUpAmount)
    if (!amount || topUpBusy) return
    setTopUpBusy(true)
    try {
      const newFund = num(settings.current_fund) + amount
      const { error: e1 } = await supabase.from('fund_transactions').insert({
        club_id: club.id, amount, note: topUpNote.trim() || null,
      })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('club_settings')
        .update({ current_fund: newFund }).eq('club_id', club.id)
      if (e2) throw e2
      toast(t('fund_added'))
      setTopUpAmount(''); setTopUpNote(''); setTopUpOpen(false)
      onSaved({ ...settings, current_fund: newFund })
    } catch (e) { toast(e.message || t('err_generic')) }
    finally { setTopUpBusy(false) }
  }

  const allFields = [
    { k: 'court_price_per_hour', label: 'set_court_price', icon: Coins, suffix: '₫', type: 'number' },
    { k: 'hours_per_session', label: 'set_hours', icon: Calendar, type: 'number', step: '0.5' },
    { k: 'price_per_box', label: 'set_box_price', icon: Coins, hint: 'set_box_hint', suffix: '₫', type: 'number', equipmentOnly: true },
    { k: 'estimated_shuttlecocks', label: 'set_shuttle', icon: Target, hint: 'set_shuttle_hint', type: 'number', step: '0.5', equipmentOnly: true },
    { k: 'current_fund', label: 'set_fund', icon: Wallet, suffix: '₫', type: 'number' },
  ]
  const fields = allFields.filter((f) => !f.equipmentOnly || sport.hasEquipment)

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-slate-400" />
        <h3 className="text-lg font-bold text-slate-900">{t('set_title')}</h3>
      </div>
      <p className="mt-1 text-sm text-slate-500">{t('set_sub')}</p>

      <div className={cx('mt-6 grid gap-5 sm:grid-cols-2', !canEdit && 'pointer-events-none opacity-70')}>
        {fields.map((f) => (
          <div key={f.k}>
            {f.k === 'current_fund' ? (
              <label className="block">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                  <Wallet className="w-4 h-4 text-slate-400" />
                  {t(f.label)}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setTopUpOpen((v) => !v)}
                      className="ml-auto flex items-center gap-1 rounded-full bg-lime-400 px-2.5 py-0.5 text-xs font-bold text-slate-900 hover:bg-lime-300 transition"
                    >
                      <Plus className="h-3 w-3" /> {t('fund_topup_btn')}
                    </button>
                  )}
                </span>
                <div className="relative">
                  <input
                    type="number" min="0"
                    className={cx(inputCls, 'pr-10 font-mono')}
                    value={form.current_fund ?? ''}
                    onChange={set('current_fund')}
                    disabled={!canEdit}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                </div>
              </label>
            ) : (
              <Field label={t(f.label)} icon={f.icon} hint={f.hint ? t(f.hint) : undefined}>
                <div className="relative">
                  <input
                    type={f.type} step={f.step} min="0"
                    className={cx(inputCls, f.suffix && 'pr-10', 'font-mono')}
                    value={form[f.k] ?? ''}
                    onChange={set(f.k)}
                    disabled={!canEdit}
                  />
                  {f.suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">{f.suffix}</span>}
                </div>
              </Field>
            )}
            {f.k === 'current_fund' && topUpOpen && canEdit && (
              <div className="mt-2 rounded-2xl border border-lime-200 bg-lime-50 p-4 space-y-3 animate-fade-in">
                <p className="text-xs font-semibold text-slate-600">{t('fund_topup_title')}</p>
                <div className="relative">
                  <input
                    type="number" min="0"
                    className={cx(inputCls, 'pr-10 font-mono bg-white')}
                    placeholder={t('fund_topup_amount_ph')}
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    autoFocus
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                </div>
                <input
                  className={cx(inputCls, 'bg-white')}
                  placeholder={t('fund_topup_note_ph')}
                  value={topUpNote}
                  onChange={(e) => setTopUpNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="volt" size="sm" className="flex-1" onClick={submitTopUp} disabled={topUpBusy || !topUpAmount}>
                    {topUpBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> {t('fund_topup_submit')}</>}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setTopUpOpen(false); setTopUpAmount(''); setTopUpNote('') }}>
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="sm:col-span-2">
          <Field label={t('set_court_mode')} icon={Coins} hint={t('set_court_mode_hint')}>
            <Segmented
              value={courtMode}
              onChange={(v) => setForm((f) => ({ ...f, court_payment_mode: v }))}
              disabled={!canEdit}
              options={[
                { value: 'session', label: t('court_mode_session') },
                { value: 'cycle', label: t('court_mode_cycle') },
              ]}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label={t('set_cycle')} icon={RefreshCw}>
            <Segmented
              value={form.billing_cycle === 'quarter' ? 'quarter' : 'month'}
              onChange={(v) => setForm((f) => ({ ...f, billing_cycle: v }))}
              disabled={!canEdit}
              options={[{ value: 'month', label: t('month') }, { value: 'quarter', label: t('quarter') }]}
            />
          </Field>
        </div>

        {form.billing_cycle === 'quarter' && (
          <div className="sm:col-span-2">
            <Field label={t('set_quarter_start')} icon={Calendar}>
              <select
                className={inputCls}
                value={Math.min(12, Math.max(1, Math.round(num(form.quarter_start_month, 1))))}
                onChange={set('quarter_start_month')}
                disabled={!canEdit}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{monthName(m, i18n.language)}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <div className="sm:col-span-2">
          <Field label={t('set_playdays')} icon={Calendar} hint={t('set_playdays_hint')}>
            <WeekdayPicker
              value={playDays}
              onChange={(v) => setForm((f) => ({ ...f, play_weekdays: v }))}
              disabled={!canEdit}
            />
          </Field>
        </div>

        <div className="sm:col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Calendar className="h-4 w-4 text-slate-400" />
            {t('set_preview', { count: previewSess.total, label: previewLabel })}
          </p>
          {previewSess.fallback ? (
            <p className="mt-2 text-xs text-amber-600">{t('set_no_days')}</p>
          ) : (
            <div className="mt-2"><SessionBreakdown breakdown={previewSess.breakdown} /></div>
          )}
        </div>
      </div>

      {canEdit && (
        <Button variant="primary" size="lg" className="mt-6 w-full" onClick={save} disabled={busy}>
          {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> {t('saving')}</> : <>{t('save')} <Check className="h-5 w-5 text-lime-400" /></>}
        </Button>
      )}
    </Card>
  )
}

/* ============================================================================
 *  ⑩ MEMBERS — registration list with the Free 15-member cap
 * ========================================================================== */
function MembersPanel({ club, members, plan, pollTally, canEdit, onChanged, onHitLimit, toast }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const count = members.length
  const atLimit = plan === 'free' && count >= FREE_MEMBER_LIMIT

  async function add(e) {
    e.preventDefault()
    if (!canEdit || !name.trim() || busy) return
    if (atLimit) { onHitLimit(); return }
    setBusy(true)
    try {
      const { error } = await supabase
        .from('club_members')
        .insert({ club_id: club.id, name: name.trim() })
      if (error) throw error
      setName('')
      onChanged()
    } catch (e) { toast(e.message || t('err_generic')) }
    finally { setBusy(false) }
  }

  async function remove(id) {
    if (!canEdit) return
    try {
      const { error } = await supabase.from('club_members').delete().eq('id', id)
      if (error) throw error
      onChanged()
    } catch (e) { toast(e.message || t('err_generic')) }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-900">{t('mem_title')}</h3>
        </div>
        <Badge tone={atLimit ? 'amber' : plan === 'pro' ? 'volt' : 'slate'}>
          {plan === 'pro' ? t('mem_sub_pro', { count }) : t('mem_sub_free', { count })}
        </Badge>
      </div>

      {/* free-plan capacity meter */}
      {plan === 'free' && (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cx('h-full rounded-full transition-all duration-500', atLimit ? 'bg-amber-400' : 'bg-lime-400')}
            style={{ width: `${Math.min(100, (count / FREE_MEMBER_LIMIT) * 100)}%` }}
          />
        </div>
      )}

      {pollTally?.source === 'poll' && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-700">
          <RefreshCw className="h-3.5 w-3.5" /> {t('mem_poll_synced')}: {pollTally.count}
        </p>
      )}

      {canEdit && (
        <form onSubmit={add} className="mt-4 flex gap-2">
          <input
            className={cx(inputCls, 'flex-1')}
            placeholder={t('mem_add_ph')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant={atLimit ? 'volt' : 'primary'} disabled={busy || !name.trim()}>
            {atLimit ? <><Lock className="h-4 w-4" /> {t('mem_limit_reached')}</> : <><Plus className="h-4 w-4" /> {t('add')}</>}
          </Button>
        </form>
      )}

      <ul className="mt-4 space-y-2">
        {count === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
            {t('mem_empty')}
          </li>
        )}
        {members.map((m, i) => (
          <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 transition hover:border-slate-200">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-xs font-bold text-lime-400">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{m.name}</span>
            {canEdit && (
              <button onClick={() => remove(m.id)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ============================================================================
 *  ⑪ DASHBOARD — financial forecast + fund runway alert
 * ========================================================================== */
// Subtle "i" affordance — formula popover on hover.
function InfoTip({ children }) {
  return (
    <span className="group/tip relative inline-flex">
      <Info className="h-3.5 w-3.5 cursor-help text-slate-300 transition group-hover/tip:text-slate-500" />
      <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-64 rounded-2xl bg-slate-900 p-3.5 text-left text-xs leading-relaxed text-slate-200 opacity-0 shadow-xl shadow-slate-900/20 transition-all duration-150 group-hover/tip:opacity-100 group-hover/tip:-translate-y-0.5">
        {children}
        <span className="absolute right-3 top-full border-4 border-transparent border-t-slate-900" />
      </span>
    </span>
  )
}

function StatCard({ icon: Icon, label, value, sub, tone = 'slate', big, tip }) {
  const tones = {
    slate: 'text-slate-900',
    volt: 'text-lime-600',
    red: 'text-red-600',
    cyan: 'text-cyan-700',
    violet: 'text-violet-600',
  }
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        {tip && <span className="ml-auto"><InfoTip>{tip}</InfoTip></span>}
      </div>
      <p className={cx('mt-2 font-mono font-black tabular-nums', big ? 'text-xl sm:text-3xl' : 'text-lg sm:text-2xl', tones[tone])}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function ForecastDashboard({ settings, memberCount, memberSource, plan, sport, canEdit, onUnlock, logs, fundTxns }) {
  const { t, i18n } = useTranslation()
  const hasEquipment = sport?.hasEquipment ?? true
  const periods = useMemo(() => resolvePeriods(settings), [settings])
  const f = useMemo(() => computeCycle(settings, periods.current, memberCount, hasEquipment), [settings, periods, memberCount, hasEquipment])
  const fn = useMemo(() => computeCycle(settings, periods.next, memberCount, hasEquipment), [settings, periods, memberCount, hasEquipment])
  const curLabel = formatPeriodLabel(periods.current, i18n.language)
  const nextLabel = formatPeriodLabel(periods.next, i18n.language)
  const delta = fn.totalCost - f.totalCost
  const bdText = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => f.breakdown[d])
    .map((d) => `${f.breakdown[d]} × ${t('wd_' + d)}`)
    .join('  ·  ')

  // ── actual vs forecast ────────────────────────────────────────
  const courtMode = settings.court_payment_mode === 'cycle' ? 'cycle' : 'session'
  const periodMonthKeys = periods.current.months.map(
    (m) => `${m.year}-${String(m.month0 + 1).padStart(2, '0')}`
  )
  const logsInPeriod = (logs || []).filter((l) =>
    periodMonthKeys.some((k) => l.played_on?.startsWith(k))
  )
  const loggedSessions = logsInPeriod.length

  // How many sessions have actually happened by today (from schedule)
  const happenedSessions = useMemo(
    () => sessionsHappenedByNow(settings, periods.current),
    [settings, periods]
  )
  const unloggedHappened = Math.max(0, happenedSessions - loggedSessions)
  const remainingSessions = Math.max(0, f.totalSessions - happenedSessions)

  // Cost per session (full / shuttle-only)
  const costPerSession = f.totalSessions > 0 ? f.totalCost / f.totalSessions : 0
  const shuttleCostPerSession = f.totalSessions > 0 ? f.shuttleCost / f.totalSessions : 0

  const actualShuttleSpent = logsInPeriod.reduce((s, l) => s + num(l.shuttle_cost), 0)
  const actualSessionSpent = logsInPeriod.reduce((s, l) => s + num(l.total_cost), 0)

  // Unlogged sessions that already happened → use estimated cost
  const estimatedUnloggedCost = courtMode === 'cycle'
    ? Math.round(unloggedHappened * shuttleCostPerSession)
    : Math.round(unloggedHappened * costPerSession)

  // In cycle mode: court paid as lump sum; only shuttle varies per session
  const actualSpent = courtMode === 'cycle'
    ? f.courtCost + actualShuttleSpent + estimatedUnloggedCost
    : actualSessionSpent + estimatedUnloggedCost
  const remainingForecast = courtMode === 'cycle'
    ? Math.round(remainingSessions * shuttleCostPerSession)
    : Math.round(remainingSessions * costPerSession)

  const totalCollected = (fundTxns || []).reduce((s, tx) => s + num(tx.amount), 0)
  const currentFund = num(settings.current_fund)
  // cycle mode: fund hasn't had court deducted yet — must subtract it in projection
  // session mode: fund is already reduced per session, only subtract remaining forecast
  const projectedBalance = courtMode === 'cycle'
    ? currentFund - f.courtCost - Math.round(remainingSessions * shuttleCostPerSession)
    : currentFund - remainingForecast
  const projectedSurplus = projectedBalance >= 0
  const projectedDeficit = projectedSurplus ? 0 : -projectedBalance
  const perMemberTopUp = memberCount > 0 ? Math.ceil(projectedDeficit / memberCount) : 0
  const suggestedFee = f.totalSessions > 0 && memberCount > 0 ? Math.ceil(f.totalCost / memberCount) : 0
  const sessionProgress = f.totalSessions > 0 ? Math.min(1, happenedSessions / f.totalSessions) : 0

  return (
    <div className="space-y-5">

      {/* ── HERO CARD ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 bg-grid-dark p-6 sm:p-8 text-white">
        <div className={cx('pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full blur-3xl', projectedSurplus ? 'bg-lime-400/10' : 'bg-red-500/15')} />

        {/* header row */}
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <PieChart className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">{curLabel}</span>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300"
            title={memberSource === 'poll' ? t('dash_member_src_poll') : t('dash_member_src_list')}
          >
            <Users className="h-3.5 w-3.5 text-lime-400" /> {memberCount} {t('members')}
          </span>
        </div>

        {/* live fund — dominant figure */}
        <div className="relative mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('dash_fund_live')}</p>
          <p className="mt-1 font-mono text-4xl sm:text-5xl font-black tabular-nums leading-none text-white">
            {fmtVND(currentFund)}
          </p>
        </div>

        {/* 4-column mini-stats: Thu → Chi → Còn lại → Cuối kỳ */}
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {/* Tổng đã thu */}
          <div className="rounded-2xl bg-lime-400/10 border border-lime-400/20 px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-lime-500">{t('dash_total_collected')}</p>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-lime-400">{fmtVND(totalCollected)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{(fundTxns || []).length} {t('dash_collections')}</p>
          </div>

          {/* Đã chi */}
          <div className="rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_actual_spent')}</p>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-white">{fmtVND(actualSpent)}</p>
            {courtMode === 'cycle' ? (
              <p className="mt-0.5 text-[10px] text-slate-500">
                {t('dash_court_paid')} + {fmtVND(actualShuttleSpent)} {t('dash_shuttle_actual')}
              </p>
            ) : (
              <p className="mt-0.5 text-[10px] text-slate-500">
                {happenedSessions} {t('dash_sessions_happened')}
                {unloggedHappened > 0 && <span className="text-amber-400"> ({unloggedHappened} {t('dash_estimated')})</span>}
              </p>
            )}
          </div>

          {/* Còn lại */}
          <div className="rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_remaining_forecast')}</p>
            <p className="mt-1.5 font-mono text-sm sm:text-base font-black text-slate-300">~{fmtVND(remainingForecast)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{remainingSessions} {t('dash_sessions_future')}</p>
          </div>

          {/* Cuối kỳ */}
          <div className={cx('rounded-2xl px-3 py-3 sm:px-4', projectedSurplus ? 'bg-lime-400/15' : 'bg-red-500/20')}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_end_of_period')}</p>
            <p className={cx('mt-1.5 font-mono text-sm sm:text-base font-black', projectedSurplus ? 'text-lime-400' : 'text-red-400')}>
              {projectedSurplus ? '+' : '−'}{fmtVND(Math.abs(projectedBalance))}
            </p>
            <span className={cx('mt-0.5 text-[10px] font-bold', projectedSurplus ? 'text-lime-400' : 'text-red-400')}>
              {projectedSurplus ? t('bal_surplus') : t('bal_deficit')}
            </span>
          </div>
        </div>

        {/* session progress bar */}
        {f.totalSessions > 0 && (
          <div className="relative mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dash_session_progress')}</span>
              <span className="text-[10px] font-mono text-slate-400">{loggedSessions} / {f.totalSessions} {t('dash_sessions')}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-lime-400 transition-all duration-500"
                style={{ width: `${sessionProgress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── PROJECTED RESULT CALLOUT ──────────────────────────── */}
      {projectedSurplus ? (
        <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-lime-200 bg-lime-50 p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime-400 text-slate-900">
            <TrendingUp className="h-6 w-6" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900">{t('dash_proj_surplus_title')}</p>
            <p className="text-sm text-slate-600">
              {t('dash_proj_surplus_body')} <span className="font-mono font-bold text-lime-700">{fmtVND(projectedBalance)}</span>
            </p>
          </div>
          {memberCount > 0 && (
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_suggested_fee')}</p>
              <p className="font-mono text-2xl font-black text-slate-900">{fmtVND(suggestedFee)}</p>
              <p className="text-[10px] text-slate-400">/ {t('member')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500 text-white">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-red-700">{t('dash_proj_deficit_title')}</p>
              <p className="mt-1 text-sm text-slate-700">
                {t('dash_deficit_body', { amount: fmtVND(projectedDeficit) })}
              </p>
            </div>
          </div>
          {memberCount > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/70 p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_proj_shortfall')}</p>
                <p className="font-mono text-lg font-black text-red-600">{fmtVND(projectedDeficit)}</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_member_count')}</p>
                <p className="font-mono text-lg font-black text-slate-900">{memberCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('dash_per_member')}</p>
                <p className="font-mono text-lg font-black text-lime-400">{fmtVND(perMemberTopUp)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── COST BREAKDOWN STATS ─────────────────────────────── */}
      <div className={cx('grid gap-4', hasEquipment ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        <StatCard
          icon={Activity} label={t('dash_court_cost')} value={fmtVND(f.courtCost)} tone="violet"
          sub={`${f.totalSessions} ${t('dash_sessions')} × ${fmtVND(num(settings.court_price_per_hour) * num(settings.hours_per_session))}`}
          tip={
            <>
              <p className="font-semibold text-white">{t('calc_court_title')}</p>
              <p className="mt-1.5 font-mono text-lime-300">
                {fmtVND(num(settings.court_price_per_hour))} × {fmtNum(num(settings.hours_per_session))}h × {fmtNum(f.totalSessions)}
              </p>
              <p className="mt-1 font-mono text-white">= {fmtVND(f.courtCost)}</p>
            </>
          }
        />
        {hasEquipment && (
          <StatCard
            icon={Target} label={t('dash_shuttle_cost')} value={fmtVND(f.shuttleCost)} sub={`${f.boxes} ${t('dash_boxes')}`} tone="cyan"
            tip={
              <>
                <p className="font-semibold text-white">{t('calc_shuttle_title')}</p>
                <p className="mt-1.5 font-mono text-cyan-300">
                  ⌈{fmtNum(f.totalSessions)} × {fmtNum(num(settings.estimated_shuttlecocks))} ÷ {BALLS_PER_BOX}⌉ = {f.boxes} {t('dash_boxes')}
                </p>
                <p className="mt-1 font-mono text-cyan-300">{f.boxes} × {fmtVND(num(settings.price_per_box))}</p>
                <p className="mt-1 font-mono text-white">= {fmtVND(f.shuttleCost)}</p>
              </>
            }
          />
        )}
        <StatCard
          icon={Wallet} label={t('dash_total_cycle')} value={fmtVND(f.totalCost)} sub={curLabel}
          tip={
            <>
              <p className="font-semibold text-white">{t('dash_total_cost')}</p>
              <p className="mt-1.5 font-mono text-lime-300">{fmtVND(f.courtCost)} + {hasEquipment ? fmtVND(f.shuttleCost) : '0'}</p>
              <p className="mt-1 font-mono text-white">= {fmtVND(f.totalCost)}</p>
            </>
          }
        />
      </div>

      {/* ── NEXT CYCLE ───────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <ArrowRight className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">{t('dash_next_cycle')} · {nextLabel}</span>
          </div>
          {delta !== 0 && (
            <Badge tone={delta > 0 ? 'red' : 'volt'} icon={delta > 0 ? TrendingUp : TrendingDown}>
              {delta > 0 ? '+' : '−'}{fmtVND(Math.abs(delta))} {t('dash_vs_current')}
            </Badge>
          )}
        </div>
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-400">{t('dash_sessions')}</p>
            <p className="font-mono text-lg font-black text-slate-900">{fmtNum(fn.totalSessions)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-400">{t('dash_total_cost')}</p>
            <p className="font-mono text-lg font-black text-slate-900">{fmtVND(fn.totalCost)}</p>
          </div>
          <div className="rounded-2xl bg-slate-900 p-3 text-center">
            <p className="text-xs text-slate-400">{t('dash_per_member')}</p>
            <p className="font-mono text-lg font-black text-lime-400">{fmtVND(fn.suggestedFee)}</p>
          </div>
        </div>
      </div>

      {/* ── ADVANCED (Pro) ───────────────────────────────────── */}
      <AdvancedForecast forecast={f} plan={plan} onUnlock={onUnlock} />
    </div>
  )
}

/* Quarterly advanced forecasting — blurred & locked on the Free plan. */
function AdvancedForecast({ forecast, plan, onUnlock }) {
  const { t } = useTranslation()
  const locked = plan !== 'pro'
  // simple seasonal projection across 3 cycles
  const factors = [1, 1.08, 0.96, 1.14]
  const projections = factors.map((fac, i) => ({
    label: t('adv_q', { n: i + 1 }),
    cost: forecast.totalCost * fac,
    fac,
  }))
  const maxCost = Math.max(...projections.map((p) => p.cost), 1)

  return (
    <div className="relative">
      <div className={cx(locked && 'locked-blur')}>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-900">{t('adv_title')}</h3>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={locked ? undefined : onUnlock}><FileSpreadsheet className="h-4 w-4" /> {t('export_excel')}</Button>
              <Button size="sm" variant="ghost" onClick={locked ? undefined : onUnlock}><FileText className="h-4 w-4" /> {t('export_pdf')}</Button>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-500">{t('adv_sub')}</p>

          <div className="mt-6 grid grid-cols-4 items-end gap-3" style={{ height: 180 }}>
            {projections.map((p, i) => (
              <div key={i} className="flex h-full flex-col items-center justify-end gap-2">
                <span className="font-mono text-xs font-bold text-slate-500">{fmtVND(p.cost).replace(' ₫', '')}</span>
                <div
                  className="w-full origin-bottom rounded-t-xl bg-gradient-to-t from-slate-900 to-slate-700 animate-rise"
                  style={{ height: `${(p.cost / maxCost) * 100}%`, animationDelay: `${i * 120}ms` }}
                >
                  <div className="h-1.5 w-full rounded-t-xl bg-lime-400" />
                </div>
                <span className="text-xs font-semibold text-slate-400">{p.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {locked && <ProLock onClick={onUnlock} label={t('locked_pro')} />}
    </div>
  )
}

/* ============================================================================
 *  ⑫ SESSION LOG — post-match actuals + variance
 * ========================================================================== */
function SessionLog({ club, logs, settings, sport, estimate, canEdit, onChanged, toast }) {
  const { t } = useTranslation()
  const [editingDate, setEditingDate] = useState(null)
  const [editForm, setEditForm] = useState({ actual: '', note: '' })
  const [busy, setBusy] = useState(false)

  const hasEquipment = sport?.hasEquipment ?? true
  const est = num(estimate)
  const cycleMode = settings.court_payment_mode === 'cycle'

  // Derive all session dates in the current period up to today from schedule
  const periods = useMemo(() => resolvePeriods(settings), [settings])
  const wds = useMemo(() => {
    const arr = Array.isArray(settings.play_weekdays) ? settings.play_weekdays.map(Number) : []
    return new Set(arr)
  }, [settings.play_weekdays])

  const scheduledDates = useMemo(() => {
    if (!wds.size) return []
    const { year: sy, month0: sm0 } = periods.current.months[0]
    const lastM = periods.current.months[periods.current.months.length - 1]
    const periodEnd = new Date(lastM.year, lastM.month0 + 1, 0)
    const today = new Date()
    const cutoff = new Date(Math.min(today, periodEnd))
    const cutoffDay = new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate())
    const dates = []
    const d = new Date(sy, sm0, 1)
    while (d <= cutoffDay) {
      if (wds.has(d.getDay())) dates.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }
    return dates.reverse() // most recent first
  }, [settings, periods, wds])

  // Merge schedule with actual logs
  const sessions = useMemo(() => scheduledDates.map((date) => {
    const log = logs.find((l) => l.played_on === date)
    return { date, log }
  }), [scheduledDates, logs])

  const loggedCount = sessions.filter((s) => s.log).length
  const avgActual = loggedCount
    ? sessions.filter((s) => s.log).reduce((sum, s) => sum + num(s.log.actual_shuttlecocks), 0) / loggedCount
    : 0
  const runningHigh = loggedCount >= 2 && avgActual > est

  function startEdit(date, log) {
    setEditingDate(date)
    setEditForm({ actual: log ? String(num(log.actual_shuttlecocks)) : '', note: log?.note || '' })
  }

  async function saveEdit() {
    if (busy) return
    setBusy(true)
    try {
      const actualCount = editForm.actual === '' ? est : num(editForm.actual)
      const courtCost = num(settings.court_price_per_hour) * num(settings.hours_per_session)
      const shuttleCost = hasEquipment
        ? Math.round(actualCount * (num(settings.price_per_box) / BALLS_PER_BOX))
        : 0
      const totalCost = courtCost + shuttleCost
      const existingLog = logs.find((l) => l.played_on === editingDate)

      if (existingLog) {
        await supabase.from('session_logs').update({
          actual_shuttlecocks: actualCount,
          note: editForm.note.trim() || null,
          court_cost: courtCost, shuttle_cost: shuttleCost, total_cost: totalCost,
        }).eq('id', existingLog.id)

        // Adjust fund: restore old deduction, apply new
        const oldDeduct = cycleMode ? num(existingLog.shuttle_cost) : num(existingLog.total_cost)
        const newDeduct = cycleMode ? shuttleCost : totalCost
        const adj = oldDeduct - newDeduct
        if (adj !== 0) {
          await supabase.from('club_settings')
            .update({ current_fund: num(settings.current_fund) + adj })
            .eq('club_id', club.id)
        }
      } else {
        await supabase.from('session_logs').insert({
          club_id: club.id, played_on: editingDate,
          actual_shuttlecocks: actualCount, note: editForm.note.trim() || null,
          court_cost: courtCost, shuttle_cost: shuttleCost, total_cost: totalCost,
        })
        const deduct = cycleMode ? shuttleCost : totalCost
        await supabase.from('club_settings')
          .update({ current_fund: Math.max(0, num(settings.current_fund) - deduct) })
          .eq('club_id', club.id)
      }

      setEditingDate(null)
      onChanged()
    } catch (e) { toast(e.message || t('err_generic')) }
    finally { setBusy(false) }
  }

  async function clearLog(log) {
    if (!canEdit || !log) return
    try {
      await supabase.from('session_logs').delete().eq('id', log.id)
      const restore = cycleMode ? num(log.shuttle_cost) : num(log.total_cost)
      if (restore > 0) {
        await supabase.from('club_settings')
          .update({ current_fund: num(settings.current_fund) + restore })
          .eq('club_id', club.id)
      }
      onChanged()
    } catch (e) { toast(e.message || t('err_generic')) }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-slate-400" />
        <h3 className="text-lg font-bold text-slate-900">{t('log_title')}</h3>
      </div>
      <p className="mt-1 text-sm text-slate-500">{t('log_sub_auto')}</p>

      {/* summary strip */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatCard icon={ClipboardList} label={t('log_happened')} value={fmtNum(sessions.length)} />
        <StatCard icon={Check} label={t('log_recorded')} value={fmtNum(loggedCount)} tone={loggedCount === sessions.length ? 'volt' : 'slate'} />
        {hasEquipment && <StatCard icon={Gauge} label={t('log_avg')} value={loggedCount ? avgActual.toFixed(1) : '—'} tone={runningHigh ? 'red' : 'slate'} />}
      </div>

      {runningHigh && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {t('log_warn')}
        </div>
      )}

      {!wds.size && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          <Info className="h-4 w-4 shrink-0" /> {t('log_no_schedule')}
        </div>
      )}

      <ul className="mt-5 space-y-2">
        {sessions.length === 0 && wds.size > 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">{t('log_no_sessions_yet')}</li>
        )}
        {sessions.map(({ date, log }) => {
          const isEditing = editingDate === date
          const isActual = !!log
          const shuttleCount = isActual ? num(log.actual_shuttlecocks) : est
          const diff = shuttleCount - est
          const tone = diff > 0 ? 'red' : diff < 0 ? 'volt' : 'slate'
          const cost = isActual ? num(log.total_cost) : 0

          return (
            <li key={date} className={cx(
              'rounded-2xl border px-4 py-3 transition',
              isActual ? 'border-slate-100 bg-white' : 'border-dashed border-slate-200 bg-slate-50/60'
            )}>
              {isEditing ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-900">{fmtDate(date)}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="relative">
                      <input
                        type="number" min="0" step="0.5" autoFocus
                        className={cx(inputCls, 'font-mono')}
                        placeholder={`${t('log_actual')} (${est})`}
                        value={editForm.actual}
                        onChange={(e) => setEditForm((f) => ({ ...f, actual: e.target.value }))}
                      />
                    </div>
                    <input
                      className={inputCls}
                      placeholder={t('log_note_ph')}
                      value={editForm.note}
                      onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="volt" size="sm" className="flex-1" onClick={saveEdit} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> {t('save')}</>}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingDate(null)}>{t('cancel')}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className={cx(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm',
                    isActual ? 'bg-slate-100 text-slate-500' : 'bg-slate-100 text-slate-300'
                  )}>
                    <Calendar className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-sm font-semibold', isActual ? 'text-slate-900' : 'text-slate-400')}>{fmtDate(date)}</p>
                    {log?.note && <p className="truncate text-xs text-slate-400">{log.note}</p>}
                    {!isActual && <p className="text-xs text-slate-400">{t('log_estimated_default')}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {cost > 0 && <p className="font-mono text-sm font-black text-slate-900">{fmtVND(cost)}</p>}
                    {hasEquipment && (
                      <p className={cx('font-mono text-xs', isActual ? 'text-slate-500' : 'text-slate-300')}>
                        {shuttleCount} {t('log_shuttles')}
                        {!isActual && <span className="ml-1 text-slate-300">({t('log_est_tag')})</span>}
                      </p>
                    )}
                    {isActual && (
                      <Badge tone={tone === 'volt' ? 'volt' : tone === 'red' ? 'red' : 'slate'}>
                        {diff > 0 ? '+' : ''}{diff !== 0 ? diff : ''} {diff > 0 ? t('log_over') : diff < 0 ? t('log_under') : t('log_on_track')}
                      </Badge>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => startEdit(date, log)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
                        title={t('log_edit')}
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                      {isActual && (
                        <button
                          onClick={() => clearLog(log)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-400"
                          title={t('log_reset')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* ============================================================================
 *  ⑬ PLAN SIMULATOR (Free / Pro toggle in the host profile area)
 * ========================================================================== */
function PlanSimulator({ plan, canEdit, onChange }) {
  const { t } = useTranslation()
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-slate-400" />
        <h3 className="text-lg font-bold text-slate-900">{t('plan_simulate')}</h3>
      </div>
      <p className="mt-1 text-sm text-slate-500">{t('plan_simulate_hint')}</p>
      <div className={cx('mt-5 grid grid-cols-2 gap-3', !canEdit && 'pointer-events-none opacity-60')}>
        {[
          { id: 'free', label: t('plan_free'), icon: User },
          { id: 'pro', label: t('plan_pro'), icon: Crown },
        ].map((o) => {
          const active = plan === o.id
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className={cx(
                'flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition',
                active
                  ? o.id === 'pro' ? 'border-lime-400 bg-slate-900 text-white' : 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              )}
            >
              <span className={cx('grid h-9 w-9 place-items-center rounded-xl', active ? 'bg-lime-400 text-slate-900' : 'bg-slate-100 text-slate-500')}>
                <o.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-bold">{o.label}</span>
              {active && <Check className="ml-auto h-4 w-4 text-lime-400" strokeWidth={3} />}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/* ============================================================================
 *  ⑭ CLUB APP — the authenticated experience (sidebar + data wiring)
 * ========================================================================== */
function ClubApp({ session, club, role, setClub, myClubs, onSwitchClub, toast }) {
  const { t } = useTranslation()
  const isOwner = role === 'host'
  const [tab, setTab] = useState('dashboard')
  const [previewMember, setPreviewMember] = useState(false)
  const [settings, setSettings] = useState(null)
  const [members, setMembers] = useState([])
  const [logs, setLogs] = useState([])
  const [fundTxns, setFundTxns] = useState([])
  const [pollTally, setPollTally] = useState(null) // { count, source }
  const [loading, setLoading] = useState(true)
  const [upsell, setUpsell] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const canEdit = isOwner && !previewMember
  const plan = club.plan || 'free'
  const sport = SPORT_CONFIGS[club.sport_type] || SPORT_CONFIGS.badminton

  const DEFAULT_SETTINGS = {
    court_price_per_hour: 120000, hours_per_session: 2, sessions_per_week: 2,
    play_weekdays: [], quarter_start_month: Math.floor(new Date().getMonth() / 3) * 3 + 1,
    billing_cycle: 'month', price_per_box: 320000, estimated_shuttlecocks: 6, current_fund: 0, court_payment_mode: 'session',
  }

  const loadAll = useCallback(async () => {
    // settings
    const { data: s } = await supabase.from('club_settings').select('*').eq('club_id', club.id).maybeSingle()
    setSettings(s || { club_id: club.id, ...DEFAULT_SETTINGS })
    // members
    const { data: m } = await supabase.from('club_members').select('*').eq('club_id', club.id).order('created_at', { ascending: true })
    setMembers(m || [])
    // logs
    const { data: lg } = await supabase.from('session_logs').select('*').eq('club_id', club.id).order('played_on', { ascending: false })
    setLogs(lg || [])
    // fund transactions
    const { data: ft } = await supabase.from('fund_transactions').select('*').eq('club_id', club.id).order('created_at', { ascending: false })
    setFundTxns(ft || [])
    // cross-query membership_cycle poll tally (Ecosystem Collaboration Engine)
    const { data: v } = await supabase
      .from('votes').select('id').eq('club_id', club.id).eq('vote_type', 'membership_cycle')
      .order('created_at', { ascending: false }).limit(1)
    if (v && v.length) {
      const { data: rs } = await supabase
        .from('responses').select('attending,guests').eq('vote_id', v[0].id).eq('attending', true)
      const count = (rs || []).reduce((sum, r) => sum + 1 + (r.guests || 0), 0)
      setPollTally({ count, source: 'poll' })
    } else {
      setPollTally(null)
    }
    setLoading(false)
  }, [club.id])

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    loadAll()
    const ch = supabase
      .channel(`club-${club.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_settings', filter: `club_id=eq.${club.id}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_members', filter: `club_id=eq.${club.id}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs', filter: `club_id=eq.${club.id}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_transactions', filter: `club_id=eq.${club.id}` }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [club.id, loadAll])

  // member count: poll tally wins; else the registration list
  const memberCount = pollTally?.count ?? members.length
  const memberSource = pollTally?.source === 'poll' ? 'poll' : 'list'

  async function setPlan(next) {
    try {
      const { error } = await supabase.from('clubs').update({ plan: next }).eq('id', club.id)
      if (error) throw error
      setClub({ ...club, plan: next })
      toast(next === 'pro' ? t('plan_pro') : t('plan_free'))
    } catch (e) { toast(e.message || t('err_generic')) }
  }

  const tabs = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: LayoutDashboard },
    { id: 'settings', label: t('nav_settings'), icon: Settings2 },
    { id: 'log', label: t('nav_log'), icon: ClipboardList },
    { id: 'fund', label: t('nav_fund'), icon: History },
  ]

  if (loading || !settings) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 bg-grid relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cx(
        'fixed left-0 top-[65px] bottom-0 z-40 w-56 flex flex-col border-r border-slate-100 bg-white/90 backdrop-blur-xl transition-transform duration-200',
        'md:sticky md:h-[calc(100vh-4rem)] md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Club name strip */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-black text-lime-400">
              {club.name[0].toUpperCase()}
            </span>
            <span className="text-sm font-bold text-slate-900 truncate">{club.name}</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => { setTab(tb.id); setSidebarOpen(false) }}
              className={cx(
                'w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition',
                tab === tb.id
                  ? 'bg-lime-400/10 text-lime-700'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <tb.icon className={cx('h-4 w-4 shrink-0', tab === tb.id ? 'text-lime-600' : 'text-slate-400')} />
              {tb.label}
            </button>
          ))}
        </nav>

        {/* Invite link — host only */}
        {isOwner && (
          <div className="px-3 pb-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/join/${club.id}`)
                toast(t('join_copied'))
              }}
            >
              <LinkIcon className="h-3.5 w-3.5" /> {t('join_copy')}
            </Button>
          </div>
        )}

        {/* Bottom: plan status */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          {!canEdit && (
            <div className="flex items-center gap-2 px-1">
              <Eye className="h-3.5 w-3.5 text-cyan-600" />
              <span className="text-xs font-semibold text-cyan-700">{t('role_member')}</span>
            </div>
          )}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Badge tone={plan === 'pro' ? 'volt' : 'slate'} icon={plan === 'pro' ? Crown : Zap}>
                {plan === 'pro' ? t('plan_pro') : t('plan_free')}
              </Badge>
            </div>
            {plan === 'free' && isOwner && (
              <Button variant="volt" size="sm" className="mt-2.5 w-full text-xs" onClick={() => setUpsell(true)}>
                <Crown className="h-3 w-3" /> {t('sidebar_upgrade')}
              </Button>
            )}
            {plan === 'pro' && isOwner && (
              <Button variant="subtle" size="sm" className="mt-2.5 w-full text-xs" onClick={() => setPlan('free')}>
                {t('sidebar_switch_free')}
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-white/70 px-5 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-bold text-slate-900 truncate">{club.name}</h2>
          <div className="ml-auto">
            <Badge tone={plan === 'pro' ? 'volt' : 'slate'} icon={plan === 'pro' ? Crown : Zap}>
              {plan === 'pro' ? t('plan_pro') : t('plan_free')}
            </Badge>
          </div>
        </div>

        <div className="flex-1 px-5 py-8 pb-24 mx-auto w-full max-w-[1460px]">
          {/* Club header (desktop) */}
          <div className="hidden md:flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
                <Building2 className="h-6 w-6 text-slate-300" /> {club.name}
              </h1>
            </div>
          </div>

          {!canEdit && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
              <Eye className="h-4 w-4 shrink-0" /> {t('readonly_banner')}
            </div>
          )}

          {/* Tab content */}
          {tab === 'dashboard' && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ForecastDashboard
                  settings={settings}
                  memberCount={memberCount}
                  memberSource={memberSource}
                  plan={plan}
                  sport={sport}
                  canEdit={canEdit}
                  onUnlock={() => setUpsell(true)}
                  logs={logs}
                  fundTxns={fundTxns}
                />
              </div>
              <div className="space-y-6">
                <MembersPanel
                  club={club} members={members} plan={plan} pollTally={pollTally}
                  canEdit={canEdit} onChanged={loadAll} onHitLimit={() => setUpsell(true)} toast={toast}
                />
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SettingsPanel club={club} settings={settings} sport={sport} canEdit={canEdit} onSaved={(p) => setSettings({ ...settings, ...p })} toast={toast} />
              </div>
              <div className="space-y-6">
                <MembersPanel
                  club={club} members={members} plan={plan} pollTally={pollTally}
                  canEdit={canEdit} onChanged={loadAll} onHitLimit={() => setUpsell(true)} toast={toast}
                />
              </div>
            </div>
          )}

          {tab === 'log' && (
            <div className="mx-auto max-w-3xl">
              <SessionLog club={club} logs={logs} settings={settings} sport={sport} estimate={settings.estimated_shuttlecocks} canEdit={canEdit} onChanged={loadAll} toast={toast} />
            </div>
          )}

          {tab === 'fund' && (
            <div className="p-6">
              <FundHistory
                club={club}
                fundTxns={fundTxns}
                settings={settings}
                canEdit={canEdit}
                onTopUp={loadAll}
                toast={toast}
              />
            </div>
          )}
        </div>

        {/* <Footer /> */}
      </main>

      <UpsellModal
        open={upsell}
        clubId={club.id}
        onClose={() => setUpsell(false)}
        onUpgraded={() => setClub({ ...club, plan: 'pro' })}
        toast={toast}
      />
    </div>
  )
}

/* ============================================================================
 *  ⑮ FUND HISTORY — list of all fund top-ups
 * ========================================================================== */
function FundHistory({ club, fundTxns, settings, canEdit, onTopUp, toast }) {
  const { t } = useTranslation()
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const amt = num(amount)
    if (!amt || busy) return
    setBusy(true)
    try {
      const newFund = num(settings.current_fund) + amt
      const { error: e1 } = await supabase.from('fund_transactions').insert({
        club_id: club.id, amount: amt, note: note.trim() || null,
      })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('club_settings')
        .update({ current_fund: newFund }).eq('club_id', club.id)
      if (e2) throw e2
      toast(t('fund_added'))
      setAmount(''); setNote(''); setTopUpOpen(false)
      onTopUp()
    } catch (e) { toast(e.message || t('err_generic')) }
    finally { setBusy(false) }
  }

  const total = fundTxns.reduce((s, tx) => s + num(tx.amount), 0)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header + top-up button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">{t('fund_history_title')}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{t('fund_history_sub')}</p>
        </div>
        {canEdit && (
          <Button variant="volt" size="sm" onClick={() => setTopUpOpen((v) => !v)}>
            <Plus className="h-4 w-4" /> {t('fund_topup_btn')}
          </Button>
        )}
      </div>

      {/* Inline top-up form */}
      {topUpOpen && canEdit && (
        <div className="rounded-3xl border border-lime-200 bg-lime-50 p-5 space-y-3 animate-fade-in">
          <p className="font-semibold text-slate-800">{t('fund_topup_title')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <input
                type="number" min="0" autoFocus
                className={cx(inputCls, 'pr-10 font-mono')}
                placeholder={t('fund_topup_amount_ph')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
            </div>
            <input
              className={inputCls}
              placeholder={t('fund_topup_note_ph')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="volt" size="sm" className="flex-1" onClick={submit} disabled={busy || !amount}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> {t('fund_topup_submit')}</>}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setTopUpOpen(false); setAmount(''); setNote('') }}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Summary card */}
      <div className="flex items-center gap-4 rounded-3xl bg-slate-900 p-5 text-white">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime-400 text-slate-900">
          <Wallet className="h-6 w-6" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('fund_history_total')}</p>
          <p className="font-mono text-2xl font-black text-lime-400">{fmtVND(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">{t('dash_fund_live')}</p>
          <p className="font-mono text-lg font-black text-white">{fmtVND(num(settings.current_fund))}</p>
        </div>
      </div>

      {/* Transaction list */}
      <ul className="space-y-2">
        {fundTxns.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            {t('fund_history_empty')}
          </li>
        )}
        {fundTxns.map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lime-50 text-lime-600">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {tx.note || t('fund_topup_default_note')}
              </p>
              <p className="text-xs text-slate-400">{fmtDate(tx.created_at?.slice(0, 10))}</p>
            </div>
            <p className="font-mono text-base font-black text-lime-600">+{fmtVND(num(tx.amount))}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ============================================================================
 *  ⑯ PRE-JOIN PAGE — shown to unauthenticated users visiting /join/:clubId
 * ========================================================================== */
function PreJoinPage({ clubId, onGoogle, busy }) {
  const { t } = useTranslation()

  function handleSignIn() {
    localStorage.setItem('feetap_pending_join', clubId)
    onGoogle()
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm animate-fade-in rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-900/[0.06] text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-slate-900 text-3xl">
          🏅
        </div>
        <h1 className="text-xl font-black tracking-tight text-slate-900 mb-1">{t('join_pre_title')}</h1>
        <p className="text-slate-500 text-sm mb-6">{t('join_pre_sub')}</p>
        <Button variant="volt" className="w-full" onClick={handleSignIn} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('join_signin')}
        </Button>
      </div>
    </div>
  )
}

/* ============================================================================
 *  ⑯ WELCOME MODAL — shown after joining a club
 * ========================================================================== */
function WelcomeModal({ clubId, myClubs, onClose }) {
  const { t } = useTranslation()
  const club = myClubs.find((c) => c.id === clubId)
  const sport = SPORT_CONFIGS[club?.sport_type] || SPORT_CONFIGS.badminton

  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  if (!club) return null

  return (
    <Modal onClose={onClose}>
      <div className="text-center py-4">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-slate-900 text-3xl">
          {sport.emoji}
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">{t('join_welcome')}</h2>
        <p className="text-slate-500 text-sm mb-1">{t('join_pre_sub')}</p>
        <p className="font-bold text-slate-900 mb-6">{club.name}</p>
        <Button variant="volt" onClick={onClose}>{t('close')}</Button>
      </div>
    </Modal>
  )
}

/* ============================================================================
 *  ⑰ ROOT — URL router + auth gate + multi-club resolution
 *
 *  Routes:
 *    /            → all clubs picker (logged-in) or sign-in page
 *    /club/:id    → ClubApp for that specific club
 *    /new         → Onboarding (create a new club)
 *    /join/:id    → PreJoinPage (unauthenticated) or auto-join (authenticated)
 * ========================================================================== */

// Tiny History API router — no react-router dependency.
function usePath() {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const handler = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])
  return path
}

function navigate(to) {
  window.history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const { t } = useTranslation()
  const path = usePath()

  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [myClubs, setMyClubs] = useState([])      // all clubs user has access to
  const [role, setRole] = useState(null)           // 'host' | 'member'
  const [resolving, setResolving] = useState(false)
  const [signinBusy, setSigninBusy] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const [welcomeClubId, setWelcomeClubId] = useState(null)
  const toastTimer = useRef(null)

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }, [])

  // Parse route
  const clubIdFromPath = path.startsWith('/club/') ? path.slice(6) : null
  const isNewPath = path === '/new'
  const joinClubId = path.startsWith('/join/') ? path.slice(6) : null

  // ── auth session ───────────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // ── load all clubs user has access to (owned + member, in parallel) ──
  useEffect(() => {
    if (!session) { setMyClubs([]); setRole(null); return }
    let cancelled = false
    ;(async () => {
      setResolving(true)
      try {
        const uid = session.user.id

        // Fetch owned clubs + member rows in parallel
        const [{ data: owned }, { data: memRows }] = await Promise.all([
          supabase.from('clubs').select('*').eq('owner_id', uid).order('created_at', { ascending: true }),
          supabase.from('club_members').select('club_id').eq('user_id', uid),
        ])

        const ownedClubs = (owned || []).map((c) => ({ ...c, userRole: 'host' }))
        const ownedIds = new Set(ownedClubs.map((c) => c.id))

        // Fetch club details for member rows that aren't already owned
        const memberOnlyIds = (memRows || []).map((r) => r.club_id).filter((id) => !ownedIds.has(id))
        let memberClubs = []
        if (memberOnlyIds.length) {
          const { data: mclubs } = await supabase.from('clubs').select('*').in('id', memberOnlyIds)
          memberClubs = (mclubs || []).map((c) => ({ ...c, userRole: 'member' }))
        }

        if (cancelled) return

        const all = [...ownedClubs, ...memberClubs]
        setMyClubs(all)
        // Global role: host if owns any club, else member
        setRole(ownedClubs.length ? 'host' : memberClubs.length ? 'member' : null)

        // Consume pending join from localStorage (set before OAuth redirect)
        const pendingJoin = localStorage.getItem('feetap_pending_join')
        if (pendingJoin) {
          localStorage.removeItem('feetap_pending_join')
          if (!cancelled) {
            setResolving(false)
            await handleJoin(pendingJoin, s)
          }
          return
        }

        // Auto-redirect: exactly 1 club total → go straight to it
        if (path === '/' && all.length === 1) {
          navigate(`/club/${all[0].id}`)
          return
        }
        // No clubs at all → onboarding
        if (all.length === 0 && path !== '/new' && !path.startsWith('/join/')) {
          navigate('/new')
        }
      } finally {
        if (!cancelled) setResolving(false)
      }
    })()
    return () => { cancelled = true }
  }, [session])

  // Keep myClubs in sync when plan/name changes
  function updateClub(updated) {
    setMyClubs((prev) => prev.map((c) => c.id === updated.id ? updated : c))
  }

  function selectClub(club) {
    if (club === 'new') { navigate('/new'); return }
    navigate(`/club/${club.id}`)
  }

  async function signInGoogle() {
    setSigninBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    } catch (e) {
      toast(e.message || t('err_generic'))
      setSigninBusy(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null); setMyClubs([]); setRole(null)
    navigate('/')
  }

  async function handleJoin(clubId, sess = session) {
    if (!sess || !clubId) return
    try {
      const { error } = await supabase.from('club_members').upsert(
        { club_id: clubId, user_id: sess.user.id, name: sess.user.user_metadata?.full_name || sess.user.email },
        { onConflict: 'club_id,user_id', ignoreDuplicates: true }
      )
      if (error) throw error
      // Reload clubs so the joined club appears
      const { data: clubData } = await supabase.from('clubs').select('*').eq('id', clubId).single()
      if (clubData) {
        const newClub = { ...clubData, userRole: 'member' }
        setMyClubs((prev) => prev.some((c) => c.id === clubId) ? prev : [...prev, newClub])
      }
      setWelcomeClubId(clubId)
      navigate(`/club/${clubId}`)
    } catch (e) {
      toast(e.message || t('err_generic'))
    }
  }

  // ── auto-join when logged-in user visits /join/:id ────────────
  useEffect(() => {
    if (session && joinClubId && !resolving) {
      handleJoin(joinClubId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, joinClubId, resolving])

  // ── active club for the current URL ───────────────────────────
  const activeClub = clubIdFromPath ? (myClubs.find((c) => c.id === clubIdFromPath) ?? null) : null

  // ── render ─────────────────────────────────────────────────────
  const loading = !authReady || (session && resolving)
  let body

  if (loading) {
    body = (
      <div className="grid flex-1 place-items-center">
        <div className="flex items-center gap-3 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}</div>
      </div>
    )
  } else if (!session) {
    if (joinClubId) {
      body = <PreJoinPage clubId={joinClubId} onGoogle={signInGoogle} busy={signinBusy} />
    } else {
      body = <SignInPage onGoogle={signInGoogle} busy={signinBusy} />
    }
  } else if (isNewPath) {
    body = (
      <Onboarding
        session={session}
        toast={toast}
        onClubReady={(c) => {
          const clubWithRole = { ...c, userRole: 'host' }
          setMyClubs((prev) => [...prev, clubWithRole])
          if (role !== 'host') setRole('host')
          navigate(`/club/${c.id}`)
        }}
      />
    )
  } else if (clubIdFromPath) {
    if (!activeClub && !resolving) {
      // club ID not in myClubs — could be still loading or invalid
      body = (
        <div className="grid flex-1 place-items-center">
          <div className="text-center">
            <p className="text-slate-400 mb-4">{t('club_not_found')}</p>
            <Button variant="ghost" onClick={() => navigate('/')}>{t('club_back')}</Button>
          </div>
        </div>
      )
    } else if (activeClub) {
      body = (
        <ClubApp
          session={session}
          club={activeClub}
          role={activeClub.userRole}
          setClub={updateClub}
          myClubs={myClubs}
          onSwitchClub={selectClub}
          toast={toast}
        />
      )
    } else {
      body = (
        <div className="grid flex-1 place-items-center">
          <div className="flex items-center gap-3 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}</div>
        </div>
      )
    }
  } else if (joinClubId) {
    // Logged-in user visiting /join/:id — trigger auto-join immediately
    body = (
      <div className="grid flex-1 place-items-center">
        <div className="flex items-center gap-3 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}</div>
      </div>
    )
    // Kick off join — effect via useEffect to avoid render-time side effects
  } else {
    // path === '/' — all clubs picker
    body = (
      <ClubPicker
        myClubs={myClubs}
        onSelect={selectClub}
        onCreateNew={() => navigate('/new')}
      />
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50 text-slate-900 antialiased">
      <Nav
        session={session}
        myClubs={myClubs}
        activeClub={activeClub}
        role={role}
        onSignOut={signOut}
        onSelectClub={selectClub}
      />
      {!isConfigured && <ConfigWarning />}
      {body}
      {welcomeClubId && (
        <WelcomeModal
          clubId={welcomeClubId}
          myClubs={myClubs}
          onClose={() => setWelcomeClubId(null)}
        />
      )}
      <Toast toast={toastMsg} />
    </div>
  )
}
