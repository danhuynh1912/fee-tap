import { cx } from '../../lib/utils'

// tone="dark" for use on dark panels (e.g. HeroCard's slate-900 background)
export function Skeleton({ className = '', tone = 'light' }) {
  return <div className={cx('animate-pulse rounded-lg', tone === 'dark' ? 'bg-slate-700/50' : 'bg-slate-200/70', className)} />
}
