// Safe accessor for the Telegram WebApp SDK — returns null on server or when
// the SDK hasn't been injected (i.e. outside a Telegram Mini App context).
export const getTg = () =>
  typeof window !== 'undefined' ? window.Telegram?.WebApp ?? null : null
