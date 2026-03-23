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

export function getRarityStyle(rarity) {
  const styles = {
    secret: { border: '#e2e8f0', text: '#f8fafc', bg: '#0a0a0a', glow: 'rgba(200,200,200,0.35)' },
    brainrot_god: { border: '#ff0080', text: '#ffb3d9', bg: '#2d0020', glow: 'rgba(255,0,128,0.4)' },
    mythic: { border: '#ef4444', text: '#fecaca', bg: '#450a0a', glow: 'rgba(239,68,68,0.4)' },
    legendary: { border: '#f59e0b', text: '#fde68a', bg: '#78350f', glow: 'rgba(245,158,11,0.35)' },
    epic: { border: '#a78bfa', text: '#ede9fe', bg: '#4c1d95', glow: 'rgba(167,139,250,0.3)' },
    rare: { border: '#60a5fa', text: '#dbeafe', bg: '#1e3a5f', glow: 'rgba(96,165,250,0.3)' },
    common: { border: '#4ade80', text: '#dcfce7', bg: '#14532d', glow: 'rgba(74,222,128,0.25)' },
    unique: { border: '#f59e0b', text: '#fde68a', bg: '#78350f', glow: 'rgba(245,158,11,0.35)' },
  }
  return styles[rarity?.toLowerCase()] || styles.common
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
export const withTimeout = (promise, ms = 20000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms)
    )
  ])
