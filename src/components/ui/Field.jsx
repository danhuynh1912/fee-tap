export const inputCls =
  'w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5'

export function Field({ label, icon: Icon, hint, children }) {
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
