import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, ChevronDown, Check, Plus, LogOut, AlertTriangle } from 'lucide-react'
import { cx } from '../../lib/utils'
import { navigate } from '../../router'

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

export { Logo }

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

export function Nav({ session, myClubs, activeClub, onSignOut, onSelectClub }) {
  const { t } = useTranslation()
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/70 backdrop-blur-xl">
      <div className={`mx-auto flex h-16 items-center gap-3 px-5 ${session ? '' : 'max-w-[1350px]'}`}>
        <Logo onClick={() => navigate('/')} />

        {activeClub && myClubs?.length > 0 ? (
          <div className="flex-1 flex justify-center">
            <ClubSwitcher myClubs={myClubs} activeClub={activeClub} onSelectClub={onSelectClub} />
          </div>
        ) : (
          <div className="flex-1" />
        )}

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

export function ConfigWarning() {
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

export function Footer() {
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
