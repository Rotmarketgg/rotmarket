'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from '../signup/page'

export default function ResetPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email.includes('@')) { setError('Enter a valid email.'); return }
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/update-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) return (
    <AuthLayout title="Check Your Email">
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
        <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.7 }}>
          We sent a password reset link to <strong style={{ color: '#f9fafb' }}>{email}</strong>.
        </p>
        <Link href="/auth/login" style={{
          display: 'inline-block', marginTop: 20, padding: '10px 24px',
          background: '#4ade80', color: '#0a0a0f', borderRadius: 8,
          textDecoration: 'none', fontSize: 13, fontWeight: 700,
        }}>Back to Login</Link>
      </div>
    </AuthLayout>
  )

  return (
    <AuthLayout title="Reset Password" subtitle="We'll send you a reset link">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Email</label>
          <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} className="btn-primary">
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          <Link href="/auth/login" style={{ color: '#4ade80', textDecoration: 'none' }}>Back to login</Link>
        </div>
      </div>
    </AuthLayout>
  )
}
