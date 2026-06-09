import { CheckCircle2 } from 'lucide-react'

export function Toast({ toast }) {
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
