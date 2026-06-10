import { useState, useEffect } from 'react'

export function useCountdown(deadlineIso) {
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  if (!deadlineIso) return { closed: false, label: '' }
  const ms = new Date(deadlineIso).getTime() - Date.now()
  if (ms <= 0) return { closed: true, label: 'Closed' }
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const label =
    d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`
  return { closed: false, label }
}
