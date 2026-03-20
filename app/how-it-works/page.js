'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const STEPS = [
  {
    number: '01',
    title: 'Create Your Account',
    description: 'Sign up free in under a minute. Set your username, add your Epic or Roblox username, and add your payment info so buyers can pay you directly.',
    icon: '👤',
    color: '#4ade80',
  },
  {
    number: '02',
    title: 'Post a Listing',
    description: 'List your Brainrot for sale or trade. Choose your game, rarity, set a price or trade offer, and upload screenshots. Listings are free forever.',
    icon: '📋',
    color: '#60a5fa',
  },
  {
    number: '03',
    title: 'Receive Offers',
    description: 'Buyers browse and send you offers with a message. You review each offer and choose to accept or decline — no pressure, no spam.',
    icon: '📨',
    color: '#a78bfa',
  },
  {
    number: '04',
    title: 'Complete the Trade',
    description: 'Once you accept an offer, your payment info is revealed to the buyer. Use PayPal Goods & Services for buyer protection. Both parties confirm when the trade is done.',
    icon: '🤝',
    color: '#f59e0b',
  },
  {
    number: '05',
    title: 'Leave a Review',
    description: 'After both parties confirm, reviews unlock. Your reputation score builds with every successful trade — making future trades faster and easier.',
    icon: '⭐',
    color: '#4ade80',
  },
]

const FAQS = [
  {
    q: 'Is RotMarket free?',
    a: 'Yes — posting listings is free. Free accounts can post 3 listings per day (1 per 15 minutes) and listings stay active for 7 days. Verified Traders get 5/day and 14-day listings. VIP members get 10/day, no cooldown, and 30-day listings. Promoted listings and VIP membership are optional paid features.',
  },
  {
    q: 'How do I stay safe from scams?',
    a: 'Always use PayPal Goods & Services — never Friends & Family. Check a trader\'s review count and trade history before agreeing. Use our trade confirmation system so both parties confirm before reviews are posted.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'PayPal G&S (recommended), Cash App, and Venmo. Always use business or goods & services payment options, never personal transfers, so you have recourse if something goes wrong.',
  },
  {
    q: 'Is RotMarket affiliated with Epic Games or Roblox?',
    a: 'No. RotMarket is an independent community marketplace. We are not affiliated with or endorsed by Epic Games or Roblox Corporation.',
  },
  {
    q: 'How do I get a Verified Trader badge?',
    a: 'Verified Trader badges are awarded automatically once you receive 25 five-star reviews. There\'s no application process — just trade honestly, deliver on your listings, and the badge is granted the moment your 25th five-star review comes in. Your badge will never be revoked as long as your account remains in good standing.',
  },
  {
    q: 'What happens if I get scammed?',
    a: 'Use the Report button on the scammer\'s profile or listing to file a report with our moderation team. If you used PayPal G&S, also open a dispute through PayPal directly. We take scam reports seriously and ban confirmed bad actors.',
  },
  {
    q: 'How do I report a user or listing?',
    a: 'Every listing and profile has a Report button. Select the reason, add details, and submit. Our moderation team reviews all reports. For urgent issues use the Contact page directly.',
  },
]

export default function HowItWorksPage() {
  const [user, setUser] = useState(null)
  const [openFaq, setOpenFaq] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
    })
  }, [])

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(74,222,128,0.06) 0%, transparent 100%)',
        borderBottom: '1px solid #1f2937',
        padding: '60px 16px 48px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h1 style={{
            margin: '0 0 12px',
            fontSize: 'clamp(28px, 5vw, 44px)',
            fontFamily: 'var(--font-display)', fontWeight: 900,
            color: '#fff', letterSpacing: '-1px',
          }}>
            How <span style={{ color: '#4ade80' }}>RotMarket</span> Works
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 15, color: '#9ca3af', lineHeight: 1.7 }}>
            The safest way to buy, sell, and trade Brainrots. Every feature is built around protecting both buyers and sellers.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {!user && (
              <Link href="/auth/signup" style={{
                display: 'inline-block', padding: '12px 28px',
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff', textDecoration: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 700,
                boxShadow: '0 4px 20px rgba(22,163,74,0.4)',
              }}>
                Start Trading Free
              </Link>
            )}
            <Link href="/" style={{
              display: 'inline-block', padding: '12px 28px',
              background: 'transparent', border: '1px solid #2d2d3f',
              color: '#9ca3af', textDecoration: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600,
            }}>
              Browse Listings
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 16px' }}>

        {/* Steps */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ margin: '0 0 32px', fontSize: 20, fontWeight: 700, color: '#f9fafb', textAlign: 'center' }}>
            5 Steps to a Successful Trade
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                {i < STEPS.length - 1 && (
                  <div style={{
                    position: 'absolute', left: 23, top: 52, bottom: -8,
                    width: 2, background: 'linear-gradient(180deg, #2d2d3f, transparent)',
                  }} />
                )}
                <div style={{ flexShrink: 0, zIndex: 1 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `${step.color}15`,
                    border: `2px solid ${step.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>{step.icon}</div>
                </div>
                <div style={{
                  flex: 1, background: '#111118', border: '1px solid #1f2937',
                  borderRadius: 12, padding: '16px 20px', marginBottom: 12,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: step.color, letterSpacing: '0.1em', marginBottom: 4 }}>
                    STEP {step.number}
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#f9fafb' }}>{step.title}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.7 }}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety callout */}
        <div style={{
          background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)',
          borderRadius: 16, padding: '24px 28px', marginBottom: 64,
          display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 36 }}>🛡️</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#4ade80' }}>Safety First</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.8 }}>
              Payment info is only revealed after a seller accepts your offer. Reviews only unlock after both parties confirm the trade is complete. Every listing and profile has a Report button — our moderation team reviews all reports and bans confirmed bad actors.
            </p>
          </div>
        </div>

        {/* FAQ accordion */}
        <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#f9fafb' }}>
          Frequently Asked Questions
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{
              background: '#111118',
              border: `1px solid ${openFaq === i ? 'rgba(74,222,128,0.3)' : '#1f2937'}`,
              borderRadius: 12, overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb' }}>{faq.q}</span>
                <span style={{
                  fontSize: 18, color: '#6b7280', flexShrink: 0,
                  transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0)',
                  transition: 'transform 0.2s',
                }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 20px 16px' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.7 }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        {!user && (
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>Ready to start trading?</p>
            <Link href="/auth/signup" style={{
              display: 'inline-block', padding: '12px 28px',
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              color: '#fff', textDecoration: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700,
            }}>Create Free Account</Link>
          </div>
        )}
      </div>
    </div>
  )
}
