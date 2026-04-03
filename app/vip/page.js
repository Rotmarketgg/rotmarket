'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSessionUser, getProfile } from '@/lib/supabase'

const CASHAPP = '$tdowdy94'
const VENMO   = '@davari'
const PAYPAL  = 'paypal.me/rotmarket' // ← update with your real link

// ─── DATA ─────────────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: 'VIP',
    icon: '⭐',
    color: '#f59e0b',
    colorBg: 'rgba(245,158,11,0.08)',
    colorBorder: 'rgba(245,158,11,0.35)',
    price: 10,
    yearlyPrice: 80,
    featured: false,
    perks: [
      { section: 'Listing limits' },
      { text: '10 listings/day', sub: 'Up from 3 free' },
      { text: '30-day listing life' },
      { text: 'No 15-min cooldown' },
      { section: 'Profile & visibility' },
      { text: 'Gold ⭐ badge + card border' },
      { text: 'Early access to new features' },
    ],
  },
  {
    id: 'VIP Plus',
    icon: '💎',
    color: '#a78bfa',
    colorBg: 'rgba(167,139,250,0.08)',
    colorBorder: 'rgba(167,139,250,0.4)',
    price: 20,
    yearlyPrice: 160,
    featured: true,
    mostPopular: true,
    perks: [
      { section: 'Everything in VIP, plus' },
      { text: '25 listings/day' },
      { text: '60-day listing life' },
      { section: 'Power seller tools' },
      { text: 'Listing view counts', sub: "See who's looking" },
      { text: 'Listing templates', sub: 'Save & reuse your setup' },
      { text: 'Wishlist alerts', sub: 'Notified on matching posts' },
      { section: 'Profile' },
      { text: 'Purple 💎 badge + card border' },
      { text: 'Custom profile banner' },
      { text: 'Bio link on profile' },
      { section: 'Perks' },
      { text: '2× referral bonus multiplier' },
      { text: 'Monthly giveaway entries (×2)' },
    ],
  },
  {
    id: 'VIP Max',
    icon: '🔴',
    color: '#ef4444',
    colorBg: 'rgba(239,68,68,0.07)',
    colorBorder: 'rgba(239,68,68,0.35)',
    price: 40,
    yearlyPrice: 320,
    featured: false,
    perks: [
      { section: 'Everything in VIP Plus, plus' },
      { text: 'Unlimited listings/day' },
      { text: 'Permanent listings', sub: 'Never expire unless deleted' },
      { text: 'Homepage spotlight slot', sub: 'Rotating featured section' },
      { section: 'Analytics' },
      { text: 'Full seller analytics', sub: 'Views, conversion, profile visits' },
      { text: 'Price history on rarities', sub: "See what's sold & for how much" },
      { section: 'Trust & profile' },
      { text: 'Red 🔴 crown badge' },
      { text: 'Custom profile accent color' },
      { text: 'Verified payment method shown' },
      { text: 'Dispute priority review' },
      { section: 'Exclusive' },
      { text: 'Monthly giveaway entries (×3)' },
      { text: 'Beta access before VIP Plus' },
      { text: 'Dedicated support channel' },
    ],
  },
]

const COMPARISON = [
  { label: 'Listings/day',        vip: '10',      plus: '25',      max: 'Unlimited' },
  { label: 'Listing life',        vip: '30 days', plus: '60 days', max: 'Permanent' },
  { label: 'No cooldown',         vip: '✓',       plus: '✓',       max: '✓' },
  { label: 'Auto-relist',         vip: '—',       plus: '—',       max: '✓' },
  { label: 'View counts',         vip: '—',       plus: '✓',       max: '✓' },
  { label: 'Wishlist alerts',     vip: '—',       plus: '✓',       max: '✓' },
  { label: 'Full analytics',      vip: '—',       plus: '—',       max: '✓' },
  { label: 'Price history',       vip: '—',       plus: '—',       max: '✓' },
  { label: 'Homepage spotlight',  vip: '—',       plus: '—',       max: '✓' },
  { label: 'Custom banner',       vip: '—',       plus: '✓',       max: '✓' },
  { label: 'Referral multiplier', vip: '1×',      plus: '2×',      max: '3×' },
  { label: 'Giveaway entries',    vip: '×1',      plus: '×2',      max: '×3' },
  { label: 'Price/month',         vip: '$10',     plus: '$20',     max: '$40', priceRow: true },
]

const PAYMENT_METHODS = [
  { id: 'cashapp', label: 'Cash App', icon: '🟢', value: CASHAPP, note: 'Recommended' },
  { id: 'venmo',   label: 'Venmo',    icon: '💙', value: VENMO },
  { id: 'paypal',  label: 'PayPal',   icon: '🔵', value: PAYPAL,},
]

const TIER_RANK = { 'VIP': 1, 'VIP Plus': 2, 'VIP Max': 3 }

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function VIPPage() {
  const router = useRouter()

  // Auth state — null = loading, false = not logged in, object = user
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  // UI state
  const [billing, setBilling]     = useState('monthly')
  const [selected, setSelected]   = useState(null)
  const [payMethod, setPayMethod] = useState(null)
  const [copied, setCopied]       = useState('')
  const [step, setStep]           = useState(1)

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
        console.error('VIP page init error:', err)
      } finally {
        setAuthReady(true)
      }
    }
    init()
  }, [])

  // Badge detection — only runs after auth is ready
  const normalizeBadges = (p) => {
    if (Array.isArray(p?.badges)) return p.badges
    if (typeof p?.badges === 'string' && p.badges.trim()) return [p.badges.trim()]
    if (typeof p?.badge === 'string' && p.badge.trim()) return [p.badge.trim()]
    return []
  }
  const badges = normalizeBadges(profile)
  const currentTier = badges.includes('VIP Max') ? 'VIP Max'
    : badges.includes('VIP Plus') ? 'VIP Plus'
    : badges.includes('VIP') ? 'VIP'
    : null

  const isCurrentTier = (id) => currentTier === id
  const canUpgradeTo = (id) => {
    if (!currentTier) return true
    return TIER_RANK[id] > TIER_RANK[currentTier]
  }

  const lowerTierLabel = (id) => {
    if (!currentTier) return null
    if (TIER_RANK[id] < TIER_RANK[currentTier]) return `Included in ${currentTier}`
    return null
  }

  const copy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const openPayment = (tierId) => {
    if (!authReady) return
    if (!user) { router.push('/auth/login'); return }
    if (!canUpgradeTo(tierId)) return
    setSelected(tierId)
    setPayMethod(null)
    setStep(1)
  }

  const closePayment = () => { setSelected(null); setPayMethod(null); setStep(1) }

  const activeTier   = TIERS.find(t => t.id === selected)
  const activePrice  = activeTier ? (billing === 'yearly' ? activeTier.yearlyPrice : activeTier.price) : 0
  const activeMethod = PAYMENT_METHODS.find(m => m.id === payMethod)

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg,rgba(245,158,11,0.07) 0%,transparent 100%)',
        borderBottom: '1px solid #1f2937',
        padding: '52px 16px 40px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>⭐</div>
        <h1 style={{
          margin: '0 0 10px', fontSize: 'clamp(28px,5vw,44px)',
          fontFamily: 'var(--font-display)', fontWeight: 900,
          color: '#fff', letterSpacing: '-1px',
        }}>
          <span style={{ color: '#f59e0b' }}>VIP</span> Membership
        </h1>
        <p style={{ margin: '0 auto 24px', maxWidth: 500, fontSize: 15, color: '#9ca3af', lineHeight: 1.7 }}>
          Sell faster, post more, stand out. Support RotMarket and unlock the best trading experience.
        </p>

        {/* Billing toggle */}
        <div style={{
          display: 'inline-flex', background: '#111118',
          border: '1px solid #1f2937', borderRadius: 10, padding: 4, gap: 4,
        }}>
          {['monthly', 'yearly'].map(b => (
            <button key={b} onClick={() => setBilling(b)} style={{
              padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: billing === b ? '#1f2937' : 'transparent',
              color: billing === b ? '#f9fafb' : '#6b7280',
              transition: 'all 0.15s',
            }}>
              {b === 'monthly' ? 'Monthly' : 'Yearly'}
              {b === 'yearly' && (
                <span style={{ marginLeft: 6, fontSize: 10, color: '#4ade80', fontWeight: 800 }}>SAVE 33%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 16px 60px' }}>

        {/* Current plan banner */}
        {currentTier && (
          <div style={{
            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 12, padding: '12px 18px', marginBottom: 28,
            fontSize: 14, color: '#fbbf24', fontWeight: 600, textAlign: 'center',
          }}>
            You're a <strong>{currentTier}</strong> member — thank you for supporting RotMarket!
          </div>
        )}

        {/* ── Tier cards ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
          gap: 16, marginBottom: 32,
        }}>
          {TIERS.map(t => {
            const current = isCurrentTier(t.id)
            const canUpgrade = canUpgradeTo(t.id)
            const lowerTier = lowerTierLabel(t.id)
            const tierPrice = billing === 'yearly' ? t.yearlyPrice : t.price
            const yearlySave = (t.price * 12) - t.yearlyPrice
            return (
              <div key={t.id} style={{
                background: '#111118',
                border: t.featured ? `2px solid ${t.color}` : '1px solid #1f2937',
                borderRadius: 16, display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: t.featured ? `0 0 30px ${t.color}18` : 'none',
              }}>

                {t.mostPopular && (
                  <div style={{
                    background: t.color, textAlign: 'center',
                    fontSize: 10, fontWeight: 800, color: '#fff',
                    padding: '5px', letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>Most Popular</div>
                )}

                {/* Header */}
                <div style={{ padding: '22px 22px 16px', borderBottom: '1px solid #1f2937', background: t.colorBg }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: `${t.color}18`, border: `1px solid ${t.color}40`,
                    borderRadius: 99, padding: '3px 10px',
                    fontSize: 11, fontWeight: 800, color: t.color, marginBottom: 10,
                  }}>
                    {t.icon} {t.id}
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                    ${tierPrice}
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>
                      {' '}/ {billing === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  {billing === 'monthly' && (
                    <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>
                      or <span style={{ color: '#4ade80', fontWeight: 700 }}>${t.yearlyPrice}/yr</span> — save ${yearlySave}
                    </div>
                  )}
                </div>

                {/* Perks */}
                <div style={{ padding: '16px 22px', flex: 1 }}>
                  {t.perks.map((p, i) => p.section
                    ? (
                      <div key={i} style={{
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: '#4b5563',
                        marginTop: i === 0 ? 0 : 14, marginBottom: 4,
                      }}>{p.section}</div>
                    )
                    : (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingBottom: 6 }}>
                        <div style={{
                          width: 5, height: 5, borderRadius: '50%', background: t.color,
                          flexShrink: 0, marginTop: 7,
                        }} />
                        <div>
                          <div style={{ fontSize: 13, color: '#f9fafb' }}>{p.text}</div>
                          {p.sub && <div style={{ fontSize: 11, color: '#4b5563' }}>{p.sub}</div>}
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* CTA */}
                <div style={{ padding: '16px 22px', borderTop: '1px solid #1f2937' }}>
                  {current ? (
                    <div style={{
                      textAlign: 'center', padding: '11px',
                      fontSize: 13, fontWeight: 700,
                      color: t.color, background: `${t.color}12`,
                      borderRadius: 9, border: `1px solid ${t.color}30`,
                    }}>
                      {t.icon} Current Plan
                    </div>
                  ) : !authReady ? (
                    <div style={{
                      textAlign: 'center', padding: '11px',
                      fontSize: 12, fontWeight: 700,
                      color: '#6b7280', background: '#0d0d14',
                      borderRadius: 9, border: '1px solid #1f2937',
                    }}>
                      Checking account...
                    </div>
                  ) : lowerTier ? (
                    <div style={{
                      textAlign: 'center', padding: '11px',
                      fontSize: 12, fontWeight: 700,
                      color: '#6b7280', background: '#0d0d14',
                      borderRadius: 9, border: '1px solid #1f2937',
                    }}>
                      {lowerTier}
                    </div>
                  ) : (
                    <button
                      onClick={() => openPayment(t.id)}
                      disabled={!canUpgrade}
                      style={{
                        width: '100%', padding: '11px', borderRadius: 9,
                        border: 'none', cursor: 'pointer',
                        background: t.featured ? t.color : `${t.color}22`,
                        color: t.featured ? '#fff' : t.color,
                        fontSize: 13, fontWeight: 800,
                        transition: 'opacity 0.15s',
                        opacity: canUpgrade ? 1 : 0.6,
                        cursor: canUpgrade ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {currentTier ? `Upgrade to ${t.id} →` : `Get ${t.id} →`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Comparison table ───────────────────────────────────────────── */}
        <div style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid #1f2937',
            fontSize: 11, fontWeight: 800, color: '#4b5563',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>Plan Comparison</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 380 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f2937' }}>
                  <th style={{ padding: '10px 20px', textAlign: 'left', color: '#4b5563', fontWeight: 700, fontSize: 11 }}>Feature</th>
                  {[
                    { label: '⭐ VIP',      color: '#f59e0b' },
                    { label: '💎 VIP Plus', color: '#a78bfa' },
                    { label: '🔴 VIP Max',  color: '#ef4444' },
                  ].map(h => (
                    <th key={h.label} style={{ padding: '10px 20px', textAlign: 'center', color: h.color, fontWeight: 800, fontSize: 12, width: 110 }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} style={{
                    borderBottom: i < COMPARISON.length - 1 ? '1px solid #0d0d14' : 'none',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                  }}>
                    <td style={{ padding: '9px 20px', color: '#9ca3af' }}>{row.label}</td>
                    {[
                      { val: row.vip,  color: '#f59e0b' },
                      { val: row.plus, color: '#a78bfa' },
                      { val: row.max,  color: '#ef4444' },
                    ].map((cell, ci) => (
                      <td key={ci} style={{
                        padding: '9px 20px', textAlign: 'center',
                        color: cell.val === '—' ? '#2d2d3f' : (row.priceRow || cell.val === '✓') ? cell.color : '#d1d5db',
                        fontWeight: row.priceRow || cell.val === '✓' ? 800 : 500,
                      }}>
                        {cell.val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── Payment Modal ─────────────────────────────────────────────────── */}
      {selected && activeTier && (
        <div
          onClick={closePayment}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#111118',
              border: `1px solid ${activeTier.colorBorder}`,
              borderRadius: 18, padding: '28px 24px',
              width: '100%', maxWidth: 440,
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: `0 0 60px ${activeTier.color}20`,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                  Upgrade to
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: activeTier.color }}>
                  {activeTier.icon} {activeTier.id}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>${activePrice}</div>
                <div style={{ fontSize: 12, color: '#4b5563' }}>/ {billing === 'yearly' ? 'year' : 'month'}</div>
              </div>
            </div>

            {/* Step 1 — Choose method */}
            {step === 1 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Choose payment method
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setPayMethod(m.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 10, width: '100%',
                        border: payMethod === m.id ? `1px solid ${activeTier.color}` : '1px solid #1f2937',
                        background: payMethod === m.id ? `${activeTier.color}12` : '#0d0d14',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{m.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb' }}>{m.label}</div>
                        {m.note && <div style={{ fontSize: 11, color: '#4ade80' }}>{m.note}</div>}
                      </div>
                      {payMethod === m.id && <span style={{ fontSize: 16, color: activeTier.color }}>✓</span>}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => payMethod && setStep(2)}
                  disabled={!payMethod}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                    background: payMethod ? activeTier.color : '#1f2937',
                    color: payMethod ? '#fff' : '#4b5563',
                    fontSize: 14, fontWeight: 800,
                    cursor: payMethod ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                  }}
                >
                  Continue →
                </button>
              </>
            )}

            {/* Step 2 — Send payment */}
            {step === 2 && activeMethod && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Send payment
                </div>

                {/* Amount */}
                <div style={{
                  background: `${activeTier.color}12`, border: `1px solid ${activeTier.color}30`,
                  borderRadius: 10, padding: '16px', marginBottom: 14, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 2 }}>Send exactly</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: activeTier.color, lineHeight: 1 }}>${activePrice}</div>
                  <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>
                    via {activeMethod.label} · {billing} plan
                  </div>
                </div>

                {/* Handle row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#0d0d14', border: '1px solid #1f2937',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 14,
                }}>
                  <span style={{ fontSize: 22 }}>{activeMethod.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {activeMethod.label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#f9fafb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activeMethod.value}
                    </div>
                  </div>
                  <button
                    onClick={() => copy(activeMethod.value, activeMethod.id)}
                    style={{
                      padding: '6px 12px', borderRadius: 7,
                      border: '1px solid #2d2d3f',
                      background: copied === activeMethod.id ? 'rgba(74,222,128,0.12)' : 'transparent',
                      color: copied === activeMethod.id ? '#4ade80' : '#6b7280',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {copied === activeMethod.id ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                {/* Instructions */}
                <div style={{
                  background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)',
                  borderRadius: 8, padding: '12px 14px', marginBottom: 20,
                  fontSize: 12, color: '#9ca3af', lineHeight: 1.8,
                }}>
                  <strong style={{ color: '#4ade80' }}>After paying:</strong>{' '}
                  Go to the{' '}
                  <Link href="/contact" onClick={closePayment} style={{ color: '#4ade80', textDecoration: 'none', fontWeight: 700 }}>
                    Contact page
                  </Link>{' '}
                  and send your <strong style={{ color: '#f9fafb' }}>username</strong>,{' '}
                  plan (<strong style={{ color: activeTier.color }}>{activeTier.id} — {billing}</strong>),
                  and payment confirmation screenshot.
                  We'll activate your badge within <strong style={{ color: '#f9fafb' }}>24 hours</strong>.
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      flex: 1, padding: '11px', borderRadius: 10,
                      border: '1px solid #1f2937', background: 'transparent',
                      color: '#6b7280', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    ← Back
                  </button>
                  <Link
                    href="/contact"
                    onClick={closePayment}
                    style={{
                      flex: 2, padding: '11px', borderRadius: 10,
                      textDecoration: 'none', textAlign: 'center', display: 'block',
                      background: activeTier.color, color: '#fff',
                      fontSize: 13, fontWeight: 800,
                    }}
                  >
                    Confirm via Contact →
                  </Link>
                </div>
              </>
            )}

            <button
              onClick={closePayment}
              style={{
                display: 'block', margin: '16px auto 0',
                background: 'none', border: 'none',
                color: '#4b5563', fontSize: 12, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
