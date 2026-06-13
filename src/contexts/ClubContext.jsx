import { createContext, useContext } from 'react'

export const ClubContext = createContext(null)

export function useClub() {
  const ctx = useContext(ClubContext)
  if (!ctx) throw new Error('useClub must be used inside ClubLayout')
  return ctx
}
