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
  const recoveryHandled = useRef(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (recoveryHandled.current) return
      if (event === 'PASSWORD_RECOVERY' && session) {
        recoveryHandled.current = true
        setReady(true)
        return
      }
      if (event === 'SIGNED_IN' && session) {
        setTimeout(() => {
          if (!recoveryHandled.current) {
            recoveryHandled.current = true
            setReady(true)
          }
        }, 500)
      }
    })

    setTimeout(() => {
      if (!recoveryHandled.current) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session && !recoveryHandled.current) {
            recoveryHandled.current = true
            setReady(true)
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

      // Don't await signOut — it can hang after updateUser.
      // Fire and forget, then redirect immediately.
      supabase.auth.signOut().catch(() => {})
      router.push('/auth/login?reset=success')
    } catch (err) {
      setError(err.message || 'Failed to update password.')
      setLoading(false)
    }
  }

  if (!ready) return (
    <AuthLayout title="Verifying link..." subtitle="Just a moment">
      <div style={{ textAlign: 'center', padding: '20px 0', color: '#6b7280', fontSize: 14 }}>
        Checking your reset link...
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
