'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { supabase, getUser } from '@/lib/supabase'
import { getInitial } from '@/lib/utils'
import { BADGE_META, BADGE_HIERARCHY, getPrimaryBadge } from '@/lib/constants'

const BADGE_STYLES = BADGE_META

const MEDALS = ['🥇', '🥈', '🥉']
const MEDAL_COLORS = ['#f59e0b', '#9ca3af', '#cd7c2f']

export default function LeaderboardPage() {
  const [traders, setTraders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('trades')
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    getUser().then(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (!authChecked) return
    setLoading(true)
    async function load() {
      if (tab === 'trades') {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, trade_count, rating, review_count, badge, badges, avatar_url')
          .not('username', 'is', null)
          .gt('trade_count', 0)
          .order('trade_count', { ascending: false })
          .limit(50)
        if (!error) setTraders(data || [])
        else console.error('Leaderboard error:', error)
      } else {
        // Query profiles directly — rating/review_count are kept in sync by DB trigger
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, trade_count, rating, review_count, badge, badges, avatar_url')
          .not('username', 'is', null)
          .gt('review_count', 0)
          .order('rating', { ascending: false })
          .order('review_count', { ascending: false })
          .limit(50)
        if (error) { console.error('Leaderboard error:', error); setLoading(false); return }
        setTraders(data || [])
      }
      setLoading(false)
    }
    load()
  }, [tab, authChecked])

  if (!authChecked) return <div style={{ minHeight: '100vh' }}><Navbar /></div>

  const getValue = (trader) => tab === 'trades' ? trader.trade_count : trader.rating
  const getLabel = () => tab === 'trades' ? 'trades' : 'avg rating'

  // Podium: show top 3 in 2nd/1st/3rd order
  const podiumOrder = traders.length >= 3
    ? [traders[1], traders[0], traders[2]]
    : traders.length === 2
    ? [null, traders[0], traders[1]]
    : traders.length === 1
    ? [null, traders[0], null]
    : []

  const podiumRanks = [1, 0, 2] // which rank each podium slot is

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />

      <div style={{
        background: 'linear-gradient(180deg, rgba(245,158,11,0.06) 0%, transparent 100%)',
        borderBottom: '1px solid #1f2937',
        padding: '48px 16px 32px',
        textAlign: 'center',
      }}>
        <h1 style={{
          margin: '0 0 8px', fontSize: 'clamp(28px, 5vw, 42px)',
          fontFamily: 'var(--font-display)', fontWeight: 900,
          color: '#fff', letterSpacing: '-1px',
        }}>
          🏆 <span style={{ color: '#f59e0b' }}>Leaderboard</span>
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>
          RotMarket's most trusted traders — ranked by performance.
        </p>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[
            { id: 'trades', label: '🔄 Most Trades' },
            { id: 'rating', label: '⭐ Highest Rated' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t.id ? 'rgba(245,158,11,0.15)' : '#111118',
              color: tab === t.id ? '#f59e0b' : '#6b7280',
              boxShadow: tab === t.id ? '0 0 0 1px rgba(245,158,11,0.4)' : '0 0 0 1px #2d2d3f',
              fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
          </div>
        ) : traders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <p>No traders yet. Complete your first trade to appear here!</p>
          </div>
        ) : (
          <>
            {/* Podium — only show if at least 1 trader */}
            {podiumOrder.some(t => t !== null) && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
                {podiumOrder.map((trader, i) => {
                  const rank = podiumRanks[i]
                  if (!trader) return <div key={i} style={{ flex: 1 }} />
                  return (
                    <Link key={trader.id} href={`/profile/${trader.username}`} style={{ flex: 1, textDecoration: 'none' }}>
                      <div style={{
                        background: '#111118', border: '1px solid #2d2d3f',
                        borderRadius: 14, padding: '20px 12px',
                        textAlign: 'center',
                        marginBottom: rank === 0 ? 0 : rank === 1 ? 16 : 24,
                        transition: 'transform 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        <div style={{ fontSize: 24, marginBottom: 8 }}>{MEDALS[rank]}</div>
                        <div style={{
                          width: 52, height: 52, borderRadius: '50%', margin: '0 auto 10px',
                          background: trader.avatar_url ? 'transparent' : '#1f2937',
                          overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 20, fontWeight: 900, color: MEDAL_COLORS[rank],
                          border: `2px solid ${MEDAL_COLORS[rank]}40`,
                        }}>
                          {trader.avatar_url
                            ? <img src={trader.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : getInitial(trader.username)
                          }
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#f9fafb', marginBottom: 2 }}>
                          {trader.username}
                        </div>
                        {(() => {
                          const badges = trader.badges?.length ? trader.badges : trader.badge ? [trader.badge] : []
                          const primary = getPrimaryBadge(badges)
                          const meta = primary ? BADGE_STYLES[primary] : null
                          return meta ? (
                            <div style={{ fontSize: 9, color: meta.color, marginBottom: 6, fontWeight: 700 }}>
                              {meta.icon} {primary}
                            </div>
                          ) : null
                        })()}
                        <div style={{ fontSize: 20, fontWeight: 900, color: MEDAL_COLORS[rank] }}>
                          {getValue(trader)}
                        </div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>{getLabel()}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Full list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {traders.map((trader, i) => {
                const traderBadges = trader.badges?.length ? trader.badges : trader.badge ? [trader.badge] : []
                const primaryBadge = getPrimaryBadge(traderBadges)
                const badge = primaryBadge ? BADGE_STYLES[primaryBadge] : null
                return (
                  <Link key={trader.id} href={`/profile/${trader.username}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: '#111118', border: '1px solid #1f2937',
                      borderRadius: 10, padding: '12px 16px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      transition: 'all 0.15s',
                      borderLeft: i < 3 ? `3px solid ${MEDAL_COLORS[i]}` : '3px solid #1f2937',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1a1a2e'; e.currentTarget.style.transform = 'translateX(3px)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#111118'; e.currentTarget.style.transform = 'translateX(0)' }}
                    >
                      <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                        {i < 3
                          ? <span style={{ fontSize: 18 }}>{MEDALS[i]}</span>
                          : <span style={{ fontSize: 13, fontWeight: 700, color: '#4b5563' }}>#{i + 1}</span>
                        }
                      </div>

                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                        background: trader.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 900, color: '#0a0a0f',
                      }}>
                        {trader.avatar_url
                          ? <img src={trader.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : getInitial(trader.username)
                        }
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb' }}>{trader.username}</span>
                          {badge && (
                            <span style={{
                              fontSize: 9, fontWeight: 800, color: badge.color,
                              background: badge.bg, border: `1px solid ${badge.border}`,
                              borderRadius: 3, padding: '1px 5px',
                            }}>{badge.icon} {primaryBadge}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>{trader.trade_count || 0} trades</span>
                          {trader.rating > 0 && <span style={{ fontSize: 11, color: '#6b7280' }}>⭐ {trader.rating}</span>}
                          {trader.review_count > 0 && <span style={{ fontSize: 11, color: '#6b7280' }}>{trader.review_count} reviews</span>}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#f9fafb' }}>{getValue(trader)}</div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>{getLabel()}</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
