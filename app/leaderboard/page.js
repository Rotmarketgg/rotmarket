'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import StarRating from '@/components/StarRating'
import { supabase, getUser } from '@/lib/supabase'
import { getInitial } from '@/lib/utils'
import { BADGE_META, getPrimaryBadge } from '@/lib/constants'

const MEDAL_COLORS  = ['#f59e0b', '#9ca3af', '#cd7c2f']
const MEDAL_GLOWS   = ['rgba(245,158,11,0.35)', 'rgba(156,163,175,0.25)', 'rgba(205,124,47,0.25)']
const MEDAL_LABELS  = ['1st', '2nd', '3rd']
const MEDAL_SIZES   = [68, 56, 56]   // avatar sizes in podium
const PODIUM_HEIGHTS = ['120px', '80px', '60px'] // podium column heights

export default function LeaderboardPage() {
  const [traders, setTraders]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('trades')
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => { getUser().then(() => setAuthChecked(true)) }, [])

  useEffect(() => {
    if (!authChecked) return
    setLoading(true)
    async function load() {
      const base = supabase
        .from('profiles')
        .select('id, username, trade_count, rating, review_count, badge, badges, avatar_url')
        .not('username', 'is', null)

      const { data, error } = tab === 'trades'
        ? await base.gt('trade_count', 0).order('trade_count', { ascending: false }).limit(50)
        : await base.gt('review_count', 0)
            .order('rating', { ascending: false })
            .order('review_count', { ascending: false })
            .limit(50)

      if (!error) setTraders(data || [])
      setLoading(false)
    }
    load()
  }, [tab, authChecked])

  const getValue  = (t) => tab === 'trades' ? t.trade_count : t.rating
  const isTrades  = tab === 'trades'

  // Podium order: 2nd | 1st | 3rd
  const top3 = traders.slice(0, 3)
  const podium = top3.length >= 2
    ? [top3[1], top3[0], top3[2]].filter(Boolean)
    : top3
  const podiumRanks = top3.length >= 2 ? [1, 0, 2] : [0, 1, 2]
  const rest = traders.slice(3)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Navbar />

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(245,158,11,0.07) 0%, transparent 100%)',
        borderBottom: '1px solid #1f2937',
        padding: 'clamp(32px, 6vw, 56px) 16px clamp(24px, 4vw, 40px)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 'clamp(32px, 8vw, 52px)', marginBottom: 8 }}>🏆</div>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: 'clamp(26px, 6vw, 44px)',
          fontFamily: 'var(--font-display)', fontWeight: 900,
          color: '#fff', letterSpacing: '-1px', lineHeight: 1.1,
        }}>
          <span style={{ color: '#f59e0b' }}>Leaderboard</span>
        </h1>
        <p style={{ margin: 0, fontSize: 'clamp(13px, 3vw, 15px)', color: '#6b7280', maxWidth: 420, marginInline: 'auto' }}>
          RotMarket's most trusted traders — ranked by performance
        </p>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(20px, 4vw, 36px) 16px 60px' }}>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: 0,
          background: '#111118', border: '1px solid #1f2937',
          borderRadius: 12, padding: 4, marginBottom: 'clamp(20px, 4vw, 32px)',
        }}>
          {[
            { id: 'trades', label: '🔄 Most Trades' },
            { id: 'rating', label: '⭐ Highest Rated' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: 'clamp(8px, 2vw, 11px) 16px',
              borderRadius: 9, border: 'none', cursor: 'pointer',
              background: tab === t.id ? 'rgba(245,158,11,0.15)' : 'transparent',
              color: tab === t.id ? '#f59e0b' : '#6b7280',
              boxShadow: tab === t.id ? '0 0 0 1px rgba(245,158,11,0.35)' : 'none',
              fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: 700, transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {[0,1,2].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: 140, borderRadius: 14 }} />)}
            </div>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && traders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.4 }}>🏆</div>
            <p style={{ color: '#6b7280', fontSize: 15 }}>No traders yet — complete your first trade to appear here!</p>
          </div>
        )}

        {!loading && traders.length > 0 && (
          <>
            {/* ── PODIUM ─────────────────────────────────────── */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              marginBottom: 'clamp(16px, 4vw, 28px)',
              padding: '0 0 4px',
            }}>
              {podium.map((trader, i) => {
                const rank = podiumRanks[i]
                const color = MEDAL_COLORS[rank]
                const glow  = MEDAL_GLOWS[rank]
                const size  = MEDAL_SIZES[rank]
                const traderBadges = trader.badges?.length ? trader.badges : trader.badge ? [trader.badge] : []
                const primary = getPrimaryBadge(traderBadges)
                const meta = primary ? BADGE_META[primary] : null

                return (
                  <Link key={trader.id} href={`/profile/${trader.username}`}
                    style={{ flex: rank === 0 ? 1.15 : 1, textDecoration: 'none', minWidth: 0 }}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      background: '#111118',
                      border: `1px solid ${color}30`,
                      borderBottom: 'none',
                      borderRadius: '14px 14px 0 0',
                      padding: rank === 0 ? 'clamp(16px,3vw,24px) 8px 20px' : 'clamp(12px,2vw,18px) 8px 16px',
                      boxShadow: `0 0 32px ${glow}, inset 0 1px 0 ${color}20`,
                      transition: 'transform 0.15s',
                      position: 'relative', overflow: 'hidden',
                    }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      {/* Subtle gradient top fill */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
                        background: `linear-gradient(180deg, ${color}10 0%, transparent 100%)`,
                        pointerEvents: 'none',
                      }} />

                      {/* Rank label */}
                      <div style={{
                        fontSize: 10, fontWeight: 800, color, letterSpacing: '0.1em',
                        textTransform: 'uppercase', marginBottom: 8, opacity: 0.9,
                      }}>{MEDAL_LABELS[rank]}</div>

                      {/* Avatar */}
                      <div style={{
                        width: size, height: size,
                        borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                        background: trader.avatar_url ? 'transparent' : `linear-gradient(135deg, ${color}60, ${color}30)`,
                        border: `3px solid ${color}`,
                        boxShadow: `0 0 16px ${glow}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: size * 0.35, fontWeight: 900, color,
                        marginBottom: 10,
                      }}>
                        {trader.avatar_url
                          ? <img src={trader.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : getInitial(trader.username)
                        }
                      </div>

                      {/* Username */}
                      <div style={{
                        fontSize: rank === 0 ? 'clamp(12px,3vw,15px)' : 'clamp(11px,2.5vw,13px)',
                        fontWeight: 800, color: '#f9fafb', textAlign: 'center',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        width: '100%', marginBottom: meta ? 4 : 8,
                      }}>{trader.username}</div>

                      {/* Badge */}
                      {meta && (
                        <div style={{
                          fontSize: 9, fontWeight: 800, color: meta.color,
                          background: meta.bg, border: `1px solid ${meta.border}`,
                          borderRadius: 20, padding: '2px 7px',
                          marginBottom: 8, whiteSpace: 'nowrap',
                        }}>{meta.icon} {primary}</div>
                      )}

                      {/* Value */}
                      <div style={{
                        fontSize: rank === 0 ? 'clamp(20px,5vw,28px)' : 'clamp(16px,4vw,22px)',
                        fontWeight: 900, color, lineHeight: 1,
                        marginBottom: 2,
                      }}>{getValue(trader)}</div>
                      <div style={{ fontSize: 10, color: '#4b5563', fontWeight: 600 }}>
                        {isTrades ? 'trades' : 'rating'}
                      </div>

                      {!isTrades && trader.review_count > 0 && (
                        <div style={{ fontSize: 10, color: '#4b5563', marginTop: 3 }}>
                          {trader.review_count} reviews
                        </div>
                      )}
                    </div>

                    {/* Podium base */}
                    <div style={{
                      height: PODIUM_HEIGHTS[rank],
                      background: `linear-gradient(180deg, ${color}18 0%, ${color}08 100%)`,
                      border: `1px solid ${color}25`,
                      borderTop: 'none',
                      borderRadius: '0 0 10px 10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ fontSize: rank === 0 ? 32 : 24, opacity: 0.6 }}>
                        {['🥇','🥈','🥉'][rank]}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* ── REST OF LIST ───────────────────────────────── */}
            {rest.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rest.map((trader, i) => {
                  const rank = i + 3
                  const traderBadges = trader.badges?.length ? trader.badges : trader.badge ? [trader.badge] : []
                  const primary = getPrimaryBadge(traderBadges)
                  const meta = primary ? BADGE_META[primary] : null

                  return (
                    <Link key={trader.id} href={`/profile/${trader.username}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        background: '#111118', border: '1px solid #1f2937',
                        borderRadius: 12, padding: 'clamp(10px,2vw,14px) clamp(12px,3vw,18px)',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#161622'; e.currentTarget.style.borderColor = '#2d2d3f' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#111118'; e.currentTarget.style.borderColor = '#1f2937' }}
                      >
                        {/* Rank number */}
                        <div style={{
                          width: 28, textAlign: 'center', flexShrink: 0,
                          fontSize: 12, fontWeight: 800,
                          color: rank < 10 ? '#6b7280' : '#374151',
                        }}>#{rank + 1}</div>

                        {/* Avatar */}
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                          background: trader.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 900, color: '#0a0a0f',
                        }}>
                          {trader.avatar_url
                            ? <img src={trader.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : getInitial(trader.username)
                          }
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {trader.username}
                            </span>
                            {meta && (
                              <span style={{
                                fontSize: 9, fontWeight: 800, color: meta.color,
                                background: meta.bg, border: `1px solid ${meta.border}`,
                                borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap', flexShrink: 0,
                              }}>{meta.icon} {primary}</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: '#4b5563' }}>{trader.trade_count || 0} trades</span>
                            {trader.rating > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <StarRating rating={trader.rating} size={10} />
                                <span style={{ fontSize: 11, color: '#4b5563' }}>{trader.rating}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Value */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 'clamp(16px,4vw,20px)', fontWeight: 900, color: '#f9fafb', lineHeight: 1 }}>
                            {getValue(trader)}
                          </div>
                          <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                            {isTrades ? 'trades' : 'rating'}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
