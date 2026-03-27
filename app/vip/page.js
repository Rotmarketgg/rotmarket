'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSessionUser, getProfile } from '@/lib/supabase'
import { withTimeout } from '@/lib/utils'
import { getPrimaryBadge } from '@/lib/constants'

const CASHAPP = '$tdowdy94'
const VENMO   = '@davari'

const VIP_PERKS = [
  { icon: '📋', title: '10 listings/day', sub: 'Free: 3  ·  Verified: 5  ·  VIP: 10' },
  { icon: '⏰', title: '30-day listing life', sub: 'Free: 7 days  ·  Verified: 14 days' },
  { icon: '⚡', title: 'No 15-min cooldown', sub: 'Post back-to-back, any time' },
  { icon: '⭐', title: 'Gold VIP badge', sub: 'On your profile & every listing' },
  { icon: '🎨', title: 'Gold card border', sub: 'Stand out instantly in browse' },
  { icon: '🥇', title: 'Early access to new features', sub: 'Always first in line' },
]

const COMPARISON = [
  { feature: 'Listings per day',  free: '3',        verified: '5',         vip: '10' },
  { feature: 'Posting cooldown',  free: '15 min',   verified: '15 min',    vip: 'None' },
  { feature: 'Listing lifetime',  free: '7 days',   verified: '14 days',   vip: '30 days' },
  { feature: 'Profile badge',     free: '—',        verified: '✓ Green',   vip: '⭐ Gold' },
  { feature: 'Card border',       free: '—',        verified: 'Rarity',    vip: 'Gold' },
  { feature: 'Monthly price',     free: 'Free',     verified: 'Free',       vip: '$10/mo' },
]

export default function VIPPage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [copied, setCopied] = useState('')
  useEffect(() => {
    async function init() {
      try {
        const u = await getSessionUser()
        if (u) {
          setUser(u)
          const p = await getProfile(u.id)
          setProfile(p)
        }
      } catch (err) {
        console.error('VIP init error:', err)
      }
    }
    init()
  }, [])

  const profileBadges = profile?.badges?.length ? profile.badges : profile?.badge ? [profile.badge] : []
  const primaryBadge = getPrimaryBadge(profileBadges)
  const isVip = primaryBadge === 'VIP' || primaryBadge === 'Owner'

  const copy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(245,158,11,0.08) 0%, transparent 100%)',
        borderBottom: '1px solid #1f2937',
        padding: '52px 16px 44px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>⭐</div>
        <h1 style={{
          margin: '0 0 10px', fontSize: 'clamp(28px, 5vw, 44px)',
          fontFamily: 'var(--font-display)', fontWeight: 900,
          color: '#fff', letterSpacing: '-1px',
        }}>
          <span style={{ color: '#f59e0b' }}>VIP</span> Membership
        </h1>
        <p style={{ margin: '0 auto', maxWidth: 520, fontSize: 15, color: '#9ca3af', lineHeight: 1.7 }}>
          Sell faster, post more, stand out. Support RotMarket and get the best trading experience.
        </p>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '44px 16px 60px' }}>

        {/* Already VIP banner */}
        {isVip && (
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 12, padding: '14px 18px', marginBottom: 24,
            fontSize: 14, color: '#fbbf24', fontWeight: 600, textAlign: 'center',
          }}>
            ⭐ You're already a VIP member. Thank you for supporting RotMarket!
          </div>
        )}

        {/* Plan comparison table */}
        <div style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #1f2937', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Plan Comparison
          </div>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 360 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2937' }}>
                <th style={{ padding: '10px 18px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>Feature</th>
                {[
                  { label: 'Free',      color: '#6b7280' },
                  { label: 'Verified',  color: '#4ade80' },
                  { label: '⭐ VIP',    color: '#f59e0b' },
                ].map(t => (
                  <th key={t.label} style={{ padding: '10px 18px', textAlign: 'center', color: t.color, fontWeight: 800, fontSize: 12, width: 90 }}>
                    {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #111118', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td style={{ padding: '10px 18px', color: '#9ca3af' }}>{row.feature}</td>
                  <td style={{ padding: '10px 18px', textAlign: 'center', color: '#4b5563' }}>{row.free}</td>
                  <td style={{ padding: '10px 18px', textAlign: 'center', color: '#4ade80' }}>{row.verified}</td>
                  <td style={{ padding: '10px 18px', textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>{row.vip}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Price card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(120,53,15,0.12))',
          border: '1px solid rgba(245,158,11,0.35)',
          borderRadius: 18, padding: '32px 28px', marginBottom: 24, textAlign: 'center',
          boxShadow: '0 0 40px rgba(245,158,11,0.1)',
        }}>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            VIP Membership
          </div>

          {/* Price — using body font so numbers render cleanly */}
          <div style={{
            fontSize: 56, fontWeight: 900, color: '#f59e0b',
            fontFamily: 'var(--font-body)', lineHeight: 1, marginBottom: 4,
            letterSpacing: '-1px',
          }}>
            $10
          </div>
          <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>
            per month · or <strong style={{ color: '#fbbf24' }}>$80/year</strong> (save $40)
          </div>

          {/* Perks grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24, textAlign: 'left' }}>
            {VIP_PERKS.map((p, i) => (
              <div key={i} style={{
                background: '#111118', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 10, padding: '12px 14px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb' }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{p.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How to pay */}
        <div style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 14, padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#f9fafb' }}>How to Get VIP</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Cash App',   value: CASHAPP, icon: '🟢', note: 'Recommended' },
              { label: 'Venmo',      value: VENMO,   icon: '💙' },
            ].map(m => (
              <div key={m.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#0d0d14', border: '1px solid #1f2937',
                borderRadius: 8, padding: '10px 14px',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                    {m.label}{m.note && <span style={{ color: '#4ade80' }}> · {m.note}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.value}
                  </div>
                </div>
                <button onClick={() => copy(m.value, m.label)} style={{
                  padding: '5px 10px', borderRadius: 6, border: '1px solid #2d2d3f',
                  background: copied === m.label ? 'rgba(74,222,128,0.15)' : 'transparent',
                  color: copied === m.label ? '#4ade80' : '#6b7280',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                }}>
                  {copied === m.label ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
          <div style={{
            background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)',
            borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#9ca3af', lineHeight: 1.7,
          }}>
            <strong style={{ color: '#4ade80' }}>After paying:</strong>{' '}
            Send a message through the{' '}
            <Link href="/contact" style={{ color: '#4ade80', textDecoration: 'none' }}>Contact page</Link>
            {' '}with your username and payment confirmation. We'll activate your VIP badge within 24 hours.
          </div>
        </div>

      </div>
    </div>
  )
}
