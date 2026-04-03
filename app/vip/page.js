'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSessionUser, getProfile } from '@/lib/supabase'
import { getPrimaryBadge } from '@/lib/constants'

const CASHAPP = '$tdowdy94'
const VENMO   = '@davari'
const PAYPAL  = 'paypal.me/rotmarket' // update with your real PayPal link

// ─── TIER DEFINITIONS ─────────────────────────────────────────────────────────

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
      { text: 'Auto-relist on expiry', sub: 'Listings never go dark' },
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
      { text: 'Discord VIP+ role' },
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
      { text: 'Red 🔴 crown badge (rarest)' },
      { text: 'Custom profile accent color' },
      { text: 'Verified payment method shown' },
      { text: 'Dispute priority review' },
      { section: 'Exclusive' },
      { text: 'VIP Max leaderboard tab' },
      { text: 'Monthly giveaway entries (×5)' },
      { text: 'Beta access before VIP Plus' },
      { text: 'Dedicated support channel' },
    ],
  },
]

const COMPARISON = [
  { label: 'Listings/day',       vip: '10',      plus: '25',      max: 'Unlimited' },
  { label: 'Listing life',       vip: '30 days', plus: '60 days', max: 'Permanent' },
  { label: 'Auto-relist',        vip: '—',       plus: '✓',       max: '✓' },
  { label: 'View counts',        vip: '—',       plus: '✓',       max: '✓' },
  { label: 'Full analytics',     vip: '—',       plus: '—',       max: '✓' },
  { label: 'Price history',      vip: '—',       plus: '—',       max: '✓' },
  { label: 'Homepage spotlight', vip: '—',       plus: '—',       max: '✓' },
  { label: 'Custom banner',      vip: '—',       plus: '✓',       max: '✓' },
  { label: 'Wishlist alerts',    vip: '—',       plus: '✓',       max: '✓' },
  { label: 'Referral bonus',     vip: '1×',      plus: '2×',      max: '3×' },
  { label: 'Giveaway entries',   vip: '×1',      plus: '×2',      max: '×5' },
  { label: 'Price/month',        vip: '$10',     plus: '$20',     max: '$40', priceRow: true },
]

const PAYMENT_METHODS = [
  { id: 'cashapp', label: 'Cash App', icon: '🟢', value: CASHAPP, note: 'Recommended' },
  { id: 'venmo',   label: 'Venmo',    icon: '💙', value: VENMO },
  { id: 'paypal',  label: 'PayPal',   icon: '🔵', value: PAYPAL, note: 'Goods & Services' },
]

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function VIPPage() {
  const router = useRouter()
  const [profile, setProfile]     = useState(null)
  const [billing, setBilling]     = useState('monthly')
  const [selected, setSelected]   = useState(null)
  const [payMethod, setPayMethod] = useState(null)
  const [copied, setCopied]       = useState('')
  const [step, setStep]           = useState(1)
  const [loggedIn, setLoggedIn]   = useState(false)

  useEffect(() => {
    async function init() {
      try {
        const { getSessionUser } = await import('@/lib/supabase')
        const u = await getSessionUser()
        if (u) {
          setLoggedIn(true)
          const { getProfile } = await import('@/lib/supabase')
          const p = await getProfile(u.id)
          setProfile(p)
        }
      } catch (err) { console.error('VIP init:', err) }
    }
    init()
  }, [])

  const badges      = profile?.badges?.length ? profile.badges : profile?.badge ? [profile.badge] : []
  const primary     = getPrimaryBadge(badges)
  const isVipMax    = primary === 'VIP Max'  || primary === 'Owner'
  const isVipPlus   = primary === 'VIP Plus' || isVipMax
  const isVip       = primary === 'VIP'      || isVipPlus

  const isOwned = (id) => {
    if (id === 'VIP Max')  return isVipMax
    if (id === 'VIP Plus') return isVipPlus
    if (id === 'VIP')      return isVip
    return false
  }

  const copy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const openPayment = (tierId) => {
    if (!loggedIn) { router.push('/auth/login'); return }
    setSelected(tierId); setPayMethod(null); setStep(1)
  }

  const closePayment = () => { setSelected(null); setPayMethod(null); setStep(1) }

  const tier   = TIERS.find(t => t.id === selected)
  const price  = tier ? (billing === 'yearly' ? tier.yearlyPrice : tier.price) : 0
  const method = PAYMENT_METHODS.find(m => m.id === payMethod)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh' }}>

      {/* Hero */}
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
          Sell faster, post more, stand out. Support RotMarket and get the best trading experience.
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
        {primary && ['VIP', 'VIP Plus', 'VIP Max'].includes(primary) && (
          <div style={{
            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 12, padding: '12px 18px', marginBottom: 28,
            fontSize: 14, color: '#fbbf24', fontWeight: 600, textAlign: 'center',
          }}>
            You're a <strong>{primary}</strong> member — thank you for supporting RotMarket!
          </div>
        )}

        {/* Tier cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
          gap: 16, marginBottom: 32,
        }}>
          {TIERS.map(t => {
            const owned      = isOwned(t.id)
            const tierPrice  = billing === 'yearly' ? t.yearlyPrice : t.price
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
                  }}>
                    Most Popular
                  </div>
                )}

                {/* Card header */}
                <div style={{
                  padding: '22px 22px 16px', borderBottom: '1px solid #1f2937',
                  background: t.colorBg,
                }}>
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
                      or{' '}
                      <span style={{ color: '#4ade80', fontWeight: 700 }}>${t.yearlyPrice}/yr</span>
                      {' '}— save ${yearlySave}
                    </div>
                  )}
                </div>

                {/* Perks list */}
                <div style={{ padding: '16px 22px', flex: 1 }}>
                  {t.perks.map((p, i) => p.section
                    ? (
                      <div key={i} style={{
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: '#4b5563',
                        marginTop: i === 0 ? 0 : 14, marginBottom: 4,
                      }}>
                        {p.section}
                      </div>
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
                  {owned
                    ? (
                      <div style={{ textAlign: 'center', padding: '10px', fontSize: 13, fontWeight: 700, color: t.color }}>
                        {t.icon} Current Plan
                      </div>
                    )
                    : (
                      <button onClick={() => openPayment(t.id)} style={{
                        width: '100%', padding: '11px', borderRadius: 9,
                        border: 'none', cursor: 'pointer',
                        background: t.featured ? t.color : `${t.color}22`,
                        color: t.featured ? '#fff' : t.color,
                        fontSize: 13, fontWeight: 800,
                      }}>
                        Get {t.id} →
                      </button>
                    )
                  }
                </div>
              </div>
            )
          })}
        </div>

        {/* Comparison table */}
        <div style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid #1f2937',
            fontSize: 11, fontWeight: 800, color: '#4b5563',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Plan Comparison
          </div>
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
                        color: cell.val === '—'
                          ? '#2d2d3f'
                          : row.priceRow || cell.val === '✓'
                            ? cell.color
                            : '#d1d5db',
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

      {/* ── Payment Modal ──────────────────────────────────────────────────────── */}
      {selected && tier && (
        <div
          onClick={closePayment}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#111118',
              border: `1px solid ${tier.colorBorder}`,
              borderRadius: 18, padding: '28px 24px',
              width: '100%', maxWidth: 440,
              boxShadow: `0 0 60px ${tier.color}20`,
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                  Upgrade to
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: tier.color }}>
                  {tier.icon} {tier.id}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>${price}</div>
                <div style={{ fontSize: 12, color: '#4b5563' }}>/ {billing === 'yearly' ? 'year' : 'month'}</div>
              </div>
            </div>

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
                        padding: '12px 14px', borderRadius: 10,
                        border: payMethod === m.id ? `1px solid ${tier.color}` : '1px solid #1f2937',
                        background: payMethod === m.id ? `${tier.color}12` : '#0d0d14',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{m.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb' }}>{m.label}</div>
                        {m.note && <div style={{ fontSize: 11, color: '#4ade80' }}>{m.note}</div>}
                      </div>
                      {payMethod === m.id && (
                        <span style={{ fontSize: 16, color: tier.color }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => payMethod && setStep(2)}
                  disabled={!payMethod}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                    background: payMethod ? tier.color : '#1f2937',
                    color: payMethod ? '#fff' : '#4b5563',
                    fontSize: 14, fontWeight: 800,
                    cursor: payMethod ? 'pointer' : 'default',
                  }}
                >
                  Continue →
                </button>
              </>
            )}

            {step === 2 && method && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Send payment
                </div>

                {/* Amount */}
                <div style={{
                  background: `${tier.color}12`, border: `1px solid ${tier.color}30`,
                  borderRadius: 10, padding: '14px 16px', marginBottom: 14, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 2 }}>Send exactly</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: tier.color }}>${price}</div>
                  <div style={{ fontSize: 12, color: '#4b5563' }}>via {method.label}</div>
                </div>

                {/* Payment handle */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#0d0d14', border: '1px solid #1f2937',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 14,
                }}>
                  <span style={{ fontSize: 22 }}>{method.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{method.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#f9fafb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {method.value}
                    </div>
                  </div>
                  <button onClick={() => copy(method.value, method.id)} style={{
                    padding: '6px 12px', borderRadius: 7, border: '1px solid #2d2d3f',
                    background: copied === method.id ? 'rgba(74,222,128,0.12)' : 'transparent',
                    color: copied === method.id ? '#4ade80' : '#6b7280',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  }}>
                    {copied === method.id ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                {/* Instructions */}
                <div style={{
                  background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)',
                  borderRadius: 8, padding: '12px 14px', marginBottom: 20,
                  fontSize: 12, color: '#9ca3af', lineHeight: 1.7,
                }}>
                  <strong style={{ color: '#4ade80' }}>After paying:</strong>{' '}
                  Go to the{' '}
                  <Link href="/contact" style={{ color: '#4ade80', textDecoration: 'none' }}>Contact page</Link>
                  {' '}and send your username, plan (<strong style={{ color: '#f9fafb' }}>{tier.id} — {billing}</strong>), and payment confirmation. We'll activate your badge within 24 hours.
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setStep(1)} style={{
                    flex: 1, padding: '11px', borderRadius: 10,
                    border: '1px solid #1f2937', background: 'transparent',
                    color: '#6b7280', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>
                    ← Back
                  </button>
                  <Link href="/contact" style={{
                    flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                    textDecoration: 'none',
                    background: tier.color, color: '#fff',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    textAlign: 'center', display: 'block',
                  }}>
                    Confirm on Contact page →
                  </Link>
                </div>
              </>
            )}

            <button onClick={closePayment} style={{
              display: 'block', margin: '14px auto 0',
              background: 'none', border: 'none',
              color: '#4b5563', fontSize: 12, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
