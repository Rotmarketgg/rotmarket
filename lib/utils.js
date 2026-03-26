export function timeAgo(date) {
  if (!date) return ''
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 0) return 'just now'  // future date guard
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

export function formatPrice(price) {
  if (price === null || price === undefined) return 'Trade Only'
  return `$${Number(price).toFixed(2)}`
}

// Text colors differ slightly from border colors for legibility on dark backgrounds.
// RARITY_STYLES (lib/constants.js) is the authoritative source for border/bg/glow.
const RARITY_TEXT = {
  secret: '#f8fafc', brainrot_god: '#ffb3d9', mythic: '#fecaca',
  legendary: '#fde68a', epic: '#ede9fe', rare: '#dbeafe',
  common: '#dcfce7', unique: '#fde68a',
}

export function getRarityStyle(rarity) {
  const { RARITY_STYLES } = require('@/lib/constants')
  const key = rarity?.toLowerCase()
  const canonicalKey = key === 'unique' ? 'legendary' : key
  const style = RARITY_STYLES[canonicalKey] || RARITY_STYLES['common']
  return { ...style, text: RARITY_TEXT[key] || style.border }
}

export function getInitial(username) {
  return (username || '?')[0].toUpperCase()
}

export function validateListing({ title, game, rarity, type, accepts, price }) {
  const errors = {}
  if (!title || title.trim().length < 3) errors.title = 'Title must be at least 3 characters'
  if (!game) errors.game = 'Select a game'
  if (!rarity) errors.rarity = 'Select a rarity'
  if (!type) errors.type = 'Select listing type'
  if (type === 'sale' && (!accepts || accepts.length === 0)) errors.accepts = 'Select at least one payment method'
  if (type === 'sale' && (!price || price <= 0)) errors.price = 'Enter a price for sale listings'
  return errors
}


// ─── CLIENT-SIDE RATE LIMIT PRE-CHECK ───────────────────────────
// Client-side UX pre-check only — gives instant feedback before the request hits the DB.
// NOT a security control. The real enforcement is in DB triggers and RLS.
// subKey lets you scope per-target (e.g. reportee's ID for reports).

const RATE_LIMITS = {
  listing:       { key: 'rl_listing',     windowMs: 900_000,     max: 1,  msg: 'Please wait 15 minutes before posting another listing.' },
  listing_daily: { key: 'rl_listing_day', windowMs: 86_400_000,  max: 3,  msg: 'You have reached your daily listing limit (3). Verified Traders get 5/day, VIP members get 10/day — and up to 30-day listing lifetime.' },
  dispute:       { key: 'rl_dispute',     windowMs: 3_600_000,   max: 1,  msg: 'You can only open 1 dispute per hour.' },
  report:        { key: 'rl_report',      windowMs: 600_000,     max: 1,  msg: 'You already reported this user recently. Please wait 10 minutes.' },
  offer:         { key: 'rl_offer',       windowMs: 3_600_000,   max: 10, msg: 'You can only send 10 offers per hour.' },
}

export function checkRateLimit(type, subKey = '') {
  if (typeof window === 'undefined') return null
  const limit = RATE_LIMITS[type]
  if (!limit) return null
  const storageKey = `${limit.key}${subKey ? '_' + subKey : ''}`
  const now = Date.now()
  let history = []
  try { history = JSON.parse(sessionStorage.getItem(storageKey) || '[]') } catch { history = [] }
  history = history.filter(t => now - t < limit.windowMs)
  if (history.length >= limit.max) return limit.msg
  history.push(now)
  try { sessionStorage.setItem(storageKey, JSON.stringify(history)) } catch {}
  return null
}

// ─── TIMEOUT HELPER ──────────────────────────────────────────────
// Wrap any promise with a timeout. Used on all DB calls to prevent
// infinite loading states when Supabase is slow or unreachable.
//
// Default: 20s for normal loads.
// Pass ms=8000 for tab-return silent refreshes — if the connection is still
// dead after our 600ms delay, we want a fast failure (8s) so the user sees
// a quick retry rather than a 20s frozen page.
export const withTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms)
    )
  ])
