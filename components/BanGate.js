'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Pages that banned users can still access (so they can log out)
const ALLOWED_PATHS = ['/auth/login', '/auth/signup', '/auth/reset', '/auth/update-password']

export default function BanGate({ children }) {
  const pathname = usePathname()
  const [banned, setBanned] = useState(false)
  const [banReason, setBanReason] = useState(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setChecked(true); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('banned, ban_reason')
        .eq('id', session.user.id)
        .single()

      if (profile?.banned) {
        setBanned(true)
        setBanReason(profile.ban_reason || null)
      }
      setChecked(true)
    }
    check()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip token refresh events — no need to re-check ban on every silent refresh
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return

      if (!session) {
        setBanned(false)
        setBanReason(null)
        setChecked(true)
        return
      }

      // Only re-check ban on actual sign-in events
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('banned, ban_reason')
          .eq('id', session.user.id)
          .single()
        if (profile?.banned) {
          setBanned(true)
          setBanReason(profile.ban_reason || null)
        } else {
          setBanned(false)
          setBanReason(null)
        }
        setChecked(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Don't flash anything while checking
  if (!checked) return children

  // Let banned users access auth pages so they can sign out / appeal
  if (banned && !ALLOWED_PATHS.some(p => pathname?.startsWith(p))) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', textAlign: 'center', padding: 24,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>🚫</div>
        <h1 style={{
          margin: '0 0 12px', fontSize: 32, fontWeight: 900,
          color: '#f9fafb', letterSpacing: '-0.5px',
        }}>
          You've been banned
        </h1>
        <p style={{ margin: '0 0 8px', fontSize: 15, color: '#9ca3af', maxWidth: 420, lineHeight: 1.7 }}>
          Your account has been suspended from RotMarket for violating our community guidelines.
        </p>
        {banReason && (
          <div style={{
            margin: '16px 0 0', padding: '12px 20px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10, maxWidth: 420,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reason</div>
            <div style={{ fontSize: 14, color: '#fca5a5' }}>{banReason}</div>
          </div>
        )}
        <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/contact" style={{
            padding: '10px 22px', borderRadius: 8, textDecoration: 'none',
            background: 'transparent', border: '1px solid #2d2d3f',
            color: '#9ca3af', fontSize: 13, fontWeight: 600,
          }}>Appeal via Contact</a>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#1f2937', color: '#6b7280', fontSize: 13, fontWeight: 600,
            }}>
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return children
}
