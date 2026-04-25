// ─── STATIC DEFAULTS ─────────────────────────────────────────────
// These are used as fallbacks when the DB site_config table is unavailable.
// The admin panel can override these via /api/admin/site-config.

export const DEFAULT_GAMES = [
  { id: 'fortnite', label: 'Fortnite Brainrot', emoji: '🎮', color: '#4ade80', enabled: true },
  { id: 'roblox', label: 'Roblox Brainrot', emoji: '🟥', color: '#ef4444', enabled: true },
]

export const DEFAULT_RARITIES = {
  fortnite: [
    { id: 'secret', label: 'Secret', color: '#e2e8f0', glow: 'rgba(200,200,200,0.35)', bg: '#0a0a0a', enabled: true },
    { id: 'brainrot_god', label: 'Brainrot God', color: '#ff0080', glow: 'rgba(255,0,128,0.4)', bg: '#2d0020', enabled: true },
    { id: 'mythic', label: 'Mythic', color: '#ef4444', glow: 'rgba(239,68,68,0.4)', bg: '#450a0a', enabled: true },
    { id: 'legendary', label: 'Legendary', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)', bg: '#78350f', enabled: true },
    { id: 'epic', label: 'Epic', color: '#a78bfa', glow: 'rgba(167,139,250,0.3)', bg: '#4c1d95', enabled: true },
    { id: 'rare', label: 'Rare', color: '#60a5fa', glow: 'rgba(96,165,250,0.3)', bg: '#1e3a5f', enabled: true },
    { id: 'common', label: 'Common', color: '#4ade80', glow: 'rgba(74,222,128,0.25)', bg: '#14532d', enabled: true },
  ],
  roblox: [
    { id: 'secret', label: 'Secret', color: '#e2e8f0', glow: 'rgba(200,200,200,0.35)', bg: '#0a0a0a', enabled: true },
    { id: 'brainrot_god', label: 'Brainrot God', color: '#ff0080', glow: 'rgba(255,0,128,0.4)', bg: '#2d0020', enabled: true },
    { id: 'mythic', label: 'Mythic', color: '#ef4444', glow: 'rgba(239,68,68,0.4)', bg: '#450a0a', enabled: true },
    { id: 'legendary', label: 'Legendary', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)', bg: '#78350f', enabled: true },
    { id: 'epic', label: 'Epic', color: '#a78bfa', glow: 'rgba(167,139,250,0.3)', bg: '#4c1d95', enabled: true },
    { id: 'rare', label: 'Rare', color: '#60a5fa', glow: 'rgba(96,165,250,0.3)', bg: '#1e3a5f', enabled: true },
    { id: 'common', label: 'Common', color: '#4ade80', glow: 'rgba(74,222,128,0.25)', bg: '#14532d', enabled: true },
  ],
}

export const DEFAULT_PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal', emoji: '🔵', enabled: true },
  { id: 'cashapp', label: 'Cash App', emoji: '🟢', enabled: true },
  { id: 'venmo', label: 'Venmo', emoji: '💙', enabled: true },
  { id: 'revolut', label: 'Revolut', emoji: '🟣', enabled: true },
]

// ─── BACKWARDS-COMPAT ALIASES ─────────────────────────────────────
export const GAMES = DEFAULT_GAMES
export const RARITIES = DEFAULT_RARITIES
export const PAYMENT_METHODS = DEFAULT_PAYMENT_METHODS

// ─── DYNAMIC CONFIG FETCHER (client-side) ────────────────────────
let _configCache = null
let _configFetching = null

export async function fetchSiteConfig() {
  if (_configCache) return _configCache
  if (_configFetching) return _configFetching

  _configFetching = fetch('/api/admin/site-config')
    .then(r => r.json())
    .then(cfg => {
      _configCache = cfg
      _configFetching = null
      return cfg
    })
    .catch(() => {
      _configFetching = null
      return {
        games: DEFAULT_GAMES,
        rarities: DEFAULT_RARITIES,
        payment_methods: DEFAULT_PAYMENT_METHODS,
      }
    })

  return _configFetching
}

export function invalidateSiteConfig() {
  _configCache = null
  _configFetching = null
}

// ─── LISTING TYPES ────────────────────────────────────────────────
export const LISTING_TYPES = [
  { id: 'sale', label: 'For Sale', emoji: '💰' },
  { id: 'trade', label: 'For Trade', emoji: '🔄' },
]

// ─── RARITY STYLE LOOKUP ─────────────────────────────────────────
export const RARITY_STYLES = Object.fromEntries(
  DEFAULT_RARITIES.fortnite.map(r => [r.id, {
    border: r.color,
    text:   r.color,
    bg:     r.bg,
    glow:   r.glow,
  }])
)

export function buildRarityStyles(rarities) {
  if (!rarities) return RARITY_STYLES
  const allRarities = Object.values(rarities).flat()
  const seen = new Set()
  const unique = allRarities.filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
  return Object.fromEntries(unique.map(r => [r.id, {
    border: r.color,
    text:   r.color,
    bg:     r.bg,
    glow:   r.glow,
  }]))
}

export const BADGE_HIERARCHY = ['Owner', 'Moderator', 'VIP Max', 'VIP Plus', 'VIP', 'Verified Trader', 'Referred']

export const BADGE_META = {
  'Owner':           { icon: '👑', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  'Moderator':       { icon: '🛡️', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.3)' },
  'VIP Max':         { icon: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  'VIP Plus':        { icon: '💎', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
  'VIP':             { icon: '⭐', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  'Verified Trader': { icon: '✓',  color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)' },
  'Referred':        { icon: '🎁', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
}

export const VIP_REFERRAL_TIERS = [
  { threshold: 5,  days: 30,   label: '30-day VIP' },
  { threshold: 10, days: 90,   label: '90-day VIP' },
  { threshold: 25, days: null, label: 'Lifetime VIP' },
]

export const VIP_GLOW_META = {
  'VIP':      { color: '#f59e0b', glowNormal: 'rgba(245,158,11,0.25)', glowHover: 'rgba(245,158,11,0.35)' },
  'VIP Plus': { color: '#a78bfa', glowNormal: 'rgba(167,139,250,0.25)', glowHover: 'rgba(167,139,250,0.4)' },
  'VIP Max':  { color: '#ef4444', glowNormal: 'rgba(239,68,68,0.25)', glowHover: 'rgba(239,68,68,0.4)' },
}

export function getPrimaryBadge(badges) {
  if (!badges?.length) return null
  return BADGE_HIERARCHY.find(b => badges.includes(b)) || null
}

export function getVipAccessTier(badges) {
  if (!badges?.length) return null
  if (badges.some(b => ['VIP Max', 'Owner', 'Admin'].includes(b))) return 'VIP Max'
  if (badges.includes('VIP Plus')) return 'VIP Plus'
  if (badges.includes('VIP')) return 'VIP'
  return null
}

export function getVipGlowTier(badges) {
  if (!badges?.length) return null
  if (badges.includes('VIP Max')) return 'VIP Max'
  if (badges.includes('VIP Plus')) return 'VIP Plus'
  if (badges.includes('VIP')) return 'VIP'
  return null
}
