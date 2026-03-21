'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from '../signup/page'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const recoveryHandled = useRef(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    // The lock error happens because onAuthStateChange fires SIGNED_IN and
    // PASSWORD_RECOVERY almost simultaneously, racing over the token.
    // Fix: use a ref to ensure we only act on the FIRST relevant event,
    // and add a small delay before calling getSession to avoid the race.

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (recoveryHandled.current) return

      if (event === 'PASSWORD_RECOVERY' && session) {
        recoveryHandled.current = true
        setReady(true)
        return
      }

      // If SIGNED_IN fires first (race condition), check if it's a recovery token
      if (event === 'SIGNED_IN' && session) {
        // Give PASSWORD_RECOVERY event a chance to fire first
        setTimeout(() => {
          if (!recoveryHandled.current) {
            recoveryHandled.current = true
            setReady(true)
          }
        }, 500)
      }
    })

    // Fallback: if user refreshed the page and already has a session
    setTimeout(() => {
      if (!recoveryHandled.current) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session && !recoveryHandled.current) {
            recoveryHandled.current = true
            setReady(true)
          } else if (!session && !recoveryHandled.current) {
            // No session at all — link is expired or already used
            setExpired(true)
          }
        })
      }
    }, 1000)

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async () => {
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: form.password })
      if (error) throw error
      await supabase.auth.signOut()
      router.push('/auth/login?reset=success')
    } catch (err) {
      setError(err.message || 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  if (expired) return (
    <AuthLayout title="Link Expired" subtitle="This reset link has already been used or expired">
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
        <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
          Password reset links expire after 1 hour and can only be used once.
        </p>
        <a href="/auth/reset" style={{
          display: 'inline-block', padding: '10px 24px',
          background: '#4ade80', color: '#0a0a0f',
          borderRadius: 8, textDecoration: 'none',
          fontSize: 13, fontWeight: 700,
        }}>
          Request a new link
        </a>
      </div>
    </AuthLayout>
  )

  if (!ready) return (
    <AuthLayout title="Verifying link..." subtitle="Just a moment">
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⏳</div>
        <div style={{ color: '#6b7280', fontSize: 14 }}>Checking your reset link...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    </AuthLayout>
  )

  return (
    <AuthLayout title="New Password" subtitle="Choose a strong password">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
            New Password
          </label>
          <input
            type="password"
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
            Confirm Password
          </label>
          <input
            type="password"
            placeholder="Same password again"
            value={form.confirm}
            onChange={e => set('confirm', e.target.value)}
          />
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} className="btn-primary">
          {loading ? 'Updating...' : 'Set New Password'}
        </button>
      </div>
    </AuthLayout>
  )
}
