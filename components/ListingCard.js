'use client'

import Link from 'next/link'
import { getRarityStyle, timeAgo, formatPrice, getInitial } from '@/lib/utils'

// Badge hierarchy — order matters for primary badge color/icon
const BADGE_HIERARCHY = ['Owner', 'Moderator', 'VIP', 'Verified Trader']

const BADGE_META = {
  'Owner':           { icon: '👑', color: '#ef4444' },
  'Moderator':       { icon: '🛡️', color: '#60a5fa' },
  'VIP':             { icon: '⭐', color: '#f59e0b' },
  'Verified Trader': { icon: '✓',  color: '#4ade80' },
}

// Get the highest-priority badge from an array
function getPrimaryBadge(badges) {
  if (!badges?.length) return null
  return BADGE_HIERARCHY.find(b => badges.includes(b)) || null
}

const TYPE_CONFIG = {
  sale:  { label: 'SALE',  bg: 'rgba(22,163,74,0.9)',  border: '#16a34a', color: '#fff' },
  trade: { label: 'TRADE', bg: 'rgba(37,99,235,0.9)',  border: '#2563eb', color: '#fff' },
  sold:  { label: 'SOLD',  bg: 'rgba(239,68,68,0.85)', border: '#ef4444', color: '#fff' },
}

export default function ListingCard({ listing }) {
  const rarity = getRarityStyle(listing.rarity)
  const profile = listing.profiles

  // Support both legacy single badge and new badges array
  const badges = profile?.badges?.length ? profile.badges
    : profile?.badge ? [profile.badge]
    : []

  const primaryBadge = getPrimaryBadge(badges)
  const primaryMeta = primaryBadge ? BADGE_META[primaryBadge] : null
  const isVip = primaryBadge === 'VIP' || primaryBadge === 'Owner'
  const isVerified = badges.includes('Verified Trader')

  const typeKey = listing.status === 'sold' ? 'sold' : listing.type
  const typeConf = TYPE_CONFIG[typeKey] || TYPE_CONFIG.sale

  const daysLeft = listing.expires_at
    ? Math.ceil((new Date(listing.expires_at) - new Date()) / 86400000)
    : null
  const expiringSoon = daysLeft !== null && daysLeft <= 3 && daysLeft > 0
  const hasImage = !!listing.images?.[0]

  return (
    <Link href={`/listing/${listing.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div
        style={{
          background: '#0f0f18',
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          opacity: listing.status === 'sold' ? 0.5 : 1,
          outline: listing.promoted
            ? '2px solid rgba(139,92,246,0.7)'
            : isVip
            ? '1px solid rgba(245,158,11,0.4)'
            : `1px solid ${rarity.border}44`,
          boxShadow: listing.promoted
            ? `0 0 20px rgba(139,92,246,0.25), inset 0 0 0 1px rgba(139,92,246,0.15)`
            : isVip
            ? `0 0 16px rgba(245,158,11,0.2), 0 2px 8px rgba(0,0,0,0.4)`
            : `0 2px 8px rgba(0,0,0,0.4)`,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)'
          e.currentTarget.style.boxShadow = listing.promoted
            ? `0 12px 32px rgba(139,92,246,0.4), inset 0 0 0 1px rgba(139,92,246,0.2)`
            : isVip
            ? `0 12px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.5)`
            : `0 12px 28px rgba(0,0,0,0.5), 0 0 0 1px ${rarity.border}66`
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)'
          e.currentTarget.style.boxShadow = listing.promoted
            ? `0 0 20px rgba(245,158,11,0.25), inset 0 0 0 1px rgba(245,158,11,0.15)`
            : `0 2px 8px rgba(0,0,0,0.4)`
        }}
      >
        {/* Rarity accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${rarity.border}, ${rarity.border}88, transparent)`, flexShrink: 0 }} />

        {/* Image area */}
        <div style={{
          position: 'relative', height: 160,
          background: hasImage ? 'transparent' : `radial-gradient(ellipse at 50% 30%, ${rarity.bg} 0%, #080810 75%)`,
          flexShrink: 0, overflow: 'hidden',
        }}>
          {hasImage
            ? <img src={listing.images[0]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, opacity: 0.7 }}>🎮</div>
          }

          {/* Gradient overlay */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(to top, #0f0f18 0%, transparent 100%)', pointerEvents: 'none' }} />

          {/* Promoted badge */}
          {listing.promoted && (
            <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', border: '1px solid rgba(139,92,246,0.6)', color: '#a78bfa', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', borderRadius: 4, padding: '3px 7px' }}>⚡ PROMOTED</div>
          )}

          {/* VIP seller badge — only when not promoted (avoid overlap) */}
          {!listing.promoted && isVip && (
            <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', border: '1px solid rgba(245,158,11,0.6)', color: '#f59e0b', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', borderRadius: 4, padding: '3px 7px' }}>⭐ VIP</div>
          )}

          {/* Type badge */}
          <div style={{ position: 'absolute', top: 8, right: 8, background: typeConf.bg, border: `1px solid ${typeConf.border}`, color: typeConf.color, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', borderRadius: 4, padding: '3px 7px' }}>{typeConf.label}</div>

          {/* Rarity label */}
          <div style={{ position: 'absolute', bottom: 8, left: 10, color: rarity.text, fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.9, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            {listing.rarity?.replace('_', ' ')}
          </div>

          {/* Quantity badge — only when more than 1 available */}
          {listing.quantity > 1 && listing.status !== 'sold' && (
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
              border: '1px solid rgba(74,222,128,0.35)',
              color: '#4ade80', fontSize: 9, fontWeight: 800,
              borderRadius: 4, padding: '2px 7px', letterSpacing: '0.05em',
            }}>×{listing.quantity}</div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', flex: 1, gap: 6 }}>

          {/* Title — explicit DM Sans, not condensed */}
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#f1f5f9',
            fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {listing.title}
          </div>

          {/* Price */}
          <div style={{
            fontSize: listing.type === 'trade' ? 13 : 20,
            fontWeight: 900,
            color: listing.type === 'trade' ? '#60a5fa' : '#4ade80',
            letterSpacing: listing.type === 'trade' ? '0' : '-0.5px',
            fontFamily: '"DM Sans", system-ui, sans-serif',
            marginTop: 2,
          }}>
            {listing.type === 'trade' ? '🔄 Trade Only' : formatPrice(listing.price)}
          </div>

          <div style={{ flex: 1 }} />

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {/* Avatar */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                overflow: 'hidden', flexShrink: 0,
                background: profile?.avatar_url ? 'transparent' : `linear-gradient(135deg, ${rarity.border}, ${rarity.bg})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 900, color: '#fff',
                outline: primaryMeta ? `1.5px solid ${primaryMeta.color}` : 'none',
                outlineOffset: '1px',
              }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : getInitial(profile?.username)
                }
              </div>

              {/* Username */}
              <span style={{ fontSize: 11, fontWeight: 600, color: primaryMeta ? primaryMeta.color : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 70 }}>
                {profile?.username || 'Unknown'}
              </span>

              {/* ALL badge icons — show each in hierarchy order */}
              {BADGE_HIERARCHY.filter(b => badges.includes(b)).map(b => (
                <span key={b} title={b} style={{ fontSize: 10, flexShrink: 0, lineHeight: 1 }}>
                  {BADGE_META[b].icon}
                </span>
              ))}
            </div>

            <span style={{ fontSize: 10, fontWeight: 600, flexShrink: 0, color: expiringSoon ? '#f87171' : '#475569' }}>
              {expiringSoon ? `⏰ ${daysLeft}d` : timeAgo(listing.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function ListingCardSkeleton() {
  return (
    <div style={{ background: '#0f0f18', borderRadius: 12, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 3, background: '#1f2937' }} />
      <div className="skeleton" style={{ height: 160, flexShrink: 0 }} />
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div className="skeleton" style={{ height: 13, width: '85%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 13, width: '60%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 22, width: 70, borderRadius: 4, marginTop: 4 }} />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="skeleton" style={{ height: 22, width: 22, borderRadius: '50%' }} />
          <div className="skeleton" style={{ height: 11, width: 50, borderRadius: 4 }} />
        </div>
      </div>
    </div>
  )
}
