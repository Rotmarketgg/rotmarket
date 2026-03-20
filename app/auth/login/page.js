'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from '@/lib/supabase'
import { AuthLayout } from '../signup/page'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return }
    setError('')
    setLoading(true)
    try {
      await signIn(form.email, form.password)
      router.push(redirect)
      router.refresh()
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <AuthLayout title="Welcome Back" subtitle="Log in to your RotMarket account">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
            Username or Email <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Username or email address"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="username"
            autoFocus
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>
              Password <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <Link href="/auth/reset" style={{ fontSize: 11, color: '#4ade80', textDecoration: 'none' }}>Forgot password?</Link>
          </div>
          <input
            type="password"
            placeholder="Your password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ marginTop: 4 }}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          Don't have an account?{' '}
          <Link href="/auth/signup" style={{ color: '#4ade80', fontWeight: 600, textDecoration: 'none' }}>
            Sign up free
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0f' }} />}>
      <LoginForm />
    </Suspense>
  )
}
