'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSessionUser } from '@/lib/supabase'
import { AuthLayout } from '../signup/page'

export default function VerifyEmailPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function check() {
      const user = await getSessionUser()
      // Already verified — send them home
      if (user?.email_confirmed_at) { router.replace('/'); return }
      // Not logged in at all — send to login
      if (!user) { router.replace('/auth/login'); return }
      setEmail(user.email || '')
    }
    check()

    // Poll: if they verify in another tab, redirect them automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email_confirmed_at) {
        router.replace('/')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  const handleResend = async () => {
    if (resending || resent) return
    setResending(true)
    setError('')
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (resendError) throw resendError
      setResent(true)
      // Allow resend again after 60s
      setTimeout(() => setResent(false), 60000)
    } catch (err) {
      setError(err.message || 'Failed to resend. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout title="Verify Your Email" subtitle="One last step before you can start trading">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>

        <div style={{ fontSize: 56, lineHeight: 1 }}>📬</div>

        <div>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: '#d1d5db', lineHeight: 1.6 }}>
            We sent a verification link to
          </p>
          {email && (
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#4ade80' }}>
              {email}
            </p>
          )}
        </div>

        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          Click the link in the email to verify your account. Once verified, you&apos;ll be able to post listings, send offers, and message sellers.
        </p>

        <div style={{
          padding: '14px 16px', borderRadius: 10,
          background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)',
        }}>
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
            💡 Don&apos;t see the email? Check your spam folder, or resend below.
          </p>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: '#f87171' }}>⚠️ {error}</div>
        )}

        <button
          onClick={handleResend}
          disabled={resending || resent}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
            background: resent ? 'rgba(74,222,128,0.15)' : resending ? '#1f2937' : 'linear-gradient(135deg, #16a34a, #15803d)',
            color: resent ? '#4ade80' : resending ? '#6b7280' : '#fff',
            fontSize: 14, fontWeight: 700, cursor: resending || resent ? 'default' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {resent ? '✓ Email sent — check your inbox' : resending ? 'Sending...' : 'Resend Verification Email'}
        </button>

        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login') }}
          style={{
            background: 'none', border: 'none', color: '#6b7280',
            fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          Sign out and use a different account
        </button>

      </div>
    </AuthLayout>
  )
}
