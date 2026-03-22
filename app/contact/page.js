'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

const TOPICS = [
  { id: 'scam', label: 'Report a Scam', emoji: '🚨', description: 'Report a user who scammed or attempted to scam you' },
  { id: 'bug', label: 'Report a Bug', emoji: '🐛', description: 'Something on the site isn\'t working correctly' },
  { id: 'listing', label: 'Report a Listing', emoji: '🗑️', description: 'A listing contains false info or violates our terms' },
  { id: 'account', label: 'Account Issue', emoji: '🔐', description: 'Trouble logging in or accessing your account' },
  { id: 'badge', label: 'Badge Request', emoji: '✓', description: 'Request a Verified Trader badge review' },
  { id: 'other', label: 'General Question', emoji: '💬', description: 'Anything else we can help with' },
]

export default function ContactPage() {
  const [form, setForm] = useState({ topic: '', username: '', email: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.topic) { setError('Please select a topic.'); return }
    if (!form.email || !form.email.includes('@')) { setError('Please enter a valid email.'); return }
    if (!form.message.trim() || form.message.trim().length < 20) { setError('Please provide more detail (at least 20 characters).'); return }
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to send')
      setSubmitted(true)
    } catch {
      setError('Failed to send message. Please try again or email us directly.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 520, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
        <div style={{
          background: '#111118', border: '1px solid rgba(74,222,128,0.3)',
          borderRadius: 16, padding: '48px 32px',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#4ade80', margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900 }}>
            Message Sent
          </h2>
          <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.7, margin: '0 0 24px' }}>
            We'll respond to <strong style={{ color: '#d1d5db' }}>{form.email}</strong> as soon as possible. For urgent scam reports, also use the Report button directly on the user's profile.
          </p>
          <Link href="/" style={{
            display: 'inline-block', padding: '10px 24px',
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            color: '#fff', textDecoration: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 700,
          }}>Back to Browse</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            margin: '0 0 8px', fontSize: 32, fontWeight: 900,
            color: '#f9fafb', fontFamily: 'var(--font-display)',
          }}>
            Contact Us
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            We typically respond within 24 hours. For urgent issues, select the Scam report option.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Topic selection */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Topic <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TOPICS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set('topic', t.id)}
                  style={{
                    textAlign: 'left', padding: '12px 14px',
                    borderRadius: 10, cursor: 'pointer',
                    background: form.topic === t.id ? 'rgba(74,222,128,0.08)' : '#0d0d14',
                    border: form.topic === t.id ? '1px solid rgba(74,222,128,0.35)' : '1px solid #2d2d3f',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 15 }}>{t.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: form.topic === t.id ? '#4ade80' : '#d1d5db' }}>
                      {t.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, paddingLeft: 23 }}>
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Your Email <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="email"
              placeholder="you@email.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
            />
          </div>

          {/* Username */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              RotMarket Username <span style={{ color: '#4b5563', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Your username if you have one"
              value={form.username}
              onChange={e => set('username', e.target.value)}
            />
          </div>

          {/* Message */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Message <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows={6}
              placeholder={
                form.topic === 'scam'
                  ? 'Describe what happened: who scammed you, what listing, what payment method, and any evidence (screenshots, listing ID, etc.)...'
                  : form.topic === 'badge'
                  ? 'Tell us your username, your trade count, and why you\'re requesting a badge review...'
                  : form.topic === 'bug'
                  ? 'Describe what happened, what page you were on, and what you expected to happen...'
                  : 'Describe your issue in as much detail as possible...'
              }
              value={form.message}
              onChange={e => set('message', e.target.value)}
              style={{ resize: 'vertical', minHeight: 140 }}
            />
            <div style={{ fontSize: 11, color: '#4b5563', textAlign: 'right', marginTop: 4 }}>
              {form.message.length} characters
            </div>
          </div>

          {/* Scam warning */}
          {form.topic === 'scam' && (
            <div style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>
                🚨 Important — PayPal scam recovery
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.7 }}>
                If you paid via PayPal Goods & Services, open a dispute through PayPal directly for the fastest resolution. We cannot reverse payments but we will ban the scammer. Include the listing ID and their PayPal email in your message.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171',
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !form.topic || !form.email || !form.message.trim()}
            className="btn-primary"
            style={{ fontSize: 14, padding: '14px 0' }}
            type="button"
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>

          <p style={{ margin: 0, fontSize: 11, color: '#4b5563', textAlign: 'center', lineHeight: 1.6 }}>
            By submitting you agree to our{' '}
            <Link href="/terms" style={{ color: '#4ade80', textDecoration: 'none' }}>Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" style={{ color: '#4ade80', textDecoration: 'none' }}>Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
