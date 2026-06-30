import { useTranslation } from 'react-i18next'
import {
  Loader2, ShieldCheck, CircleDollarSign,
  LineChart, QrCode, Eye, ShoppingBag,
  TrendingUp, Check, ArrowRight, ChevronDown,
} from 'lucide-react'
import { Footer } from '../components/layout/Nav'
import { GraphGlyph } from '../components/charts/GraphGlyph'
import { isConfigured } from '../lib/supabase'
import { cx } from '../lib/utils'

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

// Mock product dashboard card for shops — mirrors the fund card aesthetic
function FundCard({ className = '' }) {
  const { t } = useTranslation()
  const line = 'M0 46 L26 38 L52 41 L78 28 L104 32 L130 16 L150 11'
  return (
    <div className={cx('rounded-3xl border border-white/15 bg-black/30 p-4 shadow-2xl shadow-black/40 backdrop-blur-2xl', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{t('hero_card_label')}</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-white">+ 4.820.000 ₫</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-lime-400/15 px-2 py-1 text-[11px] font-bold text-lime-300">
          <TrendingUp className="h-3 w-3" /> 18,4%
        </span>
      </div>
      <svg viewBox="0 0 150 52" className="mt-2 w-full" fill="none" aria-hidden>
        <defs>
          <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ccff00" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ccff00" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={line + ' L150 52 L0 52 Z'} fill="url(#heroFill)" />
        <path d={line} stroke="#ccff00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="150" cy="11" r="3.5" fill="#ccff00" />
      </svg>
      <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-white/65">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-lime-400 text-slate-900">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        {t('hero_stat_paid')}
      </div>
    </div>
  )
}

// QR auto-generate + bank auto-detect card
function QRStatusCard({ className = '' }) {
  const qrGrid = [
    [1,1,1,0,0,1,1,1,1],
    [1,0,1,0,1,0,0,0,1],
    [1,1,1,0,0,1,0,1,1],
    [0,0,0,1,0,0,1,0,0],
    [1,0,1,0,1,1,0,1,0],
    [0,1,0,1,0,0,0,0,1],
    [1,1,1,0,1,0,0,1,1],
    [1,0,0,0,0,1,1,0,0],
    [1,1,0,1,0,0,1,1,1],
  ]
  const members = [
    { name: 'A. Tuấn',  done: true },
    { name: 'M. Khôi',  done: true },
    { name: 'T. Linh',  done: false },
  ]
  return (
    <div className={cx('rounded-3xl flex flex-col justify-between border border-white/15 bg-black/30 p-3.5 shadow-2xl shadow-black/40 backdrop-blur-2xl', className)}>
      <div className=" ">
        {/* QR code visual */}
        <div className="relative shrink-0">
          <div className="rounded-xl bg-white p-1.5 w-fit mx-auto">
            <svg viewBox="0 0 36 36" className="h-[90px] w-50 mx-auto" fill="#0f172a" aria-hidden>
              {qrGrid.map((row, ri) =>
                row.map((cell, ci) =>
                  cell ? <rect key={`${ri}-${ci}`} x={ci * 4} y={ri * 4} width="3.5" height="3.5" /> : null
                )
              )}
            </svg>
          </div>
        </div>
        {/* Payment status list */}
        <div className="flex-1 pt-0.5">
          {members.map((m) => (
            <div key={m.name} className="flex items-center justify-between py-[3px]">
              <span className="text-[11px] font-medium text-white/70">{m.name}</span>
              {m.done ? (
                <span className="flex items-center gap-0.5 font-mono text-[11px] font-semibold text-lime-300">
                  <Check className="h-3 w-3" strokeWidth={3} /> 150k
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-white/30">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                  pending
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto flex items-center gap-1.5 border-t border-white/10 pt-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400 shadow-[0_0_6px_#ccff00]" />
        <span className="text-[10px] font-medium text-white/40">Auto QR · Auto-detect Banking</span>
      </div>
    </div>
  )
}

// Shop view: fund status of each club customer
function ShopFundCard({ className = '' }) {
  const clubs = [
    { name: 'CLB A', pct: 64, amount: '4 hộp' },
    { name: 'CLB B',  pct: 35, amount: '3 hộp' },
    { name: 'CLB C', pct: 18, amount: '1 hộp' },
  ]
  return (
    <div className={cx('rounded-3xl border border-white/15 bg-black/30 p-3.5 shadow-2xl shadow-black/40 backdrop-blur-2xl', className)}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <ShoppingBag className="h-3.5 w-3.5 text-lime-300" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Quỹ khách hàng</span>
      </div>
      <p className="mb-2.5 text-[10px] leading-relaxed text-white/40">Shop cầu lông có thể check được hộp cầu tồn kho của nhiều câu lạc bộ</p>
      <div className="space-y-2">
        {clubs.map((c) => (
          <div key={c.name}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium text-white/75">{c.name}</span>
              <span className="font-mono text-[11px] text-white/50">{c.amount}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-lime-400" style={{ width: `${c.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SignInPage({ onGoogle, busy }) {
  const { t } = useTranslation()

  const features = [
    { icon: LineChart, t: 'feat_forecast_t', d: 'feat_forecast_d' },
    { icon: QrCode,    t: 'feat_collect_t',  d: 'feat_collect_d' },
    { icon: Eye,       t: 'feat_transparent_t', d: 'feat_transparent_d' },
    { icon: ShoppingBag, t: 'feat_shop_t',   d: 'feat_shop_d' },
  ]

  const steps = [
    { t: 'how_1_t', d: 'how_1_d' },
    { t: 'how_2_t', d: 'how_2_d' },
    { t: 'how_3_t', d: 'how_3_d' },
  ]

  const GoogleBtn = (
    <button
      onClick={onGoogle}
      disabled={busy || !isConfigured}
      className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-700 shadow-lg shadow-slate-900/[0.04] transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon className="h-5 w-5" />}
      {t('signin_google')}
    </button>
  )

  return (
    <main className="flex-1">
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section>

        {/* ── DESKTOP: full-bleed photo, horizontal glass bar at bottom-left ── */}
        <div className="relative hidden overflow-hidden lg:block lg:min-h-[calc(100svh-4rem)]">
          {/* Raw photo — no dark overlay */}
          <img
            src="/spofund-banner.webp"
            alt="SpoFund"
            className="absolute inset-0 h-full w-full object-cover object-[55%_25%]"
          />

          {/* Frosted glass bar — horizontal strip, bottom-left */}
          <div className="absolute bottom-10 left-10 space-y-7 max-w-[80vw] animate-fade-in items-center gap-7 rounded-[1.75rem] border border-white/20 bg-black/35 px-6 py-5 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            {/* Left: badge + headline */}
            <div className="min-w-0 flex-1 max-w-[500px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
                <CircleDollarSign className="h-3.5 w-3.5 text-lime-300" />
                {t('hero_badge')}
              </span>
              <h1 className="mt-3 text-[32px] font-black leading-tight tracking-tight text-white">
                {t('hero_title_1')}{' '}
                <span className="relative inline-block">
                  <span className="relative z-10">{t('hero_title_hl')}</span>
                  <span className="absolute -bottom-0.5 left-0 z-0 h-2.5 w-full -rotate-1 bg-lime-400/75" />
                </span>
                {t('hero_title_2')}
              </h1>
            </div>
            {/* Right: CTA + chip */}
            <div className="w-full shrink-0">
              {GoogleBtn}
              {/* <div className="mt-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white">
                  <Check className="h-3 w-3 text-lime-300" strokeWidth={3} />
                  {t('hero_chip_free')}
                </span>
              </div> */}
            </div>
          </div>

          {/* Card stack — top right */}
          <div className="absolute right-10 top-6 grid w-[300px] grid-rows-3 gap-2 h-[calc(100vh-200px)] min-h-[660px]">
            <FundCard className="animate-rise [animation-delay:200ms]" />
            <QRStatusCard className="animate-rise [animation-delay:350ms]" />
            <ShopFundCard className="animate-rise [animation-delay:500ms]" />
          </div>
        </div>

        {/* ── MOBILE: photo stacked above text, fully separate ── */}
        <div className="lg:hidden">
          {/* Photo block — full width, fixed aspect */}
          <img
            src="/spofund-banner.webp"
            alt="SpoFund"
            className="aspect-[4/3] w-full object-cover object-[50%_22%]"
          />

          {/* Text content — clean white section below photo */}
          <div className="bg-white px-5 py-9">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-lime-300">
              <CircleDollarSign className="h-3.5 w-3.5" />
              {t('hero_badge')}
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-slate-900">
              {t('hero_title_1')}{' '}
              <span className="relative inline-block">
                <span className="relative z-10">{t('hero_title_hl')}</span>
                <span className="absolute -bottom-0.5 left-0 z-0 h-3 w-full -rotate-1 bg-lime-300/70" />
              </span>
              {t('hero_title_2')}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-500">{t('hero_sub')}</p>
            <div className="mt-7">{GoogleBtn}</div>
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
              <ShieldCheck className="h-4 w-4 text-lime-500" />
              {t('signin_note')}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['hero_chip_free', 'hero_chip_card'].map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <Check className="h-3.5 w-3.5 text-lime-500" strokeWidth={3} />
                  {t(k)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────── */}
      <section className="bg-grid mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-5 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.t}
              className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-7 transition hover:border-slate-200 hover:shadow-xl hover:shadow-slate-900/[0.04]"
            >
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

      {/* ─── How it works ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 bg-grid-dark px-6 py-12 sm:px-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-10 left-1/4 h-56 w-72 rounded-full bg-lime-400/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t('how_title')}</h2>
            <p className="mt-3 text-slate-400">{t('how_sub')}</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <div key={s.t} className="relative rounded-3xl border border-slate-700/60 bg-slate-800/40 p-6">
                  <span className="font-mono text-sm font-bold text-lime-400">0{i + 1}</span>
                  <h3 className="mt-3 text-lg font-bold text-white">{t(s.t)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{t(s.d)}</p>
                  {i < steps.length - 1 && (
                    <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-600 md:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{t('cta_title')}</h2>
          <p className="mt-3 text-slate-500">{t('cta_sub')}</p>
          <div className="mx-auto mt-8 max-w-sm">{GoogleBtn}</div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
