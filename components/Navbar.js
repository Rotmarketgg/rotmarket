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
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [unread, setUnread] = useState(0)
  const [pendingOffers, setPendingOffers] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        getProfile(session.user.id).then(setProfile)
        getUnreadCount(session.user.id).then(setUnread)
        fetchPendingOffers(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setUnread(0)
        setPendingOffers(0)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Real-time unread messages
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => getUnreadCount(user.id).then(setUnread))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => getUnreadCount(user.id).then(setUnread))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  // Real-time pending offer notifications
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`offers-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'trade_requests',
        filter: `seller_id=eq.${user.id}`,
      }, () => fetchPendingOffers(user.id))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'trade_requests',
        filter: `seller_id=eq.${user.id}`,
      }, () => fetchPendingOffers(user.id))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isActive = (href) => pathname === href

  const NAV_LINKS = [
    { href: '/', label: 'Browse' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/vip', label: '⭐ VIP' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/contact', label: 'Contact' },
  ]

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(10,10,15,0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid #1f2937',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 60 }}>

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 0, textDecoration: 'none', marginRight: 28, flexShrink: 0 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#4ade80', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>ROT</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>MARKET</span>
          </Link>

          {/* Nav links */}
          <div style={{ display: 'flex', gap: 2, flex: 1, alignItems: 'center' }}>
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href} style={{
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                padding: '6px 12px', borderRadius: 8,
                color: link.href === '/vip'
                  ? (isActive('/vip') ? '#f59e0b' : '#d97706')
                  : isActive(link.href) ? '#4ade80' : '#9ca3af',
                background: link.href === '/vip'
                  ? (isActive('/vip') ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.06)')
                  : isActive(link.href) ? 'rgba(74,222,128,0.08)' : 'transparent',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => {
                  if (link.href === '/vip') { e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.background = 'rgba(245,158,11,0.12)' }
                  else if (!isActive(link.href)) { e.currentTarget.style.color = '#f9fafb'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }
                }}
                onMouseLeave={e => {
                  if (link.href === '/vip') { e.currentTarget.style.color = isActive('/vip') ? '#f59e0b' : '#d97706'; e.currentTarget.style.background = isActive('/vip') ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.06)' }
                  else if (!isActive(link.href)) { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent' }
                }}
              >
                {link.label}
              </Link>
            ))}

            <Link href="/create" style={{
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
              padding: '6px 14px', borderRadius: 8, marginLeft: 8,
              color: '#0a0a0f', background: '#4ade80',
              transition: 'all 0.15s', flexShrink: 0,
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#22c55e'}
              onMouseLeave={e => e.currentTarget.style.background = '#4ade80'}
            >
              + List Item
            </Link>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {user ? (
              <>
                {/* Pending offers pill — only shown when seller has offers waiting */}
                {pendingOffers > 0 && (
                  <Link href={profile?.username ? `/profile/${profile.username}` : '/'} style={{ position: 'relative', textDecoration: 'none' }}>
                    <div style={{
                      height: 42, borderRadius: 10, padding: '0 14px',
                      background: 'rgba(245,158,11,0.12)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      display: 'flex', alignItems: 'center', gap: 7,
                      cursor: 'pointer', transition: 'all 0.15s',
                      animation: 'pulse-offer 2s infinite',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.12)'}
                    >
                      <span style={{ fontSize: 15 }}>📨</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>
                        {pendingOffers} Offer{pendingOffers !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </Link>
                )}

                {/* Inbox button */}
                <Link href="/messages" style={{ position: 'relative', textDecoration: 'none' }}>
                  <div style={{
                    height: 42, borderRadius: 10, paddingLeft: 14, paddingRight: unread > 0 ? 20 : 14,
                    background: isActive('/messages') ? 'rgba(74,222,128,0.1)' : '#111118',
                    border: `1px solid ${isActive('/messages') ? 'rgba(74,222,128,0.3)' : '#2d2d3f'}`,
                    display: 'flex', alignItems: 'center', gap: 6,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#4ade80'; e.currentTarget.style.color = '#4ade80' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isActive('/messages') ? 'rgba(74,222,128,0.3)' : '#2d2d3f'; e.currentTarget.style.color = '' }}
                  >
                    <span style={{ fontSize: 16 }}>💬</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isActive('/messages') ? '#4ade80' : '#d1d5db' }}>Inbox</span>
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
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: profile?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                      border: menuOpen ? '2px solid #4ade80' : '2px solid #2d2d3f',
                      cursor: 'pointer', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, fontWeight: 900, color: '#0a0a0f',
                      fontFamily: 'var(--font-display)', padding: 0,
                      transition: 'border-color 0.15s',
                      flexShrink: 0,
                    }}
                  >
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getInitial(profile?.username || user.email)
                    }
                  </button>

                  {menuOpen && (
                    <div style={{
                      position: 'absolute', right: 0, top: 46,
                      background: '#111118', border: '1px solid #2d2d3f',
                      borderRadius: 12, padding: 8, minWidth: 210,
                      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                      zIndex: 100,
                    }}>
                      {/* User info header */}
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
                        <button
                          onClick={handleSignOut}
                          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: 6, fontSize: 13, color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          🚪 Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href="/auth/login" style={{
                  fontSize: 13, fontWeight: 600, color: '#9ca3af',
                  textDecoration: 'none', padding: '8px 14px',
                  border: '1px solid #2d2d3f', borderRadius: 8,
                }}>Log In</Link>
                <Link href="/auth/signup" style={{
                  fontSize: 13, fontWeight: 700, color: '#0a0a0f',
                  textDecoration: 'none', padding: '8px 14px',
                  background: '#4ade80', borderRadius: 8,
                }}>Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </div>
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
