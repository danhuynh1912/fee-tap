import { PieChart } from 'lucide-react'
import { Skeleton } from '../ui/Skeleton'
import { Card } from '../ui/Card'

function HeroCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-900 bg-grid-dark p-6 sm:p-8 text-white">
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-400">
          <PieChart className="h-4 w-4" />
          <Skeleton tone="dark" className="h-3 w-24" />
        </div>
        <Skeleton tone="dark" className="h-6 w-28 rounded-full" />
      </div>

      <div className="relative mt-5">
        <Skeleton tone="dark" className="h-3 w-32" />
        <Skeleton tone="dark" className="mt-2 h-11 w-56" />
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sm:flex-1 min-w-[120px] rounded-2xl bg-slate-800/60 px-3 py-3 sm:px-4">
            <Skeleton tone="dark" className="h-2.5 w-16" />
            <Skeleton tone="dark" className="mt-2 h-4 w-20" />
            <Skeleton tone="dark" className="mt-1.5 h-2 w-14" />
          </div>
        ))}
      </div>

      <div className="relative mt-5">
        <div className="flex items-center justify-between mb-1.5">
          <Skeleton tone="dark" className="h-2.5 w-24" />
          <Skeleton tone="dark" className="h-2.5 w-16" />
        </div>
        <Skeleton tone="dark" className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-900/[0.03] overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="p-4 space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}

function SideCardSkeleton({ rows = 4 }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <ul className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            <Skeleton className="h-4 flex-1" />
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <HeroCardSkeleton />
        <TimelineSkeleton />
      </div>
      <div className="space-y-6">
        <SideCardSkeleton rows={3} />
        <SideCardSkeleton rows={4} />
      </div>
    </div>
  )
}

export function GenericPageSkeleton() {
  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
      <Card className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-24 w-full" />
      </Card>
    </div>
  )
}

// Single entry point so every loading stage (auth resolving, route chunk
// loading, per-club data fetching) renders the exact same skeleton for a
// given tab — keeps proportions consistent across the whole init sequence.
export function TabContentSkeleton({ tab }) {
  if (tab === 'dashboard') return <DashboardSkeleton />
  return <GenericPageSkeleton />
}
