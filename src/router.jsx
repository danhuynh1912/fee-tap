'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

// usePath: SSR-safe version of the old window.location.pathname approach.
// Seeds the initial value from usePathname() (works on server), then listens
// for popstate so fake SPA navigation (pushState) still triggers re-renders
// without remounting the App component tree.
export function usePath() {
  const serverPath = usePathname()
  const [path, setPath] = useState(serverPath)

  useEffect(() => {
    const handler = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  return path
}

// Imperative navigation — keeps the SPA pattern (no Next.js page remount).
export function navigate(to) {
  window.history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Match a path against a pattern with named params.
 * Pattern examples: '/club/:id', '/club/:id/settings'
 * Returns { params } on match, null on miss.
 */
export function matchPath(pattern, path) {
  const patParts = pattern.split('/')
  const pathParts = path.split('/')
  if (patParts.length !== pathParts.length) return null
  const params = {}
  for (let i = 0; i < patParts.length; i++) {
    if (patParts[i].startsWith(':')) {
      params[patParts[i].slice(1)] = decodeURIComponent(pathParts[i])
    } else if (patParts[i] !== pathParts[i]) {
      return null
    }
  }
  return { params }
}
