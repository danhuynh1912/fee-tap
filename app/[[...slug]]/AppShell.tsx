'use client'

import dynamic from 'next/dynamic'
import { HelmetProvider } from 'react-helmet-async'
import '../../src/i18n.js'

// App renders a loading spinner on server (auth state is client-only).
// Individual public pages can be extracted to dedicated RSC routes for instant content.
const App = dynamic(() => import('../../src/App.jsx'), {
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
