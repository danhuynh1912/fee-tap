import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://YOUR-PROJECT-ref.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'YOUR-ANON-PUBLIC-KEY'

export const isConfigured =
  SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('YOUR-PROJECT') && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR-ANON')

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
