import { Info } from 'lucide-react'

export function InfoTip({ children }) {
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
