'use client'
import '../../src/i18n.js'

// Initializes i18n for all /club/* RSC routes (vote, pay).
// AppShell already does this for the SPA catch-all; this covers the dedicated routes.
export default function ClubPublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
