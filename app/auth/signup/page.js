'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signUp } from '@/lib/supabase'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '', username: '', confirm: '', referralCode: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) setForm(f => ({ ...f, referralCode: ref.toUpperCase() }))
  }, [searchParams])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    if (!form.username || form.username.length < 3) return 'Username must be at least 3 characters'
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return 'Username can only contain letters, numbers, and underscores'
    if (!form.email.includes('@')) return 'Enter a valid email'
    if (form.password.length < 8) return 'Password must be at least 8 characters'
    if (form.password !== form.confirm) return 'Passwords do not match'
    return null
  }

  const handleSubmit = async () => {
    if (loading) return
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setLoading(true)
    try {
      await signUp(form.email, form.password, form.username, form.referralCode || null)
      setSuccess(true)
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('Database error finding user') || msg.includes('User already registered') || msg.includes('already been registered')) {
        setError('An account with this email already exists.')
      } else if (msg.includes('already taken')) {
        setError(msg)
      } else {
        setError(msg || 'Failed to create account. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSubmit() }

  if (success) return (
    <AuthLayout title="Check Your Email">
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
        <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.7 }}>
          We sent a confirmation link to <strong style={{ color: '#f9fafb' }}>{form.email}</strong>.<br />
          Click it to activate your account, then come back to log in.
        </p>
        <Link href="/auth/login" style={{
          display: 'inline-block', marginTop: 20, padding: '10px 24px',
          background: '#4ade80', color: '#0a0a0f', borderRadius: 8,
          textDecoration: 'none', fontSize: 13, fontWeight: 700,
        }}>Go to Login</Link>
      </div>
    </AuthLayout>
  )

  return (
    <AuthLayout title="Create Account" subtitle="Start trading Brainrots for free">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Username" required>
          <input type="text" placeholder="VaultKing_AL" value={form.username}
            onChange={e => set('username', e.target.value.replace(/\s/g, ''))}
            onKeyDown={handleKeyDown} maxLength={20} autoComplete="username" autoFocus />
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 3 }}>Letters, numbers, underscores only. This is public.</div>
        </Field>
        <Field label="Email" required>
          <input type="email" placeholder="you@email.com" value={form.email}
            onChange={e => set('email', e.target.value)} onKeyDown={handleKeyDown} autoComplete="email" />
        </Field>
        <Field label="Password" required>
          <input type="password" placeholder="Min. 8 characters" value={form.password}
            onChange={e => set('password', e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
        </Field>
        <Field label="Confirm Password" required>
          <input type="password" placeholder="Same password again" value={form.confirm}
            onChange={e => set('confirm', e.target.value)} onKeyDown={handleKeyDown} autoComplete="new-password" />
        </Field>
        <Field label="Referral Code">
          <input type="text" placeholder="Optional — enter a friend's code"
            value={form.referralCode}
            onChange={e => set('referralCode', e.target.value.toUpperCase().replace(/\s/g, ''))}
            onKeyDown={handleKeyDown} maxLength={12} autoComplete="off"
            style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }} />
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 3 }}>
            🎁 Using a referral code gives you a <span style={{ color: '#a78bfa' }}>Referred</span> badge instantly.
          </div>
        </Field>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
            ⚠️ {error}
            {error.includes('already exists') && (
              <div style={{ marginTop: 8 }}>
                <Link href="/auth/login" style={{ color: '#4ade80', fontWeight: 700, textDecoration: 'none' }}>→ Log in instead</Link>
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
          By signing up you agree to our{' '}
          <Link href="/terms" style={{ color: '#4ade80' }}>Terms of Service</Link> and{' '}
          <Link href="/privacy" style={{ color: '#4ade80' }}>Privacy Policy</Link>.
        </div>
        <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ marginTop: 4 }}>
          {loading ? 'Creating Account...' : 'Create Free Account'}
        </button>
        <div style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: '#4ade80', fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
        </div>
      </div>
    </AuthLayout>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthLayout title="Create Account"><div style={{ textAlign: 'center', color: '#6b7280' }}>Loading…</div></AuthLayout>}>
      <SignupForm />
    </Suspense>
  )
}

function Field({ label, children, required }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export function AuthLayout({ title, subtitle, children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#4ade80', fontFamily: 'var(--font-display)' }}>ROT</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-display)' }}>MARKET</span>
          </Link>
        </div>
        <div style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 16, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: '#f9fafb', fontFamily: 'var(--font-display)' }}>{title}</h1>
          {subtitle && <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}
