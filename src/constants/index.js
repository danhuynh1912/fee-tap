export const FREE_MEMBER_LIMIT = 15
export const BALLS_PER_BOX = 12
export const PRO_PRICE_VND = 99000
export const WEEKS_IN = { month: 4, quarter: 12 }

export const SPORT_CONFIGS = {
  badminton:   { id: 'badminton',   labelKey: 'sport_badminton',   emoji: '🏸', hasEquipment: true },
  football:    { id: 'football',    labelKey: 'sport_football',    emoji: '⚽', hasEquipment: false },
  basketball:  { id: 'basketball',  labelKey: 'sport_basketball',  emoji: '🏀', hasEquipment: false },
  volleyball:  { id: 'volleyball',  labelKey: 'sport_volleyball',  emoji: '🏐', hasEquipment: false },
  tabletennis: { id: 'tabletennis', labelKey: 'sport_tabletennis', emoji: '🏓', hasEquipment: false },
  pickleball:  { id: 'pickleball',  labelKey: 'sport_pickleball',  emoji: '🎾', hasEquipment: false },
}

export const SPORT_LIST = Object.values(SPORT_CONFIGS)

export const DEFAULT_SESSION_CONFIG = {
  court_price_per_hour: 120000,
  hours_per_session: 2,
  court_payment_mode: 'session',
  billing_cycle: 'month',
  quarter_start_month: 1,
}

export const DEFAULT_SETTINGS = {
  // flat fields kept for backward-compat fallback
  court_price_per_hour: 120000,
  court_prices_by_weekday: {},
  hours_per_session: 2,
  sessions_per_week: 2,
  play_weekdays: [],
  quarter_start_month: Math.floor(new Date().getMonth() / 3) * 3 + 1,
  billing_cycle: 'month',
  price_per_box: 320000,
  estimated_shuttlecocks: 6,
  current_fund: 0,
  court_payment_mode: 'session',
  session_configs: [],
}
