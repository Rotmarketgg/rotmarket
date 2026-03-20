'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ListingCard from '@/components/ListingCard'
import StarRating from '@/components/StarRating'
import ReportButton from '@/components/ReportButton'
import { getProfileByUsername, getUser, getUserListings, getReviews, deleteListing, supabase } from '@/lib/supabase'
import { timeAgo, getInitial } from '@/lib/utils'
import { BADGE_HIERARCHY, BADGE_META, getPrimaryBadge } from '@/lib/constants'

// Extend shared BADGE_META with profile-specific desc field
const BADGE_CONFIG = {
  'Owner':           { ...BADGE_META['Owner'],           desc: 'RotMarket owner' },
  'Moderator':       { ...BADGE_META['Moderator'],       desc: 'Community moderator' },
  'VIP':             { ...BADGE_META['VIP'],             desc: 'VIP supporter of RotMarket' },
  'Verified Trader': { ...BADGE_META['Verified Trader'], desc: 'Trusted trader — 25 five-star reviews' },
}

export default function ProfilePage() {
  const { username } = useParams()
  const [profile, setProfile] = useState(null)
  const [listings, setListings] = useState([])
  const [reviews, setReviews] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('listings')
  const [notFound, setNotFound] = useState(false)
  const [listingOffers, setListingOffers] = useState({}) // listingId -> pending offer count

  useEffect(() => {
    async function load() {
      const [p, u] = await Promise.all([
        getProfileByUsername(decodeURIComponent(username)),
        getUser(),
      ])
      if (!p) { setNotFound(true); setLoading(false); return }
      setCurrentUser(u)
      const [listingsData, reviewsData] = await Promise.all([
        getUserListings(p.id),
        getReviews(p.id),
      ])
      const reviewCount = reviewsData?.length || 0
      const avgRating = reviewCount > 0
        ? Math.round((reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
        : 0
      setProfile({ ...p, review_count: reviewCount, rating: avgRating || p.rating })
      setListings(listingsData || [])
      setReviews(reviewsData || [])

      // If viewing own profile, fetch pending offer counts per listing
      if (u && u.id === p.id && listingsData?.length > 0) {
        const activeIds = listingsData.filter(l => l.status === 'active').map(l => l.id)
        if (activeIds.length > 0) {
          const { data: offers } = await supabase
            .from('trade_requests')
            .select('listing_id')
            .in('listing_id', activeIds)
            .eq('status', 'pending')
          if (offers) {
            const counts = {}
            offers.forEach(o => { counts[o.listing_id] = (counts[o.listing_id] || 0) + 1 })
            setListingOffers(counts)
          }
        }
      }

      setLoading(false)
    }
    load()
  }, [username])

  const isOwn = currentUser?.id === profile?.id
  // Support both legacy badge and new badges array
  const profileBadges = profile?.badges?.length ? profile.badges
    : profile?.badge ? [profile.badge]
    : []
  const primaryBadgeName = getPrimaryBadge(profileBadges)
  const badge = primaryBadgeName ? BADGE_CONFIG[primaryBadgeName] : null
  const activeListings = listings.filter(l => l.status === 'active')
  const expiredListings = listings.filter(l => l.status === 'expired')
  const soldListings = listings.filter(l => l.status === 'sold')
  const starDist = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length,
    pct: reviews.length ? (reviews.filter(r => r.rating === s).length / reviews.length) * 100 : 0,
  }))

  const daysUntilExpiry = (listing) => {
    if (!listing.expires_at) return null
    const days = Math.ceil((new Date(listing.expires_at) - new Date()) / 86400000)
    return days
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this listing?')) return
    await deleteListing(id)
    setListings(prev => prev.filter(l => l.id !== id))
  }

  const handleRenew = async (listingId) => {
    try {
      const { error } = await supabase.rpc('renew_listing', { listing_id: listingId })
      if (error) throw error
      const primary = primaryBadgeName
      const days = primary === 'VIP' || primary === 'Owner' ? 30 : primary === 'Verified Trader' ? 14 : 7
      setListings(prev => prev.map(l => l.id === listingId
        ? { ...l, status: 'active', expires_at: new Date(Date.now() + days * 86400000).toISOString() }
        : l
      ))
    } catch (err) {
      alert('Failed to renew: ' + err.message)
    }
  }

  // Sort active listings: most pending offers first, then by created_at
  const sortedActiveListings = [...activeListings].sort((a, b) => {
    const aOffers = listingOffers[a.id] || 0
    const bOffers = listingOffers[b.id] || 0
    if (bOffers !== aOffers) return bOffers - aOffers
    return new Date(b.created_at) - new Date(a.created_at)
  })

  // ── LOADING ───────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1040, margin: '32px auto', padding: '0 16px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div className="skeleton" style={{ width: 280, height: 480, borderRadius: 16, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 300 }}>
          <div className="skeleton" style={{ height: 48, borderRadius: 10, marginBottom: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 240, borderRadius: 12 }} />)}
          </div>
        </div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: '100px 24px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>👤</div>
        <h2 style={{ color: '#f9fafb', margin: '0 0 8px' }}>User Not Found</h2>
        <p style={{ color: '#6b7280', marginBottom: 20 }}>This profile doesn't exist or has been removed.</p>
        <Link href="/" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Browse Listings</Link>
      </div>
    </div>
  )

  const accentColor = badge?.color || '#4ade80'

  // ── RENDER ────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 16px 60px' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ── LEFT SIDEBAR ──────────────────────────────────── */}
          <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Identity card */}
            <div style={{
              background: '#111118',
              border: `1px solid ${accentColor}25`,
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: `0 0 40px ${accentColor}10`,
            }}>
              {/* Color band at top */}
              <div style={{
                height: 6,
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}40)`,
              }} />

              <div style={{ padding: '24px 20px 20px', textAlign: 'center' }}>
                {/* Avatar */}
                <div style={{
                  width: 96, height: 96, borderRadius: '50%', margin: '0 auto 14px',
                  border: `3px solid ${accentColor}`,
                  background: profile.avatar_url ? 'transparent' : `linear-gradient(135deg, ${accentColor}, #22c55e)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36, fontWeight: 900, color: '#0a0a0f',
                  fontFamily: 'var(--font-display)', overflow: 'hidden',
                  boxShadow: `0 0 24px ${accentColor}30`,
                }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : getInitial(profile.username)
                  }
                </div>

                {/* Username */}
                <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, color: '#f9fafb', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>
                  {profile.username}
                </h1>

                {/* All badges — shown in hierarchy order */}
                {profileBadges.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginBottom: 10 }}>
                    {BADGE_HIERARCHY.filter(b => profileBadges.includes(b)).map(b => {
                      const cfg = BADGE_CONFIG[b]
                      return (
                        <div key={b} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 800,
                          color: cfg.color, background: cfg.bg,
                          border: `1px solid ${cfg.border}`,
                          borderRadius: 20, padding: '3px 10px',
                        }} title={cfg.desc}>
                          {cfg.icon} {b}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Bio */}
                {profile.bio && (
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9ca3af', lineHeight: 1.7, textAlign: 'left' }}>
                    {profile.bio}
                  </p>
                )}

                {/* Profile link — shown for all users who set it */}
                {profile.profile_url && (
                  <a
                    href={profile.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      justifyContent: 'center', marginBottom: 10,
                      fontSize: 11, fontWeight: 600, color: '#60a5fa',
                      textDecoration: 'none', padding: '5px 12px',
                      background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
                      borderRadius: 8, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.08)' }}
                  >
                    🔗 {(() => {
                      try { return new URL(profile.profile_url).hostname.replace('www.', '') }
                      catch { return 'Link' }
                    })()}
                  </a>
                )}

                {/* Game usernames */}
                {(profile.epic_username || profile.roblox_username) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14, textAlign: 'left' }}>
                    {profile.epic_username && (
                      <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 6, padding: '5px 10px' }}>
                        <span>🎮</span>
                        <span style={{ color: '#9ca3af', fontWeight: 600 }}>{profile.epic_username}</span>
                      </div>
                    )}
                    {profile.roblox_username && (
                      <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 6, padding: '5px 10px' }}>
                        <span>🟥</span>
                        <span style={{ color: '#9ca3af', fontWeight: 600 }}>{profile.roblox_username}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {isOwn ? (
                    <Link href="/settings" className="btn-ghost" style={{ textDecoration: 'none', textAlign: 'center', fontSize: 12, padding: '9px 0', display: 'block' }}>
                      ⚙️ Edit Profile
                    </Link>
                  ) : currentUser ? (
                    <>
                      <Link href={`/messages?user=${profile.username}`} className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center', fontSize: 12, padding: '9px 0', display: 'block' }}>
                        💬 Message
                      </Link>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <ReportButton reportedUserId={profile.id} label="Report User" />
                      </div>
                    </>
                  ) : (
                    <Link href="/auth/login" className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center', fontSize: 12, padding: '9px 0', display: 'block' }}>
                      Sign In to Message
                    </Link>
                  )}
                </div>

                {/* Joined date */}
                {profile.created_at && (
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#4b5563', marginTop: 4 }}>
                    Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            </div>

            {/* Stats card */}
            <div style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f2937' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trader Stats</div>
              </div>
              <div style={{ padding: 4 }}>
                {[
                  {
                    label: 'Total Trades',
                    value: profile.trade_count || 0,
                    color: '#4ade80',
                    onClick: () => setTab('listings'),
                    suffix: profile.trade_count === 1 ? ' trade' : ' trades',
                  },
                  {
                    label: 'Avg Rating',
                    value: profile.rating > 0 ? profile.rating : null,
                    color: '#f59e0b',
                    onClick: () => setTab('reviews'),
                    isRating: true,
                  },
                  {
                    label: 'Active Listings',
                    value: activeListings.length,
                    color: '#60a5fa',
                    onClick: () => setTab('listings'),
                  },
                  {
                    label: 'Items Sold',
                    value: soldListings.length,
                    color: '#a78bfa',
                    onClick: () => setTab('sold'),
                  },
                ].map((s, i) => (
                  <button key={i} onClick={s.onClick} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8, border: 'none',
                    background: 'transparent', cursor: 'pointer',
                    transition: 'background 0.12s',
                    textAlign: 'left',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>{s.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {s.isRating && s.value && (
                        <div style={{ display: 'flex', gap: 1 }}>
                          {[1,2,3,4,5].map(n => (
                            <svg key={n} width={10} height={10} viewBox="0 0 24 24"
                              fill={n <= Math.round(s.value) ? '#f59e0b' : 'none'}
                              stroke="#f59e0b" strokeWidth="2.5">
                              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                            </svg>
                          ))}
                        </div>
                      )}
                      <span style={{ fontSize: 15, fontWeight: 900, color: s.color }}>
                        {s.isRating ? (s.value || '—') : s.value}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Review distribution — only show if they have reviews */}
            {reviews.length > 0 && (
              <div style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Rating Breakdown</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{reviews.length} reviews</div>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {starDist.map(({ star, count, pct }) => (
                    <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#6b7280', width: 8, textAlign: 'center', flexShrink: 0 }}>{star}</span>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                      </svg>
                      <div style={{ flex: 1, height: 6, background: '#1f2937', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#f59e0b', borderRadius: 3, transition: 'width 0.6s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#4b5563', width: 16, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions for own profile */}
            {isOwn && (
              <Link href="/create" className="btn-primary" style={{
                display: 'block', textAlign: 'center',
                textDecoration: 'none', padding: '12px 0',
                borderRadius: 12, fontSize: 13,
              }}>
                + Post a Listing
              </Link>
            )}
          </div>

          {/* ── RIGHT CONTENT ─────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Tab bar */}
            <div style={{
              display: 'flex', gap: 4, marginBottom: 20,
              background: '#111118', border: '1px solid #1f2937',
              borderRadius: 12, padding: 4,
            }}>
              {[
                { id: 'listings', label: 'Active', count: activeListings.length },
                { id: 'sold', label: 'Sold', count: soldListings.length },
                { id: 'reviews', label: 'Reviews', count: reviews.length },
                ...(isOwn && expiredListings.length > 0 ? [{ id: 'expired', label: '⏰ Expired', count: expiredListings.length }] : []),
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: tab === t.id ? accentColor + '18' : 'transparent',
                  color: tab === t.id ? accentColor : '#6b7280',
                  fontSize: 13, fontWeight: 700,
                  boxShadow: tab === t.id ? `0 0 0 1px ${accentColor}40` : 'none',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  {t.label}
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    background: tab === t.id ? accentColor + '30' : '#1f2937',
                    color: tab === t.id ? accentColor : '#4b5563',
                    borderRadius: 10, padding: '1px 6px',
                  }}>{t.count}</span>
                </button>
              ))}
            </div>

            {/* ── ACTIVE LISTINGS TAB ── */}
            {tab === 'listings' && (
              activeListings.length === 0
                ? <EmptyState
                    icon="📦"
                    title="No active listings"
                    message={isOwn ? "Post your first listing to start trading." : `${profile.username} doesn't have any active listings right now.`}
                    action={isOwn ? { label: '+ Post a Listing', href: '/create' } : null}
                  />
                : <div className="listing-grid">
                    {sortedActiveListings.map(l => {
                      const days = daysUntilExpiry(l)
                      const expiringSoon = days !== null && days <= 5
                      return (
                        <div key={l.id} style={{ position: 'relative' }}>
                          <ListingCard listing={l} />
                          {/* Pending offer badge */}
                          {isOwn && listingOffers[l.id] > 0 && (
                            <Link href={`/listing/${l.id}`} style={{
                              position: 'absolute', top: 8, left: 8,
                              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                              color: '#fff', borderRadius: 20,
                              padding: '3px 10px', fontSize: 11, fontWeight: 800,
                              textDecoration: 'none',
                              boxShadow: '0 2px 8px rgba(245,158,11,0.5)',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                              📨 {listingOffers[l.id]} offer{listingOffers[l.id] !== 1 ? 's' : ''}
                            </Link>
                          )}
                          {/* Expiry warning */}
                          {isOwn && expiringSoon && (
                            <div style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontSize: 11, color: '#f87171', textAlign: 'center', fontWeight: 600 }}>
                              ⏰ Expires in {days}d
                            </div>
                          )}
                          {isOwn && (
                            <button onClick={() => handleDelete(l.id)} style={{
                              width: '100%', marginTop: 6, padding: '6px 0',
                              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                              borderRadius: 6, fontSize: 11, color: '#f87171',
                              cursor: 'pointer', fontWeight: 600,
                            }}>🗑 Delete</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
            )}

            {/* ── SOLD TAB ── */}
            {tab === 'sold' && (
              soldListings.length === 0
                ? <EmptyState icon="🏷️" title="No sales yet" message="Completed trades will appear here." />
                : <div className="listing-grid">
                    {soldListings.map(l => (
                      <div key={l.id} style={{ opacity: 0.65 }}>
                        <ListingCard listing={l} />
                      </div>
                    ))}
                  </div>
            )}

            {/* ── EXPIRED TAB (own profile only) ── */}
            {tab === 'expired' && isOwn && (
              expiredListings.length === 0
                ? <EmptyState icon="⏰" title="No expired listings" message="Listings expire after 30 days." />
                : <div>
                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#fbbf24' }}>
                      ⏰ These listings have expired. Renew them to make them active again for another{' '}
                      {profile?.badge === 'VIP' || profile?.badge === 'Owner' ? '30' : profile?.badge === 'Verified Trader' ? '14' : '7'} days.
                    </div>
                    <div className="listing-grid">
                      {expiredListings.map(l => (
                        <div key={l.id}>
                          <div style={{ opacity: 0.55, pointerEvents: 'none' }}>
                            <ListingCard listing={l} />
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button onClick={() => handleRenew(l.id)} style={{
                              flex: 2, padding: '7px 0',
                              background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
                              borderRadius: 6, fontSize: 11, color: '#4ade80',
                              cursor: 'pointer', fontWeight: 700,
                            }}>↩ Renew</button>
                            <button onClick={() => handleDelete(l.id)} style={{
                              flex: 1, padding: '7px 0',
                              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                              borderRadius: 6, fontSize: 11, color: '#f87171',
                              cursor: 'pointer', fontWeight: 600,
                            }}>🗑</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
            )}

            {/* ── REVIEWS TAB ── */}
            {tab === 'reviews' && (
              reviews.length === 0
                ? <EmptyState
                    icon="⭐"
                    title="No reviews yet"
                    message="Reviews appear here after completed trades."
                  />
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {reviews.map(r => (
                      <div key={r.id} style={{
                        background: '#111118', border: '1px solid #1f2937',
                        borderRadius: 12, padding: '14px 16px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: r.comment ? 10 : 0 }}>
                          {/* Reviewer avatar */}
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            background: r.reviewer?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 900, color: '#0a0a0f',
                          }}>
                            {r.reviewer?.avatar_url
                              ? <img src={r.reviewer.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : getInitial(r.reviewer?.username || '?')
                            }
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              {r.reviewer?.username
                                ? <Link href={`/profile/${r.reviewer.username}`} style={{ fontSize: 13, fontWeight: 700, color: '#d1d5db', textDecoration: 'none' }}>
                                    {r.reviewer.username}
                                  </Link>
                                : <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Unknown</span>
                              }
                              <StarRating rating={r.rating} size={12} showValue />
                            </div>
                            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 1 }}>{timeAgo(r.created_at)}</div>
                          </div>
                        </div>

                        {r.comment && (
                          <p style={{
                            margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.7,
                            paddingLeft: 46, borderTop: '1px solid #1a1a2e', paddingTop: 10,
                          }}>
                            "{r.comment}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, title, message, action }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 24px',
      background: '#111118', border: '1px solid #1f2937',
      borderRadius: 16,
    }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#d1d5db' }}>{title}</h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>{message}</p>
      {action && (
        <Link href={action.href} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', padding: '10px 22px', fontSize: 13 }}>
          {action.label}
        </Link>
      )}
    </div>
  )
}
