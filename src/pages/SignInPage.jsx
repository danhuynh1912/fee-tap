import { useTranslation } from 'react-i18next'
import { Loader2, ShieldCheck, CircleDollarSign, LineChart, Users, Gauge } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Footer } from '../components/layout/Nav'
import { AnalyticsHero } from '../components/charts/AnalyticsHero'
import { GraphGlyph } from '../components/charts/GraphGlyph'
import { isConfigured } from '../lib/supabase'

function GoogleIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.5-.2-2.6-.4-3.5z"
      />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 16 2 9.1 6.6 6.3 14.7z" />
      <path
        fill="#4CAF50"
        d="M24 46c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.6 36.5 26.9 37.5 24 37.5c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9 41.4 15.9 46 24 46z"
      />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.9 35.6 46 30.3 46 24c0-1.5-.2-2.6-.4-3.5z" />
    </svg>
  )
}

export function SignInPage({ onGoogle, busy }) {
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
          <div className="animate-fade-in">
            <Badge tone="dark" icon={CircleDollarSign}>
              {t('hero_badge')}
            </Badge>
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

          <div className="animate-fade-in [animation-delay:120ms]">
            <AnalyticsHero />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-5 md:grid-cols-3">
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
      <Footer />
    </main>
  )
}
