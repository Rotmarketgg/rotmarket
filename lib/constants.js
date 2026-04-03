export const GAMES = [
  { id: 'fortnite', label: 'Fortnite Brainrot', emoji: '🎮', color: '#4ade80' },
  { id: 'roblox', label: 'Roblox Brainrot', emoji: '🟥', color: '#ef4444' },
]

export const RARITIES = {
  fortnite: [
    { id: 'secret', label: 'Secret', color: '#e2e8f0', glow: 'rgba(200,200,200,0.35)', bg: '#0a0a0a' },
    { id: 'brainrot_god', label: 'Brainrot God', color: '#ff0080', glow: 'rgba(255,0,128,0.4)', bg: '#2d0020' },
    { id: 'mythic', label: 'Mythic', color: '#ef4444', glow: 'rgba(239,68,68,0.4)', bg: '#450a0a' },
    { id: 'legendary', label: 'Legendary', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)', bg: '#78350f' },
    { id: 'epic', label: 'Epic', color: '#a78bfa', glow: 'rgba(167,139,250,0.3)', bg: '#4c1d95' },
    { id: 'rare', label: 'Rare', color: '#60a5fa', glow: 'rgba(96,165,250,0.3)', bg: '#1e3a5f' },
    { id: 'common', label: 'Common', color: '#4ade80', glow: 'rgba(74,222,128,0.25)', bg: '#14532d' },
  ],
  roblox: [
    { id: 'secret', label: 'Secret', color: '#e2e8f0', glow: 'rgba(200,200,200,0.35)', bg: '#0a0a0a' },
    { id: 'brainrot_god', label: 'Brainrot God', color: '#ff0080', glow: 'rgba(255,0,128,0.4)', bg: '#2d0020' },
    { id: 'mythic', label: 'Mythic', color: '#ef4444', glow: 'rgba(239,68,68,0.4)', bg: '#450a0a' },
    { id: 'legendary', label: 'Legendary', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)', bg: '#78350f' },
    { id: 'epic', label: 'Epic', color: '#a78bfa', glow: 'rgba(167,139,250,0.3)', bg: '#4c1d95' },
    { id: 'rare', label: 'Rare', color: '#60a5fa', glow: 'rgba(96,165,250,0.3)', bg: '#1e3a5f' },
    { id: 'common', label: 'Common', color: '#4ade80', glow: 'rgba(74,222,128,0.25)', bg: '#14532d' },
  ]
}

export const PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal', emoji: '🔵', note: 'Send as goods & services for buyer protection' },
  { id: 'cashapp', label: 'Cash App', emoji: '🟢', note: 'Send as business payment' },
  { id: 'venmo', label: 'Venmo', emoji: '💙', note: 'Send as goods & services' },
  { id: 'revolut', label: 'Revolut', emoji: '🟣', note: 'Send via Revolut Pay' },
]

export const LISTING_TYPES = [
  { id: 'sale', label: 'For Sale', emoji: '💰' },
  { id: 'trade', label: 'For Trade', emoji: '🔄' },
]

// ─── RARITY STYLE LOOKUP ─────────────────────────────────────────
export const RARITY_STYLES = Object.fromEntries(
  RARITIES.fortnite.map(r => [r.id, {
    border: r.color,
    text:   r.color,
    bg:     r.bg,
    glow:   r.glow,
  }])
)

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

// VIP referral milestones — days: null means lifetime (no expiry)
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

// Glow tier intentionally excludes Owner/Admin per product rule.
export function getVipGlowTier(badges) {
  if (!badges?.length) return null
  if (badges.includes('VIP Max')) return 'VIP Max'
  if (badges.includes('VIP Plus')) return 'VIP Plus'
  if (badges.includes('VIP')) return 'VIP'
  return null
}
