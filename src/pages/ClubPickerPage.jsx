import { useTranslation } from 'react-i18next'
import { Crown, User, Plus, ChevronRight, Building2, Users, Sparkles, Zap } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { navigate } from '../router'

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

export function ClubPickerPage({ myClubs, onSelect }) {
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

          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{t('picker_hosted')}</h3>
              </div>
              <button
                onClick={() => navigate('/new')}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" /> {t('picker_new_btn')}
              </button>
            </div>

            {hostedClubs.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {hostedClubs.map((c) => <ClubCard key={c.id} club={c} onSelect={onSelect} />)}
                <button
                  onClick={() => navigate('/new')}
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
                  onClick={() => navigate('/new')}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-lime-400 transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" /> {t('picker_create')}
                </button>
              </div>
            )}
          </section>

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
    </main>
  )
}
