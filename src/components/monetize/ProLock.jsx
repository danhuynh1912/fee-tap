import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'

export function ProLock({ onClick, label }) {
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
