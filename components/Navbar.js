'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase, getProfile, getUnreadCount } from '@/lib/supabase'
import { getInitial } from '@/lib/utils'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const menuRef = useRef(null)
  const mobileMenuRef = useRef(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [unread, setUnread] = useState(0)
  const [pendingOffers, setPendingOffers] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const fetchPendingOffers = async (userId) => {
    const { count } = await supabase
      .from('trade_requests')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .eq('status', 'pending')
    setPendingOffers(count || 0)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        getProfile(session.user.id).then(setProfile)
        getUnreadCount(session.user.id).then(setUnread)
        fetchPendingOffers(session.user.id)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore token refresh events — these fire SIGNED_OUT then SIGNED_IN
      // in quick succession and cause a visible "logged out" flash
      if (event === 'TOKEN_REFRESHED') return
      if (event === 'INITIAL_SESSION') return

      if (session?.user) {
        setUser(session.user)
        getProfile(session.user.id).then(setProfile)
        getUnreadCount(session.user.id).then(setUnread)
        fetchPendingOffers(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        // Only clear state on explicit sign-out, not transient token events
        setUser(null); setProfile(null); setUnread(0); setPendingOffers(0)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Real-time unread messages
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => getUnreadCount(user.id).then(setUnread))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => getUnreadCount(user.id).then(setUnread))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  // Real-time pending offers
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`offers-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trade_requests', filter: `seller_id=eq.${user.id}` }, () => fetchPendingOffers(user.id))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trade_requests', filter: `seller_id=eq.${user.id}` }, () => fetchPendingOffers(user.id))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) setMobileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleSignOut = async () => {
    // Clear local state immediately so UI updates right away
    setUser(null)
    setProfile(null)
    setUnread(0)
    setPendingOffers(0)
    setMenuOpen(false)
    setMobileOpen(false)
    await supabase.auth.signOut()
    // Use window.location instead of router.push so the full page
    // re-initialises from scratch with no stale session in memory
    window.location.href = '/'
  }

  const isActive = (href) => pathname === href

  const NAV_LINKS = [
    { href: '/', label: 'Browse' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/vip', label: '⭐ VIP', vip: true },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/contact', label: 'Contact' },
  ]

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(10,10,15,0.95)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid #1f2937',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 60, gap: 12 }}>

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#4ade80', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>ROT</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>MARKET</span>
          </Link>

          {/* Desktop nav links — hidden below 768px */}
          <div style={{ display: 'flex', gap: 2, flex: 1, alignItems: 'center' }} className="desktop-nav">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href} style={{
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                padding: '6px 10px', borderRadius: 8, whiteSpace: 'nowrap',
                color: link.vip
                  ? (isActive('/vip') ? '#f59e0b' : '#d97706')
                  : isActive(link.href) ? '#4ade80' : '#9ca3af',
                background: link.vip
                  ? (isActive('/vip') ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.06)')
                  : isActive(link.href) ? 'rgba(74,222,128,0.08)' : 'transparent',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => {
                  if (link.vip) { e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.background = 'rgba(245,158,11,0.12)' }
                  else if (!isActive(link.href)) { e.currentTarget.style.color = '#f9fafb'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }
                }}
                onMouseLeave={e => {
                  if (link.vip) { e.currentTarget.style.color = isActive('/vip') ? '#f59e0b' : '#d97706'; e.currentTarget.style.background = isActive('/vip') ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.06)' }
                  else if (!isActive(link.href)) { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent' }
                }}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/create" className="desktop-nav" style={{
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
              padding: '6px 14px', borderRadius: 8, marginLeft: 6,
              color: '#0a0a0f', background: '#4ade80',
              transition: 'all 0.15s', flexShrink: 0, whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#22c55e'}
              onMouseLeave={e => e.currentTarget.style.background = '#4ade80'}
            >
              + List Item
            </Link>
          </div>

          {/* Spacer on mobile so right side aligns */}
          <div style={{ flex: 1 }} className="mobile-spacer" />

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {user ? (
              <>
                {/* Pending offers — mobile: just icon */}
                {pendingOffers > 0 && (
                  <Link href={profile?.username ? `/profile/${profile.username}` : '/'} style={{ textDecoration: 'none' }}>
                    <div style={{
                      height: 38, borderRadius: 8, padding: '0 10px',
                      background: 'rgba(245,158,11,0.12)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      display: 'flex', alignItems: 'center', gap: 5,
                      animation: 'pulse-offer 2s infinite',
                    }}>
                      <span style={{ fontSize: 15 }}>📨</span>
                      <span className="desktop-nav" style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>
                        {pendingOffers}
                      </span>
                    </div>
                  </Link>
                )}

                {/* Inbox */}
                <Link href="/messages" style={{ position: 'relative', textDecoration: 'none' }}>
                  <div style={{
                    height: 38, borderRadius: 8, padding: '0 10px',
                    background: isActive('/messages') ? 'rgba(74,222,128,0.1)' : '#111118',
                    border: `1px solid ${isActive('/messages') ? 'rgba(74,222,128,0.3)' : '#2d2d3f'}`,
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: 16 }}>💬</span>
                    <span className="desktop-nav" style={{ fontSize: 13, fontWeight: 700, color: isActive('/messages') ? '#4ade80' : '#d1d5db' }}>Inbox</span>
                  </div>
                  {unread > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4,
                      background: '#ef4444', color: '#fff',
                      fontSize: 10, fontWeight: 700, borderRadius: 10,
                      minWidth: 18, height: 18, padding: '0 4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 0 2px #0a0a0f',
                    }}>{unread > 9 ? '9+' : unread}</span>
                  )}
                </Link>

                {/* Avatar dropdown */}
                <div style={{ position: 'relative' }} ref={menuRef}>
                  <button onClick={() => { setMenuOpen(!menuOpen); setMobileOpen(false) }} style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: profile?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                    border: menuOpen ? '2px solid #4ade80' : '2px solid #2d2d3f',
                    cursor: 'pointer', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 900, color: '#0a0a0f',
                    fontFamily: 'var(--font-display)', padding: 0,
                    transition: 'border-color 0.15s', flexShrink: 0,
                  }}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getInitial(profile?.username || user.email)
                    }
                  </button>

                  {menuOpen && (
                    <div style={{
                      position: 'absolute', right: 0, top: 50,
                      background: '#111118', border: '1px solid #2d2d3f',
                      borderRadius: 12, padding: 8, minWidth: 210,
                      boxShadow: '0 12px 40px rgba(0,0,0,0.6)', zIndex: 100,
                    }}>
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1f2937', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            background: profile?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 900, color: '#0a0a0f',
                          }}>
                            {profile?.avatar_url
                              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : getInitial(profile?.username || user.email)
                            }
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {profile?.username || 'New User'}
                            </div>
                            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                              {profile?.trade_count || 0} trades
                              {profile?.badge && <span style={{ marginLeft: 6, color: '#4ade80' }}>· {profile.badge}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <MenuItem href={profile?.username ? `/profile/${profile.username}` : '/settings'} label="My Profile" emoji="👤" onClick={() => setMenuOpen(false)} />
                      <MenuItem href="/create" label="Post Listing" emoji="➕" onClick={() => setMenuOpen(false)} />
                      <MenuItem href="/messages" label="Messages" emoji="💬" badge={unread} onClick={() => setMenuOpen(false)} />
                      <MenuItem href="/settings" label="Settings" emoji="⚙️" onClick={() => setMenuOpen(false)} />
                      {['Owner', 'Moderator'].includes(profile?.badge) && (
                        <MenuItem href="/admin" label="Admin Panel" emoji="🛡️" onClick={() => setMenuOpen(false)} />
                      )}
                      <div style={{ borderTop: '1px solid #1f2937', marginTop: 6, paddingTop: 6 }}>
                        <button onClick={handleSignOut} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: 6, fontSize: 13, color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                          🚪 Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Desktop login/signup */}
                <div className="desktop-nav" style={{ display: 'flex', gap: 8 }}>
                  <Link href="/auth/login" style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textDecoration: 'none', padding: '8px 14px', border: '1px solid #2d2d3f', borderRadius: 8 }}>Log In</Link>
                  <Link href="/auth/signup" style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0f', textDecoration: 'none', padding: '8px 14px', background: '#4ade80', borderRadius: 8 }}>Sign Up</Link>
                </div>
                {/* Mobile: just sign up button */}
                <Link href="/auth/signup" className="mobile-only" style={{ fontSize: 12, fontWeight: 700, color: '#0a0a0f', textDecoration: 'none', padding: '7px 12px', background: '#4ade80', borderRadius: 8 }}>Sign Up</Link>
              </>
            )}

            {/* Hamburger — mobile only */}
            <button
              className="mobile-only"
              onClick={() => { setMobileOpen(!mobileOpen); setMenuOpen(false) }}
              style={{
                width: 38, height: 38, background: 'none',
                border: '1px solid #2d2d3f', borderRadius: 8,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 5, cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
              aria-label="Menu"
            >
              <span style={{ display: 'block', width: 16, height: 2, background: mobileOpen ? '#4ade80' : '#9ca3af', borderRadius: 2, transition: 'all 0.2s', transform: mobileOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
              <span style={{ display: 'block', width: 16, height: 2, background: mobileOpen ? 'transparent' : '#9ca3af', borderRadius: 2, transition: 'all 0.2s' }} />
              <span style={{ display: 'block', width: 16, height: 2, background: mobileOpen ? '#4ade80' : '#9ca3af', borderRadius: 2, transition: 'all 0.2s', transform: mobileOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div ref={mobileMenuRef} style={{
          background: '#0d0d14',
          borderTop: '1px solid #1f2937',
          padding: '12px 16px 20px',
        }}>
          {/* Nav links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href} style={{
                fontSize: 15, fontWeight: 600, textDecoration: 'none',
                padding: '11px 14px', borderRadius: 10,
                color: link.vip
                  ? '#f59e0b'
                  : isActive(link.href) ? '#4ade80' : '#d1d5db',
                background: link.vip
                  ? 'rgba(245,158,11,0.06)'
                  : isActive(link.href) ? 'rgba(74,222,128,0.08)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                {link.label}
                {isActive(link.href) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: link.vip ? '#f59e0b' : '#4ade80' }} />}
              </Link>
            ))}
          </div>

          {/* Post listing CTA */}
          <Link href="/create" style={{
            display: 'block', textAlign: 'center',
            padding: '12px 0', borderRadius: 10,
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            color: '#fff', textDecoration: 'none',
            fontSize: 14, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(22,163,74,0.3)',
            marginBottom: user ? 12 : 0,
          }}>
            + Post a Listing
          </Link>

          {/* Auth buttons for logged out users */}
          {!user && (
            <Link href="/auth/login" style={{
              display: 'block', textAlign: 'center',
              padding: '11px 0', borderRadius: 10,
              background: 'transparent', border: '1px solid #2d2d3f',
              color: '#9ca3af', textDecoration: 'none',
              fontSize: 14, fontWeight: 600, marginTop: 8,
            }}>
              Log In
            </Link>
          )}
        </div>
      )}

      {/* Responsive styles injected once */}
      <style>{`
        .desktop-nav { display: flex !important; }
        .mobile-only { display: none !important; }
        .mobile-spacer { display: none !important; }
        @media (max-width: 767px) {
          .desktop-nav { display: none !important; }
          .mobile-only { display: flex !important; }
          .mobile-spacer { display: block !important; }
        }
      `}</style>
    </nav>
  )
}

function MenuItem({ href, label, emoji, badge, onClick }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} onClick={onClick}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 8,
        fontSize: 13, color: '#d1d5db', fontWeight: 500,
        cursor: 'pointer', transition: 'background 0.1s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#1a1a2e'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: 15 }}>{emoji}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {badge > 0 && (
          <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '2px 6px' }}>{badge}</span>
        )}
      </div>
    </Link>
  )
}
