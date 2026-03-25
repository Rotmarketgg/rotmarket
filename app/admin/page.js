'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import { getSessionUser, getProfile, supabase } from '@/lib/supabase'
import { withTimeout, timeAgo, getInitial } from '@/lib/utils'
import { BADGE_HIERARCHY, BADGE_META, getPrimaryBadge } from '@/lib/constants'

const BADGE_COLORS = {
  'Verified Trader': '#4ade80',
  'VIP': '#f59e0b',
  'Moderator': '#60a5fa',
  'Owner': '#ef4444',
}

const REASON_LABELS = {
  scam: '🚨 Scam',
  fake_listing: '❌ Fake Listing',
  inappropriate: '🔞 Inappropriate',
  harassment: '😠 Harassment',
  spam: '📢 Spam',
  other: '💬 Other',
}

const STATUS_COLORS = {
  pending: '#f59e0b',
  reviewed: '#60a5fa',
  resolved: '#4ade80',
  dismissed: '#6b7280',
}

// ─── MAIN PAGE ────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [tab, setTab] = useState('reports')
  const [stats, setStats] = useState({})

  const [disputes, setDisputes] = useState([])
  const [disputesLoading, setDisputesLoading] = useState(false)

  const profileBadges = profile?.badges?.length ? profile.badges : profile?.badge ? [profile.badge] : []
  const isOwner = profileBadges.includes('Owner')
  const isMod = profileBadges.includes('Moderator')

  // Reports state
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportFilter, setReportFilter] = useState('pending')

  // Users state (Owner only)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  // Reviews state (Owner only)
  const [reviewSearch, setReviewSearch] = useState('')
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  // Listings state (Owner only)
  const [listings, setListings] = useState([])
  const [listingsLoading, setListingsLoading] = useState(false)

  // Create account modal
  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', username: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function init() {
      try {
      const u = await getSessionUser()
      if (!u) { router.push('/auth/login'); return }
      const p = await getProfile(u.id)
      const pBadges = p?.badges?.length ? p.badges : p?.badge ? [p.badge] : []
      if (!p || !['Owner', 'Moderator'].some(b => pBadges.includes(b))) {
        setUnauthorized(true); setLoading(false); return
      }
      setUser(u)
      setProfile(p)
      setLoading(false)
      loadStats()
      loadReports('pending')
      } catch (err) {
        console.error('Admin init error:', err)
        router.push('/auth/login')
      }
    }
    init()
  }, [])

  // Re-validate auth when the tab becomes visible again.
  // Without this, returning from another tab would find a stale/expired session
  // and the page would redirect to /auth/login or show "unauthorized".
  // Listens for rotmarket:tab-visible which is dispatched by lib/supabase.js
  // AFTER the token has been confirmed fresh — so getSessionUser() is reliable.
  useEffect(() => {
    const onVisible = async () => {
      const u = await getSessionUser()
      if (!u) { router.push('/auth/login'); return }
      const p = await getProfile(u.id)
      const pBadges = p?.badges?.length ? p.badges : p?.badge ? [p.badge] : []
      if (!p || !['Owner', 'Moderator'].some(b => pBadges.includes(b))) {
        setUnauthorized(true); return
      }
      setUser(u)
      setProfile(p)
    }
    window.addEventListener('rotmarket:tab-visible', onVisible)
    return () => window.removeEventListener('rotmarket:tab-visible', onVisible)
  }, [router])

  useEffect(() => {
    if (tab === 'users' && isOwner) loadUsers('')
    if (tab === 'reviews' && isOwner) loadReviews('')
    if (tab === 'listings' && isOwner) loadListings()
    if (tab === 'disputes') loadDisputes()
  }, [tab])

  // ─── LOADERS ────────────────────────────────────────────────

  async function loadStats() {
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).not('username', 'is', null),
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('trade_requests').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('banned', true),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ])
    setStats({
      totalUsers: r1.count || 0,
      activeListings: r2.count || 0,
      pendingReports: r3.count || 0,
      completedTrades: r4.count || 0,
      bannedUsers: r5.count || 0,
      openDisputes: r6.count || 0,
    })
  }

  async function loadReports(status) {
    setReportsLoading(true)
    try {
      let q = supabase
        .from('reports')
        .select(`*, reporter:profiles!reports_reporter_id_fkey(id,username,avatar_url), reported_user:profiles!reports_reported_user_id_fkey(id,username,avatar_url,badge,banned), listings(id,title)`)
        .order('created_at', { ascending: false })
        .limit(100)
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      setReports(data || [])
    } catch (err) {
      alert('Error loading reports: ' + err.message)
    } finally {
      setReportsLoading(false)
    }
  }

  async function loadUsers(search) {
    setUsersLoading(true)
    try {
      let q = supabase
        .from('profiles')
        .select('id, username, badge, badges, banned, ban_reason, trade_count, rating, review_count, created_at, avatar_url, epic_username, roblox_username')
        .not('username', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100)
      if (search) q = q.ilike('username', `%${search}%`)
      const { data, error } = await q
      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      alert('Error loading users: ' + err.message)
    } finally {
      setUsersLoading(false)
    }
  }

  async function loadReviews(search) {
    setReviewsLoading(true)
    try {
      let q = supabase
        .from('reviews')
        .select(`*, reviewer:profiles!reviews_reviewer_id_fkey(id,username), seller:profiles!reviews_seller_id_fkey(id,username), listings(id,title)`)
        .order('created_at', { ascending: false })
        .limit(100)
      const { data, error } = await q
      if (error) throw error
      let filtered = data || []
      if (search) filtered = filtered.filter(r => r.reviewer?.username?.toLowerCase().includes(search.toLowerCase()) || r.seller?.username?.toLowerCase().includes(search.toLowerCase()))
      setReviews(filtered)
    } catch (err) {
      alert('Error loading reviews: ' + err.message)
    } finally {
      setReviewsLoading(false)
    }
  }

  async function loadListings() {
    setListingsLoading(true)
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(`id, title, game, rarity, type, price, status, created_at, views, user_id, profiles(id, username)`)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setListings(data || [])
    } catch (err) {
      alert('Error loading listings: ' + err.message)
    } finally {
      setListingsLoading(false)
    }
  }

  // ─── ACTIONS ────────────────────────────────────────────────

  async function loadDisputes() {
    setDisputesLoading(true)
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          opener:profiles!disputes_opened_by_fkey(id, username, avatar_url),
          against:profiles!disputes_against_user_id_fkey(id, username, avatar_url),
          listings(id, title)
        `)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setDisputes(data || [])
    } catch (err) {
      alert('Error loading disputes: ' + err.message)
    } finally {
      setDisputesLoading(false)
    }
  }

  async function updateDispute(disputeId, status, resolution, notes) {
    try {
      const { error } = await supabase.from('disputes').update({
        status,
        resolution: resolution || null,
        admin_notes: notes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', disputeId)
      if (error) throw error
      loadDisputes()
      loadStats()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  async function updateReport(reportId, status, notes) {
    try {
      const { error } = await supabase.from('reports').update({
        status, admin_notes: notes || null,
        reviewed_by: user.id, reviewed_at: new Date().toISOString(),
      }).eq('id', reportId)
      if (error) throw error
      loadReports(reportFilter)
      loadStats()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  async function updateBadge(userId, badges) {
    try {
      const { error } = await supabase.rpc('admin_update_profile', {
        target_id: userId,
        new_badges: badges,  // text[] — e.g. ['Owner', 'VIP']
        new_banned: null,
        new_ban_reason: null,
      })
      if (error) throw error
      loadUsers(userSearch)
      loadStats()
    } catch (err) {
      alert('Failed to update badges: ' + err.message)
    }
  }

  async function deleteUser(userId, username) {
    if (userId === user?.id) { alert('You cannot delete your own account.'); return }
    if (!confirm(`Permanently delete @${username}? This will delete all their listings, reviews, messages, and trades. This cannot be undone.`)) return
    try {
      const { error } = await supabase.rpc('admin_delete_user', { target_id: userId })
      if (error) throw error
      loadUsers(userSearch)
      loadStats()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  async function toggleBan(userId, currentlyBanned, username) {
    // Prevent owner from banning themselves
    if (userId === user?.id) {
      alert('You cannot ban your own account.')
      return
    }
    if (currentlyBanned) {
      if (!confirm(`Unban @${username}?`)) return
      const { error } = await supabase.rpc('admin_update_profile', {
        target_id: userId, new_badges: null,
        new_banned: false, new_ban_reason: null,
      })
      if (error) { alert('Failed: ' + error.message); return }
    } else {
      const reason = prompt(`Reason for banning @${username}:`)
      if (!reason) return
      const { error } = await supabase.rpc('admin_update_profile', {
        target_id: userId, new_badges: null,
        new_banned: true, new_ban_reason: reason,
      })
      if (error) { alert('Failed: ' + error.message); return }
      await supabase.from('listings').update({ status: 'deleted' }).eq('user_id', userId).eq('status', 'active')
    }
    loadUsers(userSearch)
    loadStats()
  }

  async function deleteReview(reviewId) {
    if (!confirm('Delete this review? This will recalculate the seller\'s rating.')) return
    try {
      const { error } = await supabase.rpc('admin_delete_review', { review_id: reviewId })
      if (error) throw error
      loadReviews(reviewSearch)
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  async function deleteListing(listingId) {
    if (!confirm('Delete this listing?')) return
    try {
      const { error } = await supabase.rpc('admin_delete_listing', { listing_id: listingId })
      if (error) throw error
      loadListings()
      loadStats()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  async function createAccount() {
    if (!createForm.email || !createForm.password || !createForm.username) {
      alert('All fields required.'); return
    }
    setCreating(true)
    try {
      const { error } = await supabase.rpc('admin_create_user', {
        user_email: createForm.email,
        user_password: createForm.password,
        user_username: createForm.username,
      })
      if (error) throw error
      alert(`Account created for @${createForm.username}`)
      setCreateModal(false)
      setCreateForm({ email: '', password: '', username: '' })
      loadUsers(userSearch)
      loadStats()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  // ─── RENDER GUARDS ──────────────────────────────────────────

  if (loading) return <div style={{ minHeight: '100vh' }}><Navbar /><div style={{ textAlign: 'center', padding: 80, color: '#6b7280' }}>Loading...</div></div>

  if (unauthorized) return (
    <div style={{ minHeight: '100vh' }}><Navbar />
      <div style={{ textAlign: 'center', padding: '100px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <h2 style={{ color: '#f87171', marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: '#6b7280', marginBottom: 16 }}>Owner or Moderator badge required.</p>
        <Link href="/" style={{ color: '#4ade80' }}>Go home</Link>
      </div>
    </div>
  )

  const TABS = isOwner
    ? [
        { id: 'reports', label: `🚩 Reports${stats.pendingReports > 0 ? ` (${stats.pendingReports})` : ''}` },
        { id: 'disputes', label: `⚠️ Disputes${stats.openDisputes > 0 ? ` (${stats.openDisputes})` : ''}` },
        { id: 'users', label: '👥 Users' },
        { id: 'reviews', label: '⭐ Reviews' },
        { id: 'listings', label: '📋 Listings' },
      ]
    : [
        { id: 'reports', label: `🚩 Reports${stats.pendingReports > 0 ? ` (${stats.pendingReports})` : ''}` },
        { id: 'disputes', label: `⚠️ Disputes${stats.openDisputes > 0 ? ` (${stats.openDisputes})` : ''}` },
      ]

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />

      {/* Create Account Modal */}
      {createModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setCreateModal(false)}>
          <div style={{ background: '#111118', border: '1px solid #2d2d3f', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f9fafb' }}>Create Account</h3>
              <button onClick={() => setCreateModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {[
              { key: 'username', label: 'Username', type: 'text', placeholder: 'ExampleUser' },
              { key: 'email', label: 'Email', type: 'email', placeholder: 'user@email.com' },
              { key: 'password', label: 'Password', type: 'password', placeholder: 'Min. 8 characters' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={createForm[f.key]}
                  onChange={e => setCreateForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <button onClick={createAccount} disabled={creating} className="btn-primary" style={{ width: '100%', marginTop: 4 }}>
              {creating ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: '#f9fafb', fontFamily: 'var(--font-display)' }}>Admin Panel</h1>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              Signed in as{' '}
              <strong style={{ color: BADGE_COLORS[profileBadges[0]] || '#f9fafb' }}>{profile?.username}</strong>
              {' '}— <span style={{ color: BADGE_COLORS[profileBadges[0]] || '#6b7280' }}>{profileBadges[0] || profile?.badge}</span>
            </div>
          </div>
          {isOwner && (
            <button onClick={() => setCreateModal(true)} className="btn-primary" style={{ fontSize: 13, padding: '9px 18px' }}>
              ➕ Create Account
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Total Users', value: stats.totalUsers || 0, color: '#4ade80', icon: '👥' },
            { label: 'Active Listings', value: stats.activeListings || 0, color: '#60a5fa', icon: '📋' },
            { label: 'Pending Reports', value: stats.pendingReports || 0, color: '#f59e0b', icon: '🚩', alert: stats.pendingReports > 0 },
            { label: 'Completed Trades', value: stats.completedTrades || 0, color: '#a78bfa', icon: '✅' },
            { label: 'Banned Users', value: stats.bannedUsers || 0, color: '#ef4444', icon: '🚫' },
            { label: 'Open Disputes', value: stats.openDisputes || 0, color: '#f97316', icon: '⚠️', alert: stats.openDisputes > 0 },
          ].map(s => (
            <div key={s.label} style={{ background: s.alert ? 'rgba(245,158,11,0.08)' : '#111118', border: `1px solid ${s.alert ? 'rgba(245,158,11,0.3)' : '#1f2937'}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1f2937', marginBottom: 20 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 18px', fontSize: 13, fontWeight: 700,
              color: tab === t.id ? '#4ade80' : '#6b7280',
              borderBottom: tab === t.id ? '2px solid #4ade80' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ─── REPORTS TAB ─── */}
        {tab === 'reports' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['pending', 'reviewed', 'resolved', 'dismissed', 'all'].map(s => (
                <button key={s} onClick={() => { setReportFilter(s); loadReports(s) }} style={{
                  padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                  background: reportFilter === s ? 'rgba(74,222,128,0.15)' : '#111118',
                  color: reportFilter === s ? '#4ade80' : '#6b7280',
                  boxShadow: reportFilter === s ? '0 0 0 1px rgba(74,222,128,0.3)' : '0 0 0 1px #2d2d3f',
                }}>{s}</button>
              ))}
            </div>
            {reportsLoading
              ? <div style={{ color: '#6b7280', padding: 20 }}>Loading...</div>
              : reports.length === 0
              ? <EmptyState icon="✅" message={`No ${reportFilter} reports`} />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reports.map(r => <ReportCard key={r.id} report={r} onUpdate={updateReport} />)}
                </div>
            }
          </div>
        )}

        {/* ─── USERS TAB ─── */}
        {tab === 'users' && isOwner && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input type="text" placeholder="Search username..." value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadUsers(userSearch)}
                style={{ flex: 1, maxWidth: 320 }} />
              <button onClick={() => loadUsers(userSearch)} className="btn-primary" style={{ padding: '10px 16px', fontSize: 13 }}>Search</button>
            </div>
            {usersLoading
              ? <div style={{ color: '#6b7280', padding: 20 }}>Loading...</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {users.map(u => (
                    <UserRow key={u.id} user={u} onUpdateBadge={updateBadge} onToggleBan={toggleBan} onDelete={deleteUser} />
                  ))}
                </div>
            }
          </div>
        )}

        {/* ─── REVIEWS TAB ─── */}
        {tab === 'reviews' && isOwner && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input type="text" placeholder="Search by username..." value={reviewSearch}
                onChange={e => { setReviewSearch(e.target.value); loadReviews(e.target.value) }}
                style={{ flex: 1, maxWidth: 320 }} />
            </div>
            {reviewsLoading
              ? <div style={{ color: '#6b7280', padding: 20 }}>Loading...</div>
              : reviews.length === 0
              ? <EmptyState icon="⭐" message="No reviews found" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: '#6b7280' }}>From: <Link href={`/profile/${r.reviewer?.username}`} style={{ color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>{r.reviewer?.username}</Link></span>
                          <span style={{ color: '#6b7280' }}>To: <Link href={`/profile/${r.seller?.username}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>{r.seller?.username}</Link></span>
                          <span>{'⭐'.repeat(r.rating)}</span>
                          <span style={{ color: '#4b5563' }}>{timeAgo(r.created_at)}</span>
                        </div>
                        {r.comment && <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{r.comment}</p>}
                      </div>
                      <button onClick={() => deleteReview(r.id)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                        🗑 Delete
                      </button>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ─── LISTINGS TAB ─── */}
        {tab === 'listings' && isOwner && (
          <div>
            {listingsLoading
              ? <div style={{ color: '#6b7280', padding: 20 }}>Loading...</div>
              : listings.length === 0
              ? <EmptyState icon="📋" message="No listings" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {listings.map(l => (
                    <div key={l.id} style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <Link href={`/listing/${l.id}`} style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb', textDecoration: 'none' }}>{l.title}</Link>
                          <span style={{ fontSize: 10, color: '#6b7280', background: '#1f2937', borderRadius: 3, padding: '1px 6px' }}>{l.rarity}</span>
                          <span style={{ fontSize: 10, color: l.status === 'active' ? '#4ade80' : '#f87171', background: l.status === 'active' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 3, padding: '1px 6px' }}>{l.status}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                          By <Link href={`/profile/${l.profiles?.username}`} style={{ color: '#9ca3af', textDecoration: 'none' }}>{l.profiles?.username}</Link>
                          {' '}· {l.game === 'fortnite' ? 'Fortnite' : 'Roblox'}
                          {l.price && ` · $${l.price}`}
                          {' '}· {l.views} views · {timeAgo(l.created_at)}
                        </div>
                      </div>
                      <button onClick={() => deleteListing(l.id)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                        🗑 Delete
                      </button>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ─── DISPUTES TAB ─── */}
        {tab === 'disputes' && (
          <div>
            {disputesLoading
              ? <div style={{ color: '#6b7280', padding: 20 }}>Loading disputes...</div>
              : disputes.length === 0
              ? <EmptyState icon="⚖️" message="No disputes filed yet" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {disputes.map(d => <DisputeCard key={d.id} dispute={d} onUpdate={updateDispute} />)}
                </div>
            }
          </div>
        )}

      </div>
    </div>
  )
}

// ─── REPORT CARD ──────────────────────────────────────────────────

function ReportCard({ report, onUpdate }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(report.admin_notes || '')
  const [chatLogs, setChatLogs] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [userActivity, setUserActivity] = useState(null)

  const loadChatLogs = async () => {
    if (chatLogs) { setChatOpen(o => !o); return }
    setChatLoading(true)
    try {
      // Fetch all messages between the two users (any listing)
      const { data } = await supabase
        .from('messages')
        .select(`*, sender:profiles!messages_sender_id_fkey(id, username)`)
        .or(
          `and(sender_id.eq.${report.reporter_id},receiver_id.eq.${report.reported_user_id}),` +
          `and(sender_id.eq.${report.reported_user_id},receiver_id.eq.${report.reporter_id})`
        )
        .order('created_at', { ascending: true })
        .limit(200)

      // Also fetch reported user's trade history and reviews
      const [{ data: trades }, { data: reviews }] = await Promise.all([
        supabase.from('trade_requests').select('id, status, created_at, listing_id')
          .eq('seller_id', report.reported_user_id).order('created_at', { ascending: false }).limit(20),
        supabase.from('reviews').select('rating, comment, created_at')
          .eq('seller_id', report.reported_user_id).order('created_at', { ascending: false }).limit(10),
      ])

      setChatLogs(data || [])
      setUserActivity({ trades: trades || [], reviews: reviews || [] })
      setChatOpen(true)
    } catch (err) {
      alert('Failed to load chat logs: ' + err.message)
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div style={{ background: '#111118', border: `1px solid ${report.status === 'pending' ? 'rgba(245,158,11,0.25)' : '#1f2937'}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: STATUS_COLORS[report.status] || '#6b7280', background: `${STATUS_COLORS[report.status] || '#6b7280'}18`, border: `1px solid ${STATUS_COLORS[report.status] || '#6b7280'}40`, borderRadius: 4, padding: '2px 7px' }}>
              {report.status}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{REASON_LABELS[report.reason] || report.reason}</span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>{timeAgo(report.created_at)}</span>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
            <span><span style={{ color: '#6b7280' }}>Reporter: </span><Link href={`/profile/${report.reporter?.username}`} style={{ color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>{report.reporter?.username || 'Unknown'}</Link></span>
            <span>
              <span style={{ color: '#6b7280' }}>Reported: </span>
              <Link href={`/profile/${report.reported_user?.username}`} style={{ color: '#f87171', textDecoration: 'none', fontWeight: 600 }}>{report.reported_user?.username || 'Unknown'}</Link>
              {report.reported_user?.banned && <span style={{ marginLeft: 6, fontSize: 9, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>BANNED</span>}
            </span>
            {report.listings && <span><span style={{ color: '#6b7280' }}>Listing: </span><Link href={`/listing/${report.listing_id}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>{report.listings.title}</Link></span>}
          </div>

          {report.details && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9ca3af', lineHeight: 1.6, background: '#0d0d14', padding: '8px 12px', borderRadius: 6, border: '1px solid #1f2937' }}>{report.details}</p>}
          {report.admin_notes && !notesOpen && <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Notes: {report.admin_notes}</p>}
          {notesOpen && <textarea rows={2} placeholder="Admin notes..." value={notes} onChange={e => setNotes(e.target.value)} style={{ marginTop: 8, resize: 'vertical', fontSize: 12 }} />}

          {/* Chat log + activity viewer */}
          {chatOpen && chatLogs !== null && (
            <ChatAndActivity chatLogs={chatLogs} userActivity={userActivity} username={report.reported_user?.username} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button onClick={loadChatLogs} disabled={chatLoading} style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)', background: chatOpen ? 'rgba(96,165,250,0.15)' : 'transparent', color: '#60a5fa', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {chatLoading ? '...' : chatOpen ? '💬 Hide Logs' : '💬 View Logs'}
          </button>
          <button onClick={() => setNotesOpen(!notesOpen)} style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid #2d2d3f', background: 'transparent', color: '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            📝 {notesOpen ? 'Hide' : 'Notes'}
          </button>
          {report.status !== 'resolved' && <button onClick={() => onUpdate(report.id, 'resolved', notes)} style={{ padding: '5px 9px', borderRadius: 6, border: 'none', background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Resolve</button>}
          {report.status !== 'dismissed' && <button onClick={() => onUpdate(report.id, 'dismissed', notes)} style={{ padding: '5px 9px', borderRadius: 6, border: 'none', background: '#1f2937', color: '#6b7280', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕ Dismiss</button>}
          {report.status === 'pending' && <button onClick={() => onUpdate(report.id, 'reviewed', notes)} style={{ padding: '5px 9px', borderRadius: 6, border: 'none', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>👁 Reviewing</button>}
        </div>
      </div>
    </div>
  )
}

// ─── USER ROW ─────────────────────────────────────────────────────

const ALL_BADGES = BADGE_HIERARCHY

function UserRow({ user, onUpdateBadge, onToggleBan, onDelete }) {
  // Support both legacy badge and new badges array
  const initialBadges = user.badges?.length ? user.badges
    : user.badge ? [user.badge]
    : []
  const [selectedBadges, setSelectedBadges] = useState(initialBadges)
  const [saving, setSaving] = useState(false)
  const [showBadges, setShowBadges] = useState(false)

  const toggleBadge = (badge) => {
    setSelectedBadges(prev =>
      prev.includes(badge) ? prev.filter(b => b !== badge) : [...prev, badge]
    )
  }

  async function handleSaveBadges() {
    setSaving(true)
    await onUpdateBadge(user.id, selectedBadges)
    setSaving(false)
    setShowBadges(false)
  }

  const primaryBadge = getPrimaryBadge(selectedBadges)

  return (
    <div style={{ background: '#111118', border: user.banned ? '1px solid rgba(239,68,68,0.25)' : '1px solid #1f2937', borderRadius: 10, padding: '12px 16px', opacity: user.banned ? 0.8 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: user.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#0a0a0f', position: 'relative' }}>
          {user.avatar_url ? <Image src={user.avatar_url} alt="" fill sizes="32px" style={{ objectFit: 'cover' }} /> : getInitial(user.username)}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <Link href={`/profile/${user.username}`} style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb', textDecoration: 'none' }}>{user.username}</Link>
            {/* Show all current badges */}
            {initialBadges.filter(b => ALL_BADGES.includes(b)).map(b => (
              <span key={b} style={{ fontSize: 9, fontWeight: 800, color: BADGE_COLORS[b] || '#9ca3af', background: `${BADGE_COLORS[b] || '#9ca3af'}18`, border: `1px solid ${BADGE_COLORS[b] || '#9ca3af'}40`, borderRadius: 3, padding: '1px 5px' }}>
                {b}
              </span>
            ))}
            {user.banned && <span style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 3, padding: '1px 5px' }}>BANNED</span>}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            {user.trade_count || 0} trades · ⭐{user.rating || 0} · {user.review_count || 0} reviews
            {user.ban_reason && <span style={{ marginLeft: 8, color: '#f87171' }}>Ban: {user.ban_reason}</span>}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => setShowBadges(s => !s)} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${showBadges ? 'rgba(74,222,128,0.4)' : '#2d2d3f'}`, background: showBadges ? 'rgba(74,222,128,0.1)' : 'transparent', color: showBadges ? '#4ade80' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            🏷 Badges
          </button>
          <button onClick={() => onToggleBan(user.id, user.banned, user.username)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: user.banned ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', color: user.banned ? '#4ade80' : '#f87171', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {user.banned ? '✓ Unban' : '🚫 Ban'}
          </button>
        </div>
      </div>

      {/* Badge editor — expandable */}
      {showBadges && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1f2937' }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Assign Badges</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {ALL_BADGES.map(badge => {
              const selected = selectedBadges.includes(badge)
              return (
                <button key={badge} onClick={() => toggleBadge(badge)} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  background: selected ? `${BADGE_COLORS[badge]}22` : '#1f2937',
                  color: selected ? BADGE_COLORS[badge] : '#6b7280',
                  outline: selected ? `1px solid ${BADGE_COLORS[badge]}66` : 'none',
                }}>
                  {badge === 'Owner' ? '👑' : badge === 'Moderator' ? '🛡️' : badge === 'VIP' ? '⭐' : '✓'} {badge}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleSaveBadges} disabled={saving} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: saving ? '#1f2937' : '#16a34a', color: saving ? '#6b7280' : '#fff', fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Badges'}
            </button>
            <button onClick={() => { setSelectedBadges([]); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2d2d3f', background: 'transparent', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
              Clear All
            </button>
            {selectedBadges.length > 0 && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                Primary: <strong style={{ color: BADGE_COLORS[getPrimaryBadge(selectedBadges)] }}>{getPrimaryBadge(selectedBadges)}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div>{message}</div>
    </div>
  )
}

const DISPUTE_REASON_LABELS = {
  item_not_received: "📦 Didn't receive item",
  item_not_as_described: '❌ Not as described',
  payment_not_received: "💸 Didn't receive payment",
  fraud: '🚨 Fraud / Scam',
  other: '💬 Other',
}

const DISPUTE_STATUS_COLORS = {
  open: '#f97316',
  under_review: '#60a5fa',
  resolved: '#4ade80',
  dismissed: '#6b7280',
}

function DisputeCard({ dispute, onUpdate }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(dispute.admin_notes || '')
  const [resolution, setResolution] = useState(dispute.resolution || '')
  const [chatLogs, setChatLogs] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [userActivity, setUserActivity] = useState(null)
  const statusColor = DISPUTE_STATUS_COLORS[dispute.status] || '#6b7280'

  const loadChatLogs = async () => {
    if (chatLogs) { setChatOpen(o => !o); return }
    setChatLoading(true)
    try {
      const [{ data: msgs }, { data: trades }, { data: reviews }] = await Promise.all([
        supabase.from('messages')
          .select(`*, sender:profiles!messages_sender_id_fkey(id, username)`)
          .or(
            `and(sender_id.eq.${dispute.opened_by},receiver_id.eq.${dispute.against_user_id}),` +
            `and(sender_id.eq.${dispute.against_user_id},receiver_id.eq.${dispute.opened_by})`
          )
          .order('created_at', { ascending: true }).limit(200),
        supabase.from('trade_requests').select('id, status, created_at, listing_id')
          .or(`seller_id.eq.${dispute.against_user_id},buyer_id.eq.${dispute.against_user_id}`)
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('reviews').select('rating, comment, created_at')
          .eq('seller_id', dispute.against_user_id)
          .order('created_at', { ascending: false }).limit(10),
      ])
      setChatLogs(msgs || [])
      setUserActivity({ trades: trades || [], reviews: reviews || [] })
      setChatOpen(true)
    } catch (err) { alert('Failed to load logs: ' + err.message) }
    finally { setChatLoading(false) }
  }

  return (
    <div style={{
      background: '#111118',
      border: `1px solid ${dispute.status === 'open' ? 'rgba(249,115,22,0.3)' : '#1f2937'}`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40`, borderRadius: 4, padding: '2px 7px' }}>
              {dispute.status.replace('_', ' ')}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>{DISPUTE_REASON_LABELS[dispute.reason] || dispute.reason}</span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>{timeAgo(dispute.created_at)}</span>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
            <span><span style={{ color: '#6b7280' }}>Opened by: </span><Link href={`/profile/${dispute.opener?.username}`} style={{ color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>{dispute.opener?.username || 'Unknown'}</Link></span>
            <span><span style={{ color: '#6b7280' }}>Against: </span><Link href={`/profile/${dispute.against?.username}`} style={{ color: '#f87171', textDecoration: 'none', fontWeight: 600 }}>{dispute.against?.username || 'Unknown'}</Link></span>
            {dispute.listings && <span><span style={{ color: '#6b7280' }}>Listing: </span><Link href={`/listing/${dispute.listing_id}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>{dispute.listings.title}</Link></span>}
          </div>

          {dispute.details && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9ca3af', lineHeight: 1.6, background: '#0d0d14', padding: '8px 12px', borderRadius: 6, border: '1px solid #1f2937' }}>{dispute.details}</p>}

          {notesOpen && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea rows={2} placeholder="Admin notes (internal)..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical', fontSize: 12 }} />
              <input type="text" placeholder="Resolution summary (shown to users)..." value={resolution} onChange={e => setResolution(e.target.value)} style={{ fontSize: 12 }} />
            </div>
          )}
          {dispute.resolution && !notesOpen && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#4ade80', fontStyle: 'italic' }}>Resolution: {dispute.resolution}</p>}

          {chatOpen && chatLogs !== null && (
            <ChatAndActivity chatLogs={chatLogs} userActivity={userActivity} username={dispute.against?.username} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button onClick={loadChatLogs} disabled={chatLoading} style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)', background: chatOpen ? 'rgba(96,165,250,0.15)' : 'transparent', color: '#60a5fa', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {chatLoading ? '...' : chatOpen ? '💬 Hide Logs' : '💬 View Logs'}
          </button>
          <button onClick={() => setNotesOpen(!notesOpen)} style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid #2d2d3f', background: 'transparent', color: '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            📝 {notesOpen ? 'Hide' : 'Notes'}
          </button>
          {dispute.status === 'open' && <button onClick={() => onUpdate(dispute.id, 'under_review', resolution, notes)} style={{ padding: '5px 9px', borderRadius: 6, border: 'none', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>👁 Reviewing</button>}
          {dispute.status !== 'resolved' && <button onClick={() => onUpdate(dispute.id, 'resolved', resolution, notes)} style={{ padding: '5px 9px', borderRadius: 6, border: 'none', background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Resolve</button>}
          {dispute.status !== 'dismissed' && <button onClick={() => onUpdate(dispute.id, 'dismissed', resolution, notes)} style={{ padding: '5px 9px', borderRadius: 6, border: 'none', background: '#1f2937', color: '#6b7280', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕ Dismiss</button>}
        </div>
      </div>
    </div>
  )
}

// ─── SHARED CHAT LOG + ACTIVITY VIEWER ──────────────────────────

function ChatAndActivity({ chatLogs, userActivity, username }) {
  const [viewTab, setViewTab] = useState('chat')

  return (
    <div style={{ marginTop: 12, background: '#0d0d14', border: '1px solid #2d2d3f', borderRadius: 10, overflow: 'hidden' }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1f2937' }}>
        {[
          { id: 'chat', label: `💬 Chat Log (${chatLogs.length} msgs)` },
          { id: 'trades', label: `🔄 Trade History (${userActivity?.trades?.length || 0})` },
          { id: 'reviews', label: `⭐ Reviews (${userActivity?.reviews?.length || 0})` },
        ].map(t => (
          <button key={t.id} onClick={() => setViewTab(t.id)} style={{
            padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700,
            color: viewTab === t.id ? '#60a5fa' : '#6b7280',
            borderBottom: viewTab === t.id ? '2px solid #60a5fa' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxHeight: 300, overflowY: 'auto', padding: 12 }}>
        {viewTab === 'chat' && (
          chatLogs.length === 0
            ? <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No messages found between these users</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {chatLogs.map((m, i) => (
                  <div key={m.id || i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap', marginTop: 2, minWidth: 70 }}>
                      {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: m.sender?.username === username ? '#f87171' : '#4ade80', minWidth: 80, whiteSpace: 'nowrap' }}>
                      {m.sender?.username || '?'}:
                    </span>
                    <span style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5, wordBreak: 'break-word' }}>{m.content}</span>
                  </div>
                ))}
              </div>
        )}

        {viewTab === 'trades' && (
          userActivity?.trades?.length === 0
            ? <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No trade history</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {userActivity.trades.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: '#4b5563', whiteSpace: 'nowrap', minWidth: 70 }}>
                      {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{
                      padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: t.status === 'completed' ? 'rgba(74,222,128,0.1)' : t.status === 'pending' ? 'rgba(245,158,11,0.1)' : '#1f2937',
                      color: t.status === 'completed' ? '#4ade80' : t.status === 'pending' ? '#f59e0b' : '#6b7280',
                    }}>{t.status}</span>
                    <Link href={`/listing/${t.listing_id}`} style={{ color: '#60a5fa', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      View listing →
                    </Link>
                  </div>
                ))}
              </div>
        )}

        {viewTab === 'reviews' && (
          userActivity?.reviews?.length === 0
            ? <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No reviews received</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {userActivity.reviews.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, background: '#111118', border: '1px solid #1f2937', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: r.comment ? 4 : 0 }}>
                      <span>{'⭐'.repeat(r.rating)}</span>
                      <span style={{ color: '#4b5563', fontSize: 10 }}>
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    {r.comment && <div style={{ color: '#9ca3af', lineHeight: 1.5 }}>{r.comment}</div>}
                  </div>
                ))}
              </div>
        )}
      </div>
    </div>
  )
}
