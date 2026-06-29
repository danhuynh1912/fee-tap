'use client'

import dynamic from 'next/dynamic'
import { HelmetProvider } from 'react-helmet-async'
import '../../src/i18n.js'

// The app is a client-rendered SPA built around a window-based router, Supabase
// Realtime, and the Telegram WebApp SDK — none of which can run on the server.
// We render it client-only; Next still serves the server <head> (metadata).
const App = dynamic(() => import('../../src/App.jsx'), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-screen place-items-center bg-slate-50/50">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
    </div>
  ),
})

export default function AppShell() {
  return (
    <HelmetProvider>
      <App />
    </HelmetProvider>
  )
}
