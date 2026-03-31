'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getSessionUser, getProfile, supabase } from '@/lib/supabase'
import { withTimeout, timeAgo, getInitial } from '@/lib/utils'
import { BADGE_HIERARCHY, BADGE_META, getPrimaryBadge } from '@/lib/constants'
import ConfirmModal from '@/components/ConfirmModal'
// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const BADGE_COLORS = {
  'Verified Trader': '#4ade80',
  'VIP': '#f59e0b',
  'Moderator': '#60a5fa',
  'Owner': '#ef4444',
}

const BADGE_ICONS = {
  'Verified Trader': '✓',
  'VIP': '⭐',
  'Moderator': '🛡️',
  'Owner': '👑',
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

const DISPUTE_REASON_LABELS = {
  item_not_received: '📦 Item Not Received',
  item_not_as_described: '❌ Not As Described',
  payment_not_received: '💸 Payment Not Received',
  fraud: '🚨 Fraud / Scam',
  other: '💬 Other',
}

const DISPUTE_STATUS_COLORS = {
  open: '#f97316',
  under_review: '#60a5fa',
  resolved: '#4ade80',
  dismissed: '#6b7280',
}

const VIP_DURATIONS = [
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
  { label: '1 Year', days: 365 },
  { label: 'Lifetime', days: null },
]

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#f9fafb',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '28px 16px',
  },
  card: {
    background: '#111118',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: '16px 18px',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#4b5563',
    marginBottom: 12,
  },
  badge: (color) => ({
    fontSize: 9,
    fontWeight: 800,
    color,
    background: `${color}18`,
    border: `1px solid ${color}40`,
    borderRadius: 4,
    padding: '2px 7px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
  }),
  pill: (color, active) => ({
    padding: '5px 14px',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'capitalize',
    background: active ? `${color}18` : '#111118',
    color: active ? color : '#6b7280',
    boxShadow: active ? `0 0 0 1px ${color}40` : '0 0 0 1px #2d2d3f',
    transition: 'all 0.15s',
  }),
  actionBtn: (color) => ({
    padding: '5px 10px',
    borderRadius: 6,
    border: 'none',
    background: `${color}18`,
    color,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  }),
  input: {
    background: '#0d0d14',
    border: '1px solid #2d2d3f',
    borderRadius: 8,
    padding: '9px 12px',
    color: '#f9fafb',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    background: '#0d0d14',
    border: '1px solid #2d2d3f',
    borderRadius: 8,
    padding: '9px 12px',
    color: '#f9fafb',
    fontSize: 13,
    outline: 'none',
    cursor: 'pointer',
  },
  inspectRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 8px',
    background: '#0a0a0f',
    borderRadius: 5,
    flexWrap: 'wrap',
  },
  emptyNote: {
    fontSize: 11,
    color: '#4b5563',
    padding: '6px 8px',
    fontStyle: 'italic',
  },
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function addDays(days) {
  if (!days) return null
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState({})
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)

  const [disputes, setDisputes] = useState([])
  const [disputesLoading, setDisputesLoading] = useState(false)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportFilter, setReportFilter] = useState('pending')
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [showEmails, setShowEmails] = useState(false)
  const [userEmails, setUserEmails] = useState({}) // { userId: email }
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewSearch, setReviewSearch] = useState('')
  const [listings, setListings] = useState([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [promotions, setPromotions] = useState([])
  const [promotionsLoading, setPromotionsLoading] = useState(false)
  const [promoFilter, setPromoFilter] = useState('all')
  const [trades, setTrades] = useState([])
  const [tradesLoading, setTradesLoading] = useState(false)
  const [tradeSearch, setTradeSearch] = useState('')
  const [tradeStatusFilter, setTradeStatusFilter] = useState('all')

  const [viewUser, setViewUser] = useState(null)
  const [inspectData, setInspectData] = useState(null)
  const [inspectLoading, setInspectLoading] = useState(false)

  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', username: '' })
  const [creating, setCreating] = useState(false)
  const [promoteModal, setPromoteModal] = useState(null)
  const [promoteForm, setPromoteForm] = useState({ role: 'VIP', duration: 30, note: '' })
  const [promoting, setPromoting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { userId, username }

  const profileBadges = profile?.badges?.length ? profile.badges : profile?.badge ? [profile.badge] : []
  const isOwner = profileBadges.includes('Owner')

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ─── AUTH ────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const u = await getSessionUser()
        if (!u) { router.push('/auth/login'); return }
        const p = await getProfile(u.id)
        const pBadges = p?.badges?.length ? p.badges : p?.badge ? [p.badge] : []
        // Admin panel = Owner ONLY. Mods get the /mod panel instead.
        if (!p || !pBadges.includes('Owner')) {
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

  useEffect(() => {
    const onVisible = async () => {
      const u = await getSessionUser()
      if (!u) { router.push('/auth/login'); return }
      const p = await getProfile(u.id)
      const pBadges = p?.badges?.length ? p.badges : p?.badge ? [p.badge] : []
      if (!p || !pBadges.includes('Owner')) {
        setUnauthorized(true); return
      }
      setUser(u)
      setProfile(p)
    }
    window.addEventListener('rotmarket:tab-visible', onVisible)
    return () => window.removeEventListener('rotmarket:tab-visible', onVisible)
  }, [router])

  useEffect(() => {
    if (tab === 'users') loadUsers('')
    if (tab === 'reviews') loadReviews('')
    if (tab === 'listings') loadListings()
    if (tab === 'disputes') loadDisputes()
    if (tab === 'promotions') loadPromotions()
    if (tab === 'trades') loadTrades()
  }, [tab])

  // ─── LOADERS ─────────────────────────────────────────────────────

  async function loadStats() {
    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).not('username', 'is', null),
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('trade_requests').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('banned', true),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.rpc('admin_count_promotions'),
    ])
    setStats({
      totalUsers: r1.count || 0,
      activeListings: r2.count || 0,
      pendingReports: r3.count || 0,
      completedTrades: r4.count || 0,
      bannedUsers: r5.count || 0,
      openDisputes: r6.count || 0,
      activePromotions: r7.data || 0,
    })
  }

  async function loadReports(status) {
    setReportsLoading(true)
    try {
      let q = supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (status !== 'all') q = q.eq('status', status)
      const { data: rawReports, error } = await q
      if (error) throw error
      if (!rawReports?.length) { setReports([]); return }

      // Collect unique user IDs and listing IDs, then batch fetch
      const userIds = [...new Set([
        ...rawReports.map(r => r.reporter_id).filter(Boolean),
        ...rawReports.map(r => r.reported_user_id).filter(Boolean),
      ])]
      const listingIds = [...new Set(rawReports.map(r => r.listing_id).filter(Boolean))]

      const [{ data: profileRows }, { data: listingRows }] = await Promise.all([
        userIds.length
          ? supabase.from('profiles').select('id,username,avatar_url,badge,badges,banned').in('id', userIds)
          : { data: [] },
        listingIds.length
          ? supabase.from('listings').select('id,title').in('id', listingIds)
          : { data: [] },
      ])

      const profileMap = Object.fromEntries((profileRows || []).map(p => [p.id, p]))
      const listingMap = Object.fromEntries((listingRows || []).map(l => [l.id, l]))

      const enriched = rawReports.map(r => ({
        ...r,
        reporter: profileMap[r.reporter_id] ?? null,
        reported_user: profileMap[r.reported_user_id] ?? null,
        listings: listingMap[r.listing_id] ?? null,
      }))

      setReports(enriched)
    } catch (err) {
      showToast('Error loading reports: ' + err.message, 'error')
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
      // Clear cached emails when user list refreshes
      if (!showEmails) setUserEmails({})
    } catch (err) {
      showToast('Error loading users: ' + err.message, 'error')
    } finally {
      setUsersLoading(false)
    }
  }

  // Loads email addresses via SECURITY DEFINER RPC (Owner only)
  async function loadEmails(search) {
    setEmailsLoading(true)
    try {
      const { data, error } = await supabase.rpc('admin_get_users_with_email', {
        search_term: search || null
      })
      if (error) throw error
      const map = {}
      for (const row of data || []) {
        map[row.id] = { email: row.email, lastSignIn: row.last_sign_in_at, confirmed: row.confirmed_at }
      }
      setUserEmails(map)
      setShowEmails(true)
    } catch (err) {
      showToast('Failed to load emails: ' + err.message + ' — Run SQL migration #4 in SUPABASE_SQL.md', 'error')
    } finally {
      setEmailsLoading(false)
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
      if (search) filtered = filtered.filter(r =>
        r.reviewer?.username?.toLowerCase().includes(search.toLowerCase()) ||
        r.seller?.username?.toLowerCase().includes(search.toLowerCase())
      )
      setReviews(filtered)
    } catch (err) {
      showToast('Error loading reviews: ' + err.message, 'error')
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
      showToast('Error loading listings: ' + err.message, 'error')
    } finally {
      setListingsLoading(false)
    }
  }

  async function loadDisputes() {
    setDisputesLoading(true)
    try {
      const { data, error } = await supabase
        .from('disputes')
        .select(`*, opener:profiles!disputes_opened_by_fkey(id, username, avatar_url), against:profiles!disputes_against_user_id_fkey(id, username, avatar_url), listings(id, title)`)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setDisputes(data || [])
    } catch (err) {
      showToast('Error loading disputes: ' + err.message, 'error')
    } finally {
      setDisputesLoading(false)
    }
  }

  // All user_promotions reads go through a SECURITY DEFINER RPC so RLS never blocks them.
  async function loadPromotions() {
    setPromotionsLoading(true)
    try {
      const { data, error } = await supabase.rpc('admin_list_promotions')
      if (error) throw error
      setPromotions(data || [])
    } catch (err) {
      showToast('Error loading promotions: ' + err.message, 'error')
    } finally {
      setPromotionsLoading(false)
    }
  }

  async function loadTrades(search = '') {
    setTradesLoading(true)
    try {
      let q = supabase
        .from('trade_requests')
        .select(`
          *,
          buyer:profiles!trade_requests_buyer_id_fkey(id, username, avatar_url, badge, badges, banned),
          seller:profiles!trade_requests_seller_id_fkey(id, username, avatar_url, badge, badges, banned),
          listing:listings(id, title, type, price, game, rarity)
        `)
        .order('created_at', { ascending: false })
        .limit(200)
      if (search) {
        // Can't ilike on a joined column directly — filter client-side after fetch
      }
      const { data, error } = await q
      if (error) throw error
      setTrades(data || [])
    } catch (err) {
      showToast('Error loading trades: ' + err.message, 'error')
    } finally {
      setTradesLoading(false)
    }
  }

  // ─── ACTIONS ─────────────────────────────────────────────────────

  async function openInspect(user) {
    setViewUser(user)
    setInspectData(null)
    setInspectLoading(true)
    try {
      const [
        { data: userListings },
        { data: userReports },
        { data: reportsMade },
        { data: userTrades },
        { data: userReviews },
        { data: messages },
        { count: msgCount },
      ] = await Promise.all([
        supabase.from('listings').select('id, title, game, type, status, price, created_at, views').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('reports').select('id, reason, created_at, status, reporter_id').eq('reported_user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('reports').select('id, reason, created_at, reported_user_id').eq('reporter_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('trade_requests').select('id, status, created_at, offer_price, listing_id').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(10),
        supabase.from('reviews').select('id, rating, comment, created_at, reviewer_id').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('messages').select('id, created_at').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(1),
        supabase.from('messages').select('id', { count: 'exact', head: true }).or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
      ])

      // Batch resolve usernames for reports and reviews
      const resolveIds = [...new Set([
        ...(userReports || []).map(r => r.reporter_id),
        ...(reportsMade || []).map(r => r.reported_user_id),
        ...(userReviews || []).map(r => r.reviewer_id),
      ].filter(Boolean))]

      const resolveListingIds = [...new Set((userTrades || []).map(r => r.listing_id).filter(Boolean))]

      const [{ data: resolvedProfiles }, { data: resolvedListings }] = await Promise.all([
        resolveIds.length ? supabase.from('profiles').select('id, username').in('id', resolveIds) : { data: [] },
        resolveListingIds.length ? supabase.from('listings').select('id, title').in('id', resolveListingIds) : { data: [] },
      ])

      const pMap = Object.fromEntries((resolvedProfiles || []).map(p => [p.id, p]))
      const lMap = Object.fromEntries((resolvedListings || []).map(l => [l.id, l]))

      setInspectData({
        listings: userListings || [],
        reports: (userReports || []).map(r => ({ ...r, reporter: pMap[r.reporter_id] ?? null })),
        reportsMade: (reportsMade || []).map(r => ({ ...r, reported: pMap[r.reported_user_id] ?? null })),
        trades: (userTrades || []).map(t => ({ ...t, listing: lMap[t.listing_id] ?? null })),
        reviews: (userReviews || []).map(r => ({ ...r, reviewer: pMap[r.reviewer_id] ?? null })),
        lastActive: messages?.[0]?.created_at ?? null,
        messageCount: msgCount || 0,
      })
    } catch (err) {
      showToast('Failed to load inspect data: ' + err.message, 'error')
    } finally {
      setInspectLoading(false)
    }
  }

  async function updateDispute(disputeId, status, resolution, notes) {
    try {
      const { error } = await supabase.from('disputes').update({
        status, resolution: resolution || null, admin_notes: notes || null,
        reviewed_by: user.id, reviewed_at: new Date().toISOString(),
      }).eq('id', disputeId)
      if (error) throw error
      loadDisputes(); loadStats()
      showToast('Dispute updated')
    } catch (err) {
      showToast('Failed: ' + err.message, 'error')
    }
  }

  async function updateReport(reportId, status, notes) {
    try {
      const { error } = await supabase.from('reports').update({
        status, admin_notes: notes || null,
        reviewed_by: user.id, reviewed_at: new Date().toISOString(),
      }).eq('id', reportId)
      if (error) throw error
      loadReports(reportFilter); loadStats()
      showToast('Report updated')
    } catch (err) {
      showToast('Failed: ' + err.message, 'error')
    }
  }

  async function updateBadge(userId, badges) {
    try {
      const { error } = await supabase.rpc('admin_update_profile', {
        target_id: userId, new_badges: badges, new_banned: null, new_ban_reason: null,
      })
      if (error) throw error
      loadUsers(userSearch); loadStats()
      showToast('Badges updated')
    } catch (err) {
      showToast('Failed to update badges: ' + err.message, 'error')
    }
  }

  async function confirmDeleteUser(userId, username) {
    if (userId === user?.id) { showToast('Cannot delete your own account.', 'error'); return }
    setDeleteConfirm({ userId, username })
  }

  async function executeDeleteUser() {
    if (!deleteConfirm) return
    const { userId, username } = deleteConfirm
    setDeleteConfirm(null)
    try {
      const { error } = await supabase.rpc('admin_delete_user', { target_id: userId })
      if (error) throw error
      loadUsers(userSearch); loadStats()
      showToast(`@${username} deleted`)
    } catch (err) {
      showToast('Failed: ' + err.message, 'error')
    }
  }

  async function toggleBan(userId, currentlyBanned, username) {
    if (userId === user?.id) { showToast('Cannot ban your own account.', 'error'); return }
    if (currentlyBanned) {
      setModal({
        title: `Unban @${username}?`,
        message: `This will restore @${username}'s access to RotMarket.`,
        confirmLabel: 'Unban',
        onConfirm: async () => {
          const { error } = await supabase.rpc('admin_update_profile', {
            target_id: userId, new_badges: null, new_banned: false, new_ban_reason: null,
          })
          if (error) { showToast('Failed: ' + error.message, 'error'); return }
          showToast(`@${username} unbanned`)
          loadUsers(userSearch); loadStats()
        },
      })
    } else {
      setModal({
        title: `Ban @${username}?`,
        message: `This will prevent @${username} from accessing RotMarket. Their active listings will be removed.`,
        danger: true,
        confirmLabel: 'Ban User',
        inputLabel: 'Reason for ban',
        inputPlaceholder: 'e.g. Scamming, harassment...',
        onConfirm: async (reason) => {
          if (!reason) return
          const { error } = await supabase.rpc('admin_update_profile', {
            target_id: userId, new_badges: null, new_banned: true, new_ban_reason: reason,
          })
          if (error) { showToast('Failed: ' + error.message, 'error'); return }
          await supabase.from('listings').update({ status: 'deleted' }).eq('user_id', userId).eq('status', 'active')
          showToast(`@${username} banned`)
          loadUsers(userSearch); loadStats()
        },
      })
    }
  }

  async function deleteReview(reviewId) {
    setModal({
      title: 'Delete Review?',
      message: "This will permanently delete the review and recalculate the seller's rating.",
      danger: true,
      confirmLabel: 'Delete Review',
      onConfirm: async () => {
        try {
          const { error } = await supabase.rpc('admin_delete_review', { review_id: reviewId })
          if (error) throw error
          loadReviews(reviewSearch)
          showToast('Review deleted')
        } catch (err) {
          showToast('Failed: ' + err.message, 'error')
        }
      },
    })
  }

  async function deleteListing(listingId) {
    setModal({
      title: 'Delete Listing?',
      message: 'This will permanently remove the listing from RotMarket.',
      danger: true,
      confirmLabel: 'Delete Listing',
      onConfirm: async () => {
        try {
          const { error } = await supabase.rpc('admin_delete_listing', { listing_id: listingId })
          if (error) throw error
          loadListings(); loadStats()
          showToast('Listing deleted')
        } catch (err) {
          showToast('Failed: ' + err.message, 'error')
        }
      },
    })
  }

  async function createAccount() {
    if (!createForm.email || !createForm.password || !createForm.username) {
      showToast('All fields required.', 'error'); return
    }
    setCreating(true)
    try {
      const { error } = await supabase.rpc('admin_create_user', {
        user_email: createForm.email, user_password: createForm.password, user_username: createForm.username,
      })
      if (error) throw error
      showToast(`Account created for @${createForm.username}`)
      setCreateModal(false)
      setCreateForm({ email: '', password: '', username: '' })
      loadUsers(userSearch); loadStats()
    } catch (err) {
      showToast('Failed: ' + err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  // FIX: use admin_grant_promotion RPC to bypass RLS permission denied error
  async function grantPromotion() {
    if (!promoteModal) return
    setPromoting(true)
    try {
      const { role, duration, note } = promoteForm
      const expiresAt = duration ? addDays(duration) : null
      const targetUser = promoteModal.user

      // Use SECURITY DEFINER RPC to bypass RLS (fixes "permission denied for table user_promotions")
      const { error: promoError } = await supabase.rpc('admin_grant_promotion', {
        p_user_id: targetUser.id,
        p_role: role,
        p_expires_at: expiresAt,
        p_note: note || null,
      })
      if (promoError) throw promoError

      // Update the user's badges array
      const currentBadges = targetUser.badges?.length ? targetUser.badges : targetUser.badge ? [targetUser.badge] : []
      const newBadges = currentBadges.includes(role) ? currentBadges : [...currentBadges, role]
      const { error: badgeError } = await supabase.rpc('admin_update_profile', {
        target_id: targetUser.id, new_badges: newBadges, new_banned: null, new_ban_reason: null,
      })
      if (badgeError) throw badgeError

      showToast(`${role} granted to @${targetUser.username}`)
      setPromoteModal(null)
      setPromoteForm({ role: 'VIP', duration: 30, note: '' })
      loadPromotions(); loadUsers(userSearch)
    } catch (err) {
      showToast('Failed: ' + err.message, 'error')
    } finally {
      setPromoting(false)
    }
  }

  // FIX: use admin_revoke_promotion RPC
  async function revokePromotion(promo) {
    setModal({
      title: `Revoke ${promo.role}?`,
      message: `This will remove ${promo.role} from @${promo.user?.username}.`,
      danger: true,
      confirmLabel: 'Revoke',
      onConfirm: async () => {
        try {
          const { error: rpcError } = await supabase.rpc('admin_revoke_promotion', {
            p_promo_id: promo.id
          })
          if (rpcError) throw rpcError

          // Remove badge from user
          const currentBadges = promo.user?.badges?.length ? promo.user.badges : []
          const newBadges = currentBadges.filter(b => b !== promo.role)
          await supabase.rpc('admin_update_profile', {
            target_id: promo.user_id, new_badges: newBadges, new_banned: null, new_ban_reason: null,
          })

          showToast(`${promo.role} revoked from @${promo.user?.username}`)
          loadPromotions(); loadStats()
        } catch (err) {
          showToast('Failed: ' + err.message, 'error')
        }
      },
    })
  }

  // ─── RENDER GUARDS ───────────────────────────────────────────────

  if (loading) return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #1f2937', borderTopColor: '#4ade80', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#6b7280', fontSize: 13 }}>Loading admin panel...</div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (unauthorized) return (
    <div style={S.page}>
      <div style={{ textAlign: 'center', padding: '100px 24px' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🚫</div>
        <h2 style={{ color: '#f87171', marginBottom: 8, fontSize: 22 }}>Access Denied</h2>
        <p style={{ color: '#6b7280', marginBottom: 10 }}>Owner role required for the Admin Panel.</p>
        <p style={{ color: '#6b7280', marginBottom: 20, fontSize: 13 }}>
          Moderators — use the <Link href="/mod" style={{ color: '#60a5fa' }}>Moderator Panel</Link> instead.
        </p>
        <Link href="/" style={{ color: '#4ade80', fontWeight: 700 }}>← Back to Home</Link>
      </div>
    </div>
  )

  const TABS = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'reports', label: `🚩 Reports${stats.pendingReports > 0 ? ` (${stats.pendingReports})` : ''}` },
    { id: 'disputes', label: `⚖️ Disputes${stats.openDisputes > 0 ? ` (${stats.openDisputes})` : ''}` },
    { id: 'trades', label: '🔄 Trades' },
    { id: 'users', label: '👥 Users' },
    { id: 'promotions', label: `🎖️ Promotions${stats.activePromotions > 0 ? ` (${stats.activePromotions})` : ''}` },
    { id: 'reviews', label: '⭐ Reviews' },
    { id: 'listings', label: '📋 Listings' },
  ]

  const filteredPromotions = promotions.filter(p => {
    if (promoFilter === 'all') return true
    if (promoFilter === 'active') return p.active
    if (promoFilter === 'expired') return !p.active || (p.expires_at && new Date(p.expires_at) < new Date())
    return p.role === promoFilter
  })

  return (
    <div style={S.page}>

      <ConfirmModal modal={modal} onClose={() => setModal(null)} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          background: toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)',
          border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(74,222,128,0.4)'}`,
          color: toast.type === 'error' ? '#f87171' : '#4ade80',
          borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 600,
          backdropFilter: 'blur(8px)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.2s ease', maxWidth: 380,
        }}>
          {toast.type === 'error' ? '✕' : '✓'} {toast.msg}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal title="Delete User" onClose={() => setDeleteConfirm(null)}>
          <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <p style={{ color: '#f9fafb', fontSize: 14, marginBottom: 6 }}>
              Permanently delete <strong style={{ color: '#f87171' }}>@{deleteConfirm.username}</strong>?
            </p>
            <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 20 }}>
              This deletes their profile and all listings. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #2d2d3f',
                background: 'transparent', color: '#9ca3af', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={executeDeleteUser} style={{
                flex: 1, padding: '11px', borderRadius: 8, border: 'none',
                background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Delete Forever</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Account Modal */}
      {createModal && (
        <Modal title="Create Account" onClose={() => setCreateModal(false)}>
          {[
            { key: 'username', label: 'Username', type: 'text', placeholder: 'ExampleUser' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'user@email.com' },
            { key: 'password', label: 'Password', type: 'password', placeholder: 'Min. 8 characters' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={createForm[f.key]}
                onChange={e => setCreateForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={S.input} />
            </div>
          ))}
          <button onClick={createAccount} disabled={creating} style={{ width: '100%', marginTop: 4, padding: '11px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', background: creating ? '#1f2937' : '#16a34a', color: creating ? '#6b7280' : '#fff', cursor: creating ? 'default' : 'pointer' }}>
            {creating ? 'Creating...' : 'Create Account'}
          </button>
        </Modal>
      )}

      {/* Promote User Modal */}
      {promoteModal && (
        <Modal title={`Promote @${promoteModal.user.username}`} onClose={() => setPromoteModal(null)}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['VIP', 'Moderator', 'Verified Trader'].map(r => (
                <button key={r} onClick={() => setPromoteForm(p => ({ ...p, role: r, duration: r === 'Moderator' || r === 'Verified Trader' ? null : 30 }))} style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: promoteForm.role === r ? `${BADGE_COLORS[r]}22` : '#1f2937',
                  color: promoteForm.role === r ? BADGE_COLORS[r] : '#6b7280',
                  outline: promoteForm.role === r ? `1px solid ${BADGE_COLORS[r]}66` : 'none',
                }}>
                  {BADGE_ICONS[r]} {r}
                </button>
              ))}
            </div>
          </div>

          {(promoteForm.role === 'VIP') && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {VIP_DURATIONS.map(d => (
                  <button key={d.label} onClick={() => setPromoteForm(p => ({ ...p, duration: d.days }))} style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: promoteForm.duration === d.days ? 'rgba(245,158,11,0.15)' : '#1f2937',
                    color: promoteForm.duration === d.days ? '#f59e0b' : '#6b7280',
                    outline: promoteForm.duration === d.days ? '1px solid rgba(245,158,11,0.4)' : 'none',
                  }}>
                    {d.label}
                  </button>
                ))}
              </div>
              {promoteForm.duration && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                  Expires: <strong style={{ color: '#f9fafb' }}>{formatDate(addDays(promoteForm.duration))}</strong>
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Internal Note (optional)</label>
            <input type="text" placeholder="e.g. Paid via PayPal, annual plan..." value={promoteForm.note}
              onChange={e => setPromoteForm(p => ({ ...p, note: e.target.value }))}
              style={S.input} />
          </div>

          <button onClick={grantPromotion} disabled={promoting} style={{
            width: '100%', padding: '11px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none',
            background: promoting ? '#1f2937' : `${BADGE_COLORS[promoteForm.role]}cc`,
            color: promoting ? '#6b7280' : '#fff', cursor: promoting ? 'default' : 'pointer',
          }}>
            {promoting ? 'Granting...' : `Grant ${promoteForm.role}`}
          </button>
        </Modal>
      )}

      {/* Inspect User Modal */}
      {viewUser && (
        <Modal title="🔍 Inspect User" onClose={() => { setViewUser(null); setInspectData(null) }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
              background: viewUser.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 900, color: '#0a0a0f', position: 'relative',
            }}>
              {viewUser.avatar_url
                ? <Image src={viewUser.avatar_url} alt="" fill sizes="48px" style={{ objectFit: 'cover' }} />
                : getInitial(viewUser.username)}
            </div>
            <div>
              <Link href={`/profile/${viewUser.username}`} target="_blank"
                style={{ fontSize: 15, fontWeight: 800, color: '#f9fafb', textDecoration: 'none' }}>
                {viewUser.username}
              </Link>
              {viewUser.banned && <span style={{ marginLeft: 8, ...S.badge('#ef4444') }}>BANNED</span>}
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {(viewUser.badges?.length ? viewUser.badges : viewUser.badge ? [viewUser.badge] : []).join(', ') || 'No badges'}
              </div>
              <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>ID: {viewUser.id}</div>
              {userEmails[viewUser.id]?.lastSignIn && (
                <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>
                  🕐 Last login: {timeAgo(userEmails[viewUser.id].lastSignIn)}
                </div>
              )}
              {userEmails[viewUser.id]?.email && (
                <div style={{ fontSize: 10, color: '#60a5fa', marginTop: 1 }}>
                  📧 {userEmails[viewUser.id].email}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
            {[
              ['Trades', viewUser.trade_count ?? 0],
              ['Rating', `⭐ ${viewUser.rating || 0}`],
              ['Reviews', viewUser.review_count ?? 0],
              ['Msgs', inspectData?.messageCount ?? '…'],
            ].map(([label, val]) => (
              <div key={label} style={{ background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 7, padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f9fafb' }}>{val}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {inspectLoading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#6b7280', fontSize: 13 }}>Loading activity data…</div>
          ) : inspectData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 420, overflowY: 'auto' }}>

              {/* Reports against this user */}
              <InspectSection title={`🚩 Reports Against (${inspectData.reports.length})`} accent="#ef4444">
                {inspectData.reports.length === 0
                  ? <div style={S.emptyNote}>No reports filed against this user.</div>
                  : inspectData.reports.map(r => (
                    <div key={r.id} style={S.inspectRow}>
                      <span style={{ color: '#f87171', fontWeight: 700, fontSize: 11 }}>{r.reason}</span>
                      <span style={{ color: '#6b7280', fontSize: 10 }}>by {r.reporter?.username ?? '?'} · {timeAgo(r.created_at)}</span>
                      <span style={{ ...S.badge(r.status === 'pending' ? '#f59e0b' : '#4ade80'), fontSize: 9 }}>{r.status}</span>
                    </div>
                  ))
                }
              </InspectSection>

              {/* Listings */}
              <InspectSection title={`📋 Listings (${inspectData.listings.length})`} accent="#60a5fa">
                {inspectData.listings.length === 0
                  ? <div style={S.emptyNote}>No listings.</div>
                  : inspectData.listings.map(l => (
                    <div key={l.id} style={S.inspectRow}>
                      <Link href={`/listing/${l.id}`} target="_blank" style={{ color: '#93c5fd', fontSize: 11, fontWeight: 600, textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</Link>
                      <span style={{ color: '#6b7280', fontSize: 10 }}>{l.views ?? 0} views · {l.status}</span>
                      <span style={{ color: '#9ca3af', fontSize: 10 }}>{timeAgo(l.created_at)}</span>
                    </div>
                  ))
                }
              </InspectSection>

              {/* Trade requests */}
              <InspectSection title={`🔄 Trades (${inspectData.trades.length})`} accent="#a78bfa">
                {inspectData.trades.length === 0
                  ? <div style={S.emptyNote}>No trade activity.</div>
                  : inspectData.trades.map(t => (
                    <div key={t.id} style={S.inspectRow}>
                      <span style={{ color: '#c4b5fd', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.listing?.title ?? 'Unknown listing'}</span>
                      <span style={{ color: t.status === 'completed' ? '#4ade80' : t.status === 'pending' ? '#f59e0b' : '#6b7280', fontSize: 10, fontWeight: 700 }}>{t.status}</span>
                      <span style={{ color: '#6b7280', fontSize: 10 }}>{timeAgo(t.created_at)}</span>
                    </div>
                  ))
                }
              </InspectSection>

              {/* Reviews received */}
              <InspectSection title={`⭐ Reviews Received (${inspectData.reviews.length})`} accent="#f59e0b">
                {inspectData.reviews.length === 0
                  ? <div style={S.emptyNote}>No reviews yet.</div>
                  : inspectData.reviews.map(r => (
                    <div key={r.id} style={{ ...S.inspectRow, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                      <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
                        <span style={{ color: '#fbbf24', fontSize: 11 }}>{'⭐'.repeat(r.rating)}</span>
                        <span style={{ color: '#6b7280', fontSize: 10 }}>by {r.reviewer?.username ?? '?'} · {timeAgo(r.created_at)}</span>
                      </div>
                      {r.comment && <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>"{r.comment}"</div>}
                    </div>
                  ))
                }
              </InspectSection>

              {/* Reports made by this user */}
              {inspectData.reportsMade.length > 0 && (
                <InspectSection title={`📤 Reports Filed by User (${inspectData.reportsMade.length})`} accent="#6b7280">
                  {inspectData.reportsMade.map(r => (
                    <div key={r.id} style={S.inspectRow}>
                      <span style={{ color: '#9ca3af', fontSize: 11 }}>{r.reason} → {r.reported?.username ?? '?'}</span>
                      <span style={{ color: '#6b7280', fontSize: 10 }}>{timeAgo(r.created_at)}</span>
                    </div>
                  ))}
                </InspectSection>
              )}

              {inspectData.lastActive && (
                <div style={{ fontSize: 11, color: '#4b5563', textAlign: 'right' }}>
                  Last message activity: {timeAgo(inspectData.lastActive)}
                </div>
              )}
            </div>
          ) : null}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Link href={`/profile/${viewUser.username}`} target="_blank" style={{
              flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 7, fontSize: 12, fontWeight: 700,
              background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa',
              textDecoration: 'none',
            }}>View Profile ↗</Link>
            <button
              onClick={() => { toggleBan(viewUser.id, viewUser.banned, viewUser.username); setViewUser(null); setInspectData(null) }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: viewUser.banned ? 'rgba(74,222,128,0.12)' : 'rgba(239,68,68,0.12)',
                color: viewUser.banned ? '#4ade80' : '#f87171',
              }}>
              {viewUser.banned ? '✓ Unban' : '🚫 Ban'}
            </button>
          </div>
        </Modal>
      )}

      <div style={S.container}>

        {/* ─── Header ─── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: '0 0 3px', fontSize: 24, fontWeight: 900, color: '#f9fafb', letterSpacing: '-0.02em' }}>
              👑 Admin Panel
            </h1>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Signed in as{' '}
              <strong style={{ color: '#ef4444' }}>{profile?.username}</strong>
              {' · '}
              <span style={{ color: '#ef4444' }}>Owner</span>
              {' · '}
              <Link href="/mod" style={{ color: '#60a5fa', fontSize: 11 }}>→ Mod Panel</Link>
            </div>
          </div>
          <button onClick={() => setCreateModal(true)} style={{
            padding: '9px 16px', borderRadius: 8, border: 'none', background: 'rgba(74,222,128,0.15)',
            color: '#4ade80', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 0 0 1px rgba(74,222,128,0.3)',
          }}>
            ➕ Create Account
          </button>
        </div>

        {/* ─── Tabs ─── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1f2937', marginBottom: 24, overflowX: 'auto', gap: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              color: tab === t.id ? '#4ade80' : '#6b7280',
              borderBottom: tab === t.id ? '2px solid #4ade80' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ─── DASHBOARD TAB ─── */}
        {tab === 'dashboard' && (
          <DashboardTab stats={stats} onTabSwitch={setTab} />
        )}

        {/* ─── REPORTS TAB ─── */}
        {tab === 'reports' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['pending', 'reviewed', 'resolved', 'dismissed', 'all'].map(s => (
                <button key={s} onClick={() => { setReportFilter(s); loadReports(s) }}
                  style={S.pill('#4ade80', reportFilter === s)}>{s}</button>
              ))}
            </div>
            {reportsLoading
              ? <Loader />
              : reports.length === 0
              ? <EmptyState icon="✅" message={`No ${reportFilter} reports`} />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reports.map(r => <ReportCard key={r.id} report={r} onUpdate={updateReport} />)}
                </div>
            }
          </div>
        )}

        {/* ─── USERS TAB ─── */}
        {tab === 'users' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" placeholder="Search username..." value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadUsers(userSearch)}
                style={{ ...S.input, maxWidth: 280 }} />
              <button onClick={() => loadUsers(userSearch)} style={{
                padding: '10px 16px', borderRadius: 8, border: 'none', background: 'rgba(74,222,128,0.15)',
                color: '#4ade80', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>Search</button>

              {/* Email toggle */}
              <button
                onClick={() => showEmails ? setShowEmails(false) : loadEmails(userSearch)}
                disabled={emailsLoading}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: 'none',
                  background: showEmails ? 'rgba(96,165,250,0.2)' : 'rgba(96,165,250,0.1)',
                  color: '#60a5fa', fontSize: 12, fontWeight: 700, cursor: emailsLoading ? 'default' : 'pointer',
                  boxShadow: showEmails ? '0 0 0 1px rgba(96,165,250,0.4)' : 'none',
                }}>
                {emailsLoading ? '...' : showEmails ? '🔒 Hide Emails' : '📧 Show Emails'}
              </button>

              <span style={{ fontSize: 11, color: '#4b5563', marginLeft: 'auto' }}>{users.length} users</span>
            </div>

            {usersLoading
              ? <Loader />
              : users.length === 0
              ? <EmptyState icon="👥" message="No users found" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {users.map(u => (
                    <UserRow key={u.id} user={u}
                      emailData={showEmails ? userEmails[u.id] : null}
                      onUpdateBadge={updateBadge}
                      onToggleBan={toggleBan}
                      onDelete={confirmDeleteUser}
                      onInspect={openInspect}
                      onPromote={(u) => { setPromoteModal({ user: u }); setPromoteForm({ role: 'VIP', duration: 30, note: '' }) }}
                    />
                  ))}
                </div>
            }
          </div>
        )}

        {/* ─── PROMOTIONS TAB ─── */}
        {tab === 'promotions' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['all', 'active', 'VIP', 'Moderator', 'Verified Trader', 'expired'].map(f => (
                  <button key={f} onClick={() => setPromoFilter(f)} style={S.pill(BADGE_COLORS[f] || '#4ade80', promoFilter === f)}>
                    {f}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{filteredPromotions.length} record{filteredPromotions.length !== 1 ? 's' : ''}</div>
            </div>

            {promotionsLoading
              ? <Loader />
              : filteredPromotions.length === 0
              ? <EmptyState icon="🎖️" message="No promotions found" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredPromotions.map(p => (
                    <PromotionRow key={p.id} promo={p} onRevoke={revokePromotion} />
                  ))}
                </div>
            }
          </div>
        )}

        {/* ─── REVIEWS TAB ─── */}
        {tab === 'reviews' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input type="text" placeholder="Search by username..." value={reviewSearch}
                onChange={e => { setReviewSearch(e.target.value); loadReviews(e.target.value) }}
                style={{ ...S.input, maxWidth: 320 }} />
            </div>
            {reviewsLoading
              ? <Loader />
              : reviews.length === 0
              ? <EmptyState icon="⭐" message="No reviews found" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reviews.map(r => (
                    <div key={r.id} style={S.card}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4, fontSize: 12 }}>
                            <span style={{ color: '#6b7280' }}>From: <Link href={`/profile/${r.reviewer?.username}`} style={{ color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>{r.reviewer?.username}</Link></span>
                            <span style={{ color: '#6b7280' }}>To: <Link href={`/profile/${r.seller?.username}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>{r.seller?.username}</Link></span>
                            <span>{'⭐'.repeat(r.rating)}</span>
                            <span style={{ color: '#4b5563' }}>{timeAgo(r.created_at)}</span>
                          </div>
                          {r.comment && <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{r.comment}</p>}
                        </div>
                        <button onClick={() => deleteReview(r.id)} style={S.actionBtn('#f87171')}>🗑 Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ─── LISTINGS TAB ─── */}
        {tab === 'listings' && (
          <div>
            {listingsLoading
              ? <Loader />
              : listings.length === 0
              ? <EmptyState icon="📋" message="No listings" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {listings.map(l => (
                    <div key={l.id} style={S.card}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Link href={`/listing/${l.id}`} style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb', textDecoration: 'none' }}>{l.title}</Link>
                            <span style={S.badge('#6b7280')}>{l.rarity}</span>
                            <span style={S.badge(l.status === 'active' ? '#4ade80' : '#f87171')}>{l.status}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                            By <Link href={`/profile/${l.profiles?.username}`} style={{ color: '#9ca3af', textDecoration: 'none' }}>{l.profiles?.username}</Link>
                            {' · '}{l.game === 'fortnite' ? 'Fortnite' : 'Roblox'}
                            {l.price && ` · $${l.price}`}
                            {' · '}{l.views} views{' · '}{timeAgo(l.created_at)}
                          </div>
                        </div>
                        <button onClick={() => deleteListing(l.id)} style={S.actionBtn('#f87171')}>🗑 Delete</button>
                      </div>
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
              ? <Loader />
              : disputes.length === 0
              ? <EmptyState icon="⚖️" message="No disputes filed yet" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {disputes.map(d => <DisputeCard key={d.id} dispute={d} onUpdate={updateDispute} />)}
                </div>
            }
          </div>
        )}

        {/* ─── TRADES TAB ─── */}
        {tab === 'trades' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <input
                placeholder="Search buyer or seller username…"
                value={tradeSearch}
                onChange={e => setTradeSearch(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
              />
              <select value={tradeStatusFilter} onChange={e => setTradeStatusFilter(e.target.value)} style={{ minWidth: 140 }}>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="completed">Completed</option>
                <option value="declined">Declined</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button onClick={() => loadTrades()} style={{ padding: '8px 14px', background: '#1a1a2e', border: '1px solid #2d2d3f', borderRadius: 8, color: '#9ca3af', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ↻ Refresh
              </button>
            </div>

            {tradesLoading ? <Loader /> : (() => {
              const filtered = trades.filter(t => {
                const matchStatus = tradeStatusFilter === 'all' || t.status === tradeStatusFilter
                const q = tradeSearch.toLowerCase().trim()
                const matchSearch = !q ||
                  t.buyer?.username?.toLowerCase().includes(q) ||
                  t.seller?.username?.toLowerCase().includes(q) ||
                  t.listing?.title?.toLowerCase().includes(q)
                return matchStatus && matchSearch
              })

              if (filtered.length === 0) return <EmptyState icon="🔄" message="No trades match your filters" />

              const statusColor = { pending: '#f59e0b', accepted: '#60a5fa', completed: '#4ade80', declined: '#ef4444', cancelled: '#6b7280' }
              const statusIcon  = { pending: '⏳', accepted: '✓', completed: '🎉', declined: '✕', cancelled: '—' }

              return (
                <div>
                  <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 10 }}>
                    Showing {filtered.length} of {trades.length} trades
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filtered.map(t => {
                      const buyerBanned  = t.buyer?.banned
                      const sellerBanned = t.seller?.banned
                      const isFlagged    = buyerBanned || sellerBanned
                      return (
                        <div key={t.id} style={{
                          ...S.card,
                          borderColor: isFlagged ? 'rgba(239,68,68,0.35)' : undefined,
                          background: isFlagged ? 'rgba(239,68,68,0.04)' : undefined,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>

                            {/* Status pill */}
                            <div style={{ flexShrink: 0, paddingTop: 2 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20,
                                background: (statusColor[t.status] || '#6b7280') + '22',
                                color: statusColor[t.status] || '#6b7280',
                                border: `1px solid ${(statusColor[t.status] || '#6b7280')}44`,
                                whiteSpace: 'nowrap',
                              }}>
                                {statusIcon[t.status]} {t.status?.toUpperCase()}
                              </span>
                            </div>

                            {/* Main info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Listing */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                <Link href={`/listing/${t.listing_id}`} style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb', textDecoration: 'none' }}>
                                  {t.listing?.title || 'Deleted Listing'}
                                </Link>
                                {t.listing?.type && <span style={S.badge('#6b7280')}>{t.listing.type}</span>}
                                {t.listing?.game && <span style={S.badge('#6b7280')}>{t.listing.game}</span>}
                                {t.offer_price && <span style={S.badge('#60a5fa')}>${t.offer_price}</span>}
                              </div>

                              {/* Buyer → Seller */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ color: '#6b7280' }}>Buyer:</span>
                                  {t.buyer ? (
                                    <Link href={`/profile/${t.buyer.username}`} style={{ color: buyerBanned ? '#f87171' : '#d1d5db', textDecoration: 'none', fontWeight: 600 }}>
                                      {buyerBanned && '🚫 '}{t.buyer.username}
                                    </Link>
                                  ) : <span style={{ color: '#4b5563' }}>deleted</span>}
                                </div>
                                <span style={{ color: '#2d2d3f' }}>→</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ color: '#6b7280' }}>Seller:</span>
                                  {t.seller ? (
                                    <Link href={`/profile/${t.seller.username}`} style={{ color: sellerBanned ? '#f87171' : '#d1d5db', textDecoration: 'none', fontWeight: 600 }}>
                                      {sellerBanned && '🚫 '}{t.seller.username}
                                    </Link>
                                  ) : <span style={{ color: '#4b5563' }}>deleted</span>}
                                </div>
                              </div>

                              {/* Offer message */}
                              {t.offer_message && (
                                <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280', fontStyle: 'italic', borderLeft: '2px solid #1f2937', paddingLeft: 8 }}>
                                  "{t.offer_message.length > 120 ? t.offer_message.slice(0, 120) + '…' : t.offer_message}"
                                </div>
                              )}

                              {/* Confirmations for accepted/completed */}
                              {(t.status === 'accepted' || t.status === 'completed') && (
                                <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
                                  <span>Buyer confirmed: <strong style={{ color: t.buyer_confirmed ? '#4ade80' : '#4b5563' }}>{t.buyer_confirmed ? '✓ Yes' : '✗ No'}</strong></span>
                                  <span>Seller confirmed: <strong style={{ color: t.seller_confirmed ? '#4ade80' : '#4b5563' }}>{t.seller_confirmed ? '✓ Yes' : '✗ No'}</strong></span>
                                </div>
                              )}
                            </div>

                            {/* Timestamp + actions */}
                            <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                              <div style={{ fontSize: 11, color: '#4b5563' }}>{timeAgo(t.created_at)}</div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <Link href={`/listing/${t.listing_id}`} style={{ fontSize: 11, fontWeight: 600, color: '#60a5fa', textDecoration: 'none', padding: '4px 8px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 6 }}>
                                  View Listing
                                </Link>
                                {(t.buyer || t.seller) && (
                                  <button
                                    onClick={() => {
                                      const target = t.buyer || t.seller
                                      openInspect(target)
                                    }}
                                    style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', background: '#1a1a2e', border: '1px solid #2d2d3f', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
                                  >
                                    Inspect Users
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {isFlagged && (
                            <div style={{ marginTop: 8, padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, fontSize: 11, color: '#f87171', fontWeight: 600 }}>
                              ⚠️ {buyerBanned && sellerBanned ? 'Both parties are banned' : buyerBanned ? 'Buyer is banned' : 'Seller is banned'}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; }
        input, textarea, select { background: #0d0d14; border: 1px solid #2d2d3f; border-radius: 8px; padding: 9px 12px; color: #f9fafb; font-size: 13px; outline: none; }
        input:focus, textarea:focus, select:focus { border-color: rgba(74,222,128,0.4); }
        textarea { resize: vertical; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d2d3f; border-radius: 2px; }
      `}</style>
    </div>
  )
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────

function DashboardTab({ stats, onTabSwitch }) {
  const statCards = [
    { label: 'Total Users', value: stats.totalUsers || 0, color: '#4ade80', icon: '👥', tab: 'users' },
    { label: 'Active Listings', value: stats.activeListings || 0, color: '#60a5fa', icon: '📋', tab: 'listings' },
    { label: 'Pending Reports', value: stats.pendingReports || 0, color: '#f59e0b', icon: '🚩', tab: 'reports', alert: stats.pendingReports > 0 },
    { label: 'Total Trades', value: stats.completedTrades || 0, color: '#a78bfa', icon: '🔄', tab: 'trades' },
    { label: 'Banned Users', value: stats.bannedUsers || 0, color: '#ef4444', icon: '🚫', tab: 'users' },
    { label: 'Open Disputes', value: stats.openDisputes || 0, color: '#f97316', icon: '⚖️', tab: 'disputes', alert: stats.openDisputes > 0 },
    { label: 'Active Promotions', value: stats.activePromotions || 0, color: '#f59e0b', icon: '🎖️', tab: 'promotions' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10, marginBottom: 28 }}>
        {statCards.map(s => (
          <div key={s.label}
            onClick={() => s.tab && onTabSwitch(s.tab)}
            style={{
              background: s.alert ? `${s.color}08` : '#111118',
              border: `1px solid ${s.alert ? s.color + '40' : '#1f2937'}`,
              borderRadius: 10, padding: '16px 14px', textAlign: 'center',
              cursor: s.tab ? 'pointer' : 'default',
              transition: 'border-color 0.15s, background 0.15s',
            }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {[
          { title: '🔴 Needs Attention', items: [
            { label: 'Pending Reports', value: stats.pendingReports, color: '#f59e0b', tab: 'reports', urgent: stats.pendingReports > 0 },
            { label: 'Open Disputes', value: stats.openDisputes, color: '#f97316', tab: 'disputes', urgent: stats.openDisputes > 0 },
          ]},
          { title: '📈 Site Health', items: [
            { label: 'Total Users', value: stats.totalUsers, color: '#4ade80' },
            { label: 'Active Listings', value: stats.activeListings, color: '#60a5fa' },
            { label: 'Total Trades', value: stats.completedTrades, color: '#a78bfa', tab: 'trades' },
          ]},
          { title: '🎖️ Roles Active', items: [
            { label: 'Active Promotions', value: stats.activePromotions, color: '#f59e0b', tab: 'promotions' },
            { label: 'Banned Users', value: stats.bannedUsers, color: '#ef4444', tab: 'users' },
          ]},
        ].map(section => (
          <div key={section.title} style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{section.title}</div>
            {section.items.map(item => (
              <div key={item.label}
                onClick={() => item.tab && onTabSwitch(item.tab)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid #1f293740',
                  cursor: item.tab ? 'pointer' : 'default',
                }}>
                <span style={{ fontSize: 12, color: item.urgent ? item.color : '#9ca3af' }}>{item.label}</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: item.urgent ? item.color : '#f9fafb' }}>{item.value ?? '—'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PROMOTION ROW ────────────────────────────────────────────────────────────

function PromotionRow({ promo, onRevoke }) {
  // FIX: use promo.user (renamed from promo.profiles to match the new query hint)
  const user = promo.user || promo.profiles
  const color = BADGE_COLORS[promo.role] || '#9ca3af'
  const daysLeft = daysUntil(promo.expires_at)
  const isExpired = promo.expires_at && new Date(promo.expires_at) < new Date()
  const isLifetime = !promo.expires_at && promo.active
  const isActive = promo.active && !isExpired

  return (
    <div style={{
      background: '#111118',
      border: `1px solid ${isActive ? color + '30' : '#1f2937'}`,
      borderRadius: 10, padding: '12px 16px',
      opacity: isActive ? 1 : 0.65,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 160 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: user?.avatar_url ? 'transparent' : `${color}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 900, color, overflow: 'hidden', position: 'relative',
          }}>
            {user?.avatar_url
              ? <Image src={user.avatar_url} alt="" fill sizes="34px" style={{ objectFit: 'cover' }} />
              : getInitial(user?.username)}
          </div>
          <div>
            <Link href={`/profile/${user?.username}`} style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb', textDecoration: 'none' }}>
              @{user?.username || 'Unknown'}
            </Link>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>Granted {timeAgo(promo.granted_at)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={S.badge(color)}>{BADGE_ICONS[promo.role]} {promo.role}</span>
          <div style={{ fontSize: 11, minWidth: 100 }}>
            {!promo.active || promo.revoked_at ? (
              <span style={{ color: '#6b7280' }}>Revoked {timeAgo(promo.revoked_at)}</span>
            ) : isLifetime ? (
              <span style={{ color: '#a78bfa' }}>♾ Lifetime</span>
            ) : isExpired ? (
              <span style={{ color: '#ef4444' }}>Expired {formatDate(promo.expires_at)}</span>
            ) : daysLeft !== null ? (
              <span style={{ color: daysLeft <= 7 ? '#f59e0b' : '#4ade80' }}>
                {daysLeft <= 0 ? 'Expires today' : `${daysLeft}d left`}
                <span style={{ color: '#4b5563', marginLeft: 4 }}>({formatDate(promo.expires_at)})</span>
              </span>
            ) : null}
          </div>
        </div>

        {promo.note && (
          <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', flex: 1, minWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{promo.note}"
          </span>
        )}

        {isActive && (
          <button onClick={() => onRevoke(promo)} style={S.actionBtn('#f87171')}>
            ✕ Revoke
          </button>
        )}
      </div>
    </div>
  )
}

// ─── USER ROW ─────────────────────────────────────────────────────────────────

const ALL_BADGES = BADGE_HIERARCHY

function UserRow({ user, emailData, onUpdateBadge, onToggleBan, onDelete, onPromote, onInspect }) {
  const initialBadges = user.badges?.length ? user.badges : user.badge ? [user.badge] : []
  const [selectedBadges, setSelectedBadges] = useState(initialBadges)
  const [saving, setSaving] = useState(false)
  const [showBadges, setShowBadges] = useState(false)

  const toggleBadge = (badge) => {
    setSelectedBadges(prev => prev.includes(badge) ? prev.filter(b => b !== badge) : [...prev, badge])
  }

  async function handleSaveBadges() {
    setSaving(true)
    await onUpdateBadge(user.id, selectedBadges)
    setSaving(false)
    setShowBadges(false)
  }

  return (
    <div style={{
      background: '#111118',
      border: `1px solid ${user.banned ? 'rgba(239,68,68,0.2)' : '#1f2937'}`,
      borderRadius: 10, padding: '12px 16px',
      opacity: user.banned ? 0.8 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          background: user.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 900, color: '#0a0a0f', position: 'relative',
        }}>
          {user.avatar_url ? <Image src={user.avatar_url} alt="" fill sizes="38px" style={{ objectFit: 'cover' }} /> : getInitial(user.username)}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <Link href={`/profile/${user.username}`} style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb', textDecoration: 'none' }}>{user.username}</Link>
            {initialBadges.filter(b => ALL_BADGES.includes(b)).map(b => (
              <span key={b} style={S.badge(BADGE_COLORS[b] || '#9ca3af')}>{BADGE_ICONS[b]} {b}</span>
            ))}
            {user.banned && <span style={S.badge('#ef4444')}>BANNED</span>}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            {user.trade_count || 0} trades · ⭐{user.rating || 0} · {user.review_count || 0} reviews
            {user.ban_reason && <span style={{ marginLeft: 8, color: '#f87171' }}>Ban: {user.ban_reason}</span>}
          </div>
          {/* Email row — only shown when Show Emails is active */}
          {emailData && (
            <div style={{ fontSize: 11, marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#60a5fa' }}>📧 {emailData.email || '—'}</span>
              {emailData.lastSignIn && (
                <span style={{ color: '#4b5563' }}>Last login: {timeAgo(emailData.lastSignIn)}</span>
              )}
              {!emailData.confirmed && (
                <span style={{ color: '#f59e0b' }}>⚠ Unconfirmed</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={() => onInspect(user)} style={S.actionBtn('#9ca3af')}>🔍 Inspect</button>
          <button onClick={() => onPromote(user)} style={S.actionBtn('#f59e0b')}>🎖️ Promote</button>
          <button onClick={() => setShowBadges(s => !s)} style={{
            ...S.actionBtn('#60a5fa'),
            background: showBadges ? 'rgba(96,165,250,0.2)' : 'rgba(96,165,250,0.1)',
          }}>🏷 Badges</button>
          <button onClick={() => onToggleBan(user.id, user.banned, user.username)} style={S.actionBtn(user.banned ? '#4ade80' : '#f87171')}>
            {user.banned ? '✓ Unban' : '🚫 Ban'}
          </button>
          <button onClick={() => onDelete(user.id, user.username)} style={S.actionBtn('#ef4444')}>
            🗑 Delete
          </button>
        </div>
      </div>

      {/* Badge editor */}
      {showBadges && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1f2937' }}>
          <div style={S.sectionTitle}>Assign Badges</div>
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
                  {BADGE_ICONS[badge] || '·'} {badge}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleSaveBadges} disabled={saving} style={{
              padding: '7px 16px', borderRadius: 7, border: 'none',
              background: saving ? '#1f2937' : '#16a34a', color: saving ? '#6b7280' : '#fff',
              fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
            }}>
              {saving ? 'Saving...' : 'Save Badges'}
            </button>
            <button onClick={() => setSelectedBadges([])} style={{
              padding: '7px 14px', borderRadius: 7, border: '1px solid #2d2d3f',
              background: 'transparent', color: '#6b7280', fontSize: 12, cursor: 'pointer',
            }}>Clear All</button>
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

// ─── REPORT CARD ──────────────────────────────────────────────────────────────

function ReportCard({ report, onUpdate }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(report.admin_notes || '')
  const [chatLogs, setChatLogs] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatError, setChatError] = useState('')
  const [userActivity, setUserActivity] = useState(null)

  const loadChatLogs = async () => {
    if (chatLogs) { setChatOpen(o => !o); return }
    setChatLoading(true)
    setChatError('')
    try {
      const { data } = await supabase
        .from('messages')
        .select(`*, sender:profiles!messages_sender_id_fkey(id, username)`)
        .or(`and(sender_id.eq.${report.reporter_id},receiver_id.eq.${report.reported_user_id}),and(sender_id.eq.${report.reported_user_id},receiver_id.eq.${report.reporter_id})`)
        .order('created_at', { ascending: true }).limit(200)
      const [{ data: trades }, { data: reviews }] = await Promise.all([
        supabase.from('trade_requests').select('id, status, created_at, listing_id').eq('seller_id', report.reported_user_id).order('created_at', { ascending: false }).limit(20),
        supabase.from('reviews').select('rating, comment, created_at').eq('seller_id', report.reported_user_id).order('created_at', { ascending: false }).limit(10),
      ])
      setChatLogs(data || [])
      setUserActivity({ trades: trades || [], reviews: reviews || [] })
      setChatOpen(true)
    } catch (err) {
      setChatError('Failed to load logs: ' + err.message)
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div style={{
      background: '#111118',
      border: `1px solid ${report.status === 'pending' ? 'rgba(245,158,11,0.25)' : '#1f2937'}`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={S.badge(STATUS_COLORS[report.status] || '#6b7280')}>{report.status}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{REASON_LABELS[report.reason] || report.reason}</span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>{timeAgo(report.created_at)}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6, fontSize: 12 }}>
            <span><span style={{ color: '#6b7280' }}>Reporter: </span><Link href={`/profile/${report.reporter?.username}`} style={{ color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>{report.reporter?.username || 'Unknown'}</Link></span>
            <span>
              <span style={{ color: '#6b7280' }}>Reported: </span>
              <Link href={`/profile/${report.reported_user?.username}`} style={{ color: '#f87171', textDecoration: 'none', fontWeight: 600 }}>{report.reported_user?.username || 'Unknown'}</Link>
              {report.reported_user?.banned && <span style={{ ...S.badge('#ef4444'), marginLeft: 6 }}>BANNED</span>}
            </span>
            {report.listings && <span><span style={{ color: '#6b7280' }}>Listing: </span><Link href={`/listing/${report.listing_id}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>{report.listings.title}</Link></span>}
          </div>
          {report.details && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9ca3af', lineHeight: 1.6, background: '#0d0d14', padding: '8px 12px', borderRadius: 6, border: '1px solid #1f2937' }}>{report.details}</p>}
          {report.admin_notes && !notesOpen && <p style={{ margin: '0 0 6px', fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Notes: {report.admin_notes}</p>}
          {notesOpen && <textarea rows={2} placeholder="Admin notes..." value={notes} onChange={e => setNotes(e.target.value)} style={{ marginTop: 8, width: '100%', fontSize: 12 }} />}
          {chatOpen && chatLogs !== null && <ChatAndActivity chatLogs={chatLogs} userActivity={userActivity} username={report.reported_user?.username} />}
          {chatError && <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>⚠️ {chatError}</div>}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button onClick={loadChatLogs} disabled={chatLoading} style={S.actionBtn('#60a5fa')}>
            {chatLoading ? '...' : chatOpen ? '💬 Hide' : '💬 Logs'}
          </button>
          <button onClick={() => setNotesOpen(o => !o)} style={S.actionBtn('#9ca3af')}>📝 Notes</button>
          {report.status !== 'resolved' && <button onClick={() => onUpdate(report.id, 'resolved', notes)} style={S.actionBtn('#4ade80')}>✓ Resolve</button>}
          {report.status !== 'dismissed' && <button onClick={() => onUpdate(report.id, 'dismissed', notes)} style={S.actionBtn('#6b7280')}>✕ Dismiss</button>}
          {report.status === 'pending' && <button onClick={() => onUpdate(report.id, 'reviewed', notes)} style={S.actionBtn('#60a5fa')}>👁 Review</button>}
        </div>
      </div>
    </div>
  )
}

// ─── DISPUTE CARD ─────────────────────────────────────────────────────────────

function DisputeCard({ dispute, onUpdate }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(dispute.admin_notes || '')
  const [resolution, setResolution] = useState(dispute.resolution || '')
  const [chatLogs, setChatLogs] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [userActivity, setUserActivity] = useState(null)
  const [chatError, setChatError] = useState('')
  const statusColor = DISPUTE_STATUS_COLORS[dispute.status] || '#6b7280'

  const loadChatLogs = async () => {
    if (chatLogs) { setChatOpen(o => !o); return }
    setChatLoading(true)
    setChatError('')
    try {
      const [{ data: msgs }, { data: trades }, { data: reviews }] = await Promise.all([
        supabase.from('messages').select(`*, sender:profiles!messages_sender_id_fkey(id, username)`)
          .or(`and(sender_id.eq.${dispute.opened_by},receiver_id.eq.${dispute.against_user_id}),and(sender_id.eq.${dispute.against_user_id},receiver_id.eq.${dispute.opened_by})`)
          .order('created_at', { ascending: true }).limit(200),
        supabase.from('trade_requests').select('id, status, created_at, listing_id')
          .or(`seller_id.eq.${dispute.against_user_id},buyer_id.eq.${dispute.against_user_id}`)
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('reviews').select('rating, comment, created_at')
          .eq('seller_id', dispute.against_user_id).order('created_at', { ascending: false }).limit(10),
      ])
      setChatLogs(msgs || [])
      setUserActivity({ trades: trades || [], reviews: reviews || [] })
      setChatOpen(true)
    } catch (err) { setChatError('Failed to load logs: ' + err.message) }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={S.badge(statusColor)}>{dispute.status.replace('_', ' ')}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>{DISPUTE_REASON_LABELS[dispute.reason] || dispute.reason}</span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>{timeAgo(dispute.created_at)}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6, fontSize: 12 }}>
            <span><span style={{ color: '#6b7280' }}>Opened by: </span><Link href={`/profile/${dispute.opener?.username}`} style={{ color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>{dispute.opener?.username || 'Unknown'}</Link></span>
            <span><span style={{ color: '#6b7280' }}>Against: </span><Link href={`/profile/${dispute.against?.username}`} style={{ color: '#f87171', textDecoration: 'none', fontWeight: 600 }}>{dispute.against?.username || 'Unknown'}</Link></span>
            {dispute.listings && <span><span style={{ color: '#6b7280' }}>Listing: </span><Link href={`/listing/${dispute.listing_id}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>{dispute.listings.title}</Link></span>}
          </div>
          {dispute.details && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9ca3af', lineHeight: 1.6, background: '#0d0d14', padding: '8px 12px', borderRadius: 6, border: '1px solid #1f2937' }}>{dispute.details}</p>}
          {notesOpen && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea rows={2} placeholder="Admin notes (internal)..." value={notes} onChange={e => setNotes(e.target.value)} style={{ fontSize: 12 }} />
              <input type="text" placeholder="Resolution summary (shown to users)..." value={resolution} onChange={e => setResolution(e.target.value)} style={{ fontSize: 12 }} />
            </div>
          )}
          {dispute.resolution && !notesOpen && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#4ade80', fontStyle: 'italic' }}>Resolution: {dispute.resolution}</p>}
          {chatOpen && chatLogs !== null && <ChatAndActivity chatLogs={chatLogs} userActivity={userActivity} username={dispute.against?.username} />}
          {chatError && <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>⚠️ {chatError}</div>}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button onClick={loadChatLogs} disabled={chatLoading} style={S.actionBtn('#60a5fa')}>{chatLoading ? '...' : chatOpen ? '💬 Hide' : '💬 Logs'}</button>
          <button onClick={() => setNotesOpen(o => !o)} style={S.actionBtn('#9ca3af')}>📝 Notes</button>
          {dispute.status === 'open' && <button onClick={() => onUpdate(dispute.id, 'under_review', resolution, notes)} style={S.actionBtn('#60a5fa')}>👁 Review</button>}
          {dispute.status !== 'resolved' && <button onClick={() => onUpdate(dispute.id, 'resolved', resolution, notes)} style={S.actionBtn('#4ade80')}>✓ Resolve</button>}
          {dispute.status !== 'dismissed' && <button onClick={() => onUpdate(dispute.id, 'dismissed', resolution, notes)} style={S.actionBtn('#6b7280')}>✕ Dismiss</button>}
        </div>
      </div>
    </div>
  )
}

// ─── CHAT + ACTIVITY VIEWER ───────────────────────────────────────────────────

function ChatAndActivity({ chatLogs, userActivity, username }) {
  const [viewTab, setViewTab] = useState('chat')
  return (
    <div style={{ marginTop: 12, background: '#0d0d14', border: '1px solid #2d2d3f', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #1f2937', overflowX: 'auto' }}>
        {[
          { id: 'chat', label: `💬 Chat (${chatLogs.length})` },
          { id: 'trades', label: `🔄 Trades (${userActivity?.trades?.length || 0})` },
          { id: 'reviews', label: `⭐ Reviews (${userActivity?.reviews?.length || 0})` },
        ].map(t => (
          <button key={t.id} onClick={() => setViewTab(t.id)} style={{
            padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            color: viewTab === t.id ? '#60a5fa' : '#6b7280',
            borderBottom: viewTab === t.id ? '2px solid #60a5fa' : '2px solid transparent',
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto', padding: 12 }}>
        {viewTab === 'chat' && (
          chatLogs.length === 0
            ? <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No messages between these users</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {chatLogs.map((m, i) => (
                  <div key={m.id || i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap', marginTop: 2, minWidth: 60 }}>
                      {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: m.sender?.username === username ? '#f87171' : '#4ade80', minWidth: 70, whiteSpace: 'nowrap' }}>
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
                    <span style={{ color: '#4b5563', whiteSpace: 'nowrap', minWidth: 60 }}>
                      {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={S.badge(t.status === 'completed' ? '#4ade80' : t.status === 'pending' ? '#f59e0b' : '#6b7280')}>{t.status}</span>
                    <Link href={`/listing/${t.listing_id}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>View →</Link>
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
                      <span style={{ color: '#4b5563', fontSize: 10 }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function InspectSection({ title, accent, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#111118', border: '1px solid #2d2d3f', borderRadius: 16,
        padding: 28, width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        animation: 'slideIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f9fafb' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', color: '#6b7280', fontSize: 13 }}>
      <div style={{ width: 16, height: 16, border: '2px solid #1f2937', borderTopColor: '#4ade80', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Loading...
    </div>
  )
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{message}</div>
    </div>
  )
}
