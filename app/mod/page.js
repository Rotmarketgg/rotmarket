'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getSessionUser, getProfile, supabase } from '@/lib/supabase'
import { timeAgo, getInitial } from '@/lib/utils'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

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

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#f9fafb',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
  },
  container: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '28px 16px',
  },
  card: {
    background: '#111118',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: '16px 18px',
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
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ModPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [tab, setTab] = useState('overview')
  const [toast, setToast] = useState(null)

  // Stats
  const [stats, setStats] = useState({})

  // Reports
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportFilter, setReportFilter] = useState('pending')

  // Disputes
  const [disputes, setDisputes] = useState([])
  const [disputesLoading, setDisputesLoading] = useState(false)
  const [disputeFilter, setDisputeFilter] = useState('open')

  const profileBadges = profile?.badges?.length ? profile.badges : profile?.badge ? [profile.badge] : []
  const isOwner = profileBadges.includes('Owner')
  const isMod = profileBadges.includes('Moderator') || isOwner

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
        const isModerator = ['Owner', 'Moderator'].some(b => pBadges.includes(b))
        if (!p || !isModerator) {
          setUnauthorized(true); setLoading(false); return
        }
        setUser(u)
        setProfile(p)
        setLoading(false)
        loadStats()
        loadReports('pending')
        loadDisputes('open')
      } catch (err) {
        console.error('Mod init error:', err)
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
    if (tab === 'reports') loadReports(reportFilter)
    if (tab === 'disputes') loadDisputes(disputeFilter)
  }, [tab])

  // ─── LOADERS ─────────────────────────────────────────────────────

  async function loadStats() {
    const [r1, r2, r3] = await Promise.all([
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'under_review'),
    ])
    setStats({
      pendingReports: r1.count || 0,
      openDisputes: r2.count || 0,
      reviewingDisputes: r3.count || 0,
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

      const userIds = [...new Set([
        ...rawReports.map(r => r.reporter_id).filter(Boolean),
        ...rawReports.map(r => r.reported_id).filter(Boolean),
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

      setReports(rawReports.map(r => ({
        ...r,
        reporter: profileMap[r.reporter_id] ?? null,
        reported_user: profileMap[r.reported_id] ?? null,
        listings: listingMap[r.listing_id] ?? null,
      })))
    } catch (err) {
      showToast('Error loading reports: ' + err.message, 'error')
    } finally {
      setReportsLoading(false)
    }
  }

  async function loadDisputes(status) {
    setDisputesLoading(true)
    try {
      let q = supabase
        .from('disputes')
        .select(`
          *,
          opener:profiles!disputes_opened_by_fkey(id, username, avatar_url),
          against:profiles!disputes_against_user_id_fkey(id, username, avatar_url),
          listings(id, title)
        `)
        .order('created_at', { ascending: false })
        .limit(100)
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      setDisputes(data || [])
    } catch (err) {
      showToast('Error loading disputes: ' + err.message, 'error')
    } finally {
      setDisputesLoading(false)
    }
  }

  // ─── ACTIONS ─────────────────────────────────────────────────────

  async function updateReport(reportId, status, notes) {
    try {
      const { error } = await supabase.from('reports').update({
        status,
        admin_notes: notes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', reportId)
      if (error) throw error
      loadReports(reportFilter)
      loadStats()
      showToast('Report updated')
    } catch (err) {
      showToast('Failed: ' + err.message, 'error')
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
      loadDisputes(disputeFilter)
      loadStats()
      showToast('Dispute updated')
    } catch (err) {
      showToast('Failed: ' + err.message, 'error')
    }
  }

  // Moderators can warn-ban (temporary) but not permanently delete users.
  // For permanent actions, escalate to Owner via admin panel.
  async function warnBanUser(userId, username) {
    if (!confirm(`Temporarily ban @${username}? They can appeal to an Owner.`)) return
    const reason = prompt(`Reason for warning/banning @${username}:`)
    if (!reason) return
    try {
      const { error } = await supabase.rpc('admin_update_profile', {
        target_id: userId,
        new_badges: null,
        new_banned: true,
        new_ban_reason: `[Mod action] ${reason}`,
      })
      if (error) throw error
      showToast(`@${username} banned — Owner can review/reverse this`)
    } catch (err) {
      showToast('Failed: ' + err.message + ' — Escalate to Owner if needed', 'error')
    }
  }

  // ─── RENDER GUARDS ───────────────────────────────────────────────

  if (loading) return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #1f2937', borderTopColor: '#60a5fa', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#6b7280', fontSize: 13 }}>Loading moderator panel...</div>
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
        <p style={{ color: '#6b7280', marginBottom: 20 }}>Moderator or Owner role required.</p>
        <Link href="/" style={{ color: '#4ade80', fontWeight: 700 }}>← Back to Home</Link>
      </div>
    </div>
  )

  const TABS = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'reports', label: `🚩 Reports${stats.pendingReports > 0 ? ` (${stats.pendingReports})` : ''}` },
    { id: 'disputes', label: `⚖️ Disputes${(stats.openDisputes + (stats.reviewingDisputes || 0)) > 0 ? ` (${stats.openDisputes})` : ''}` },
  ]

  return (
    <div style={S.page}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          background: toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(96,165,250,0.15)',
          border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(96,165,250,0.4)'}`,
          color: toast.type === 'error' ? '#f87171' : '#60a5fa',
          borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 600,
          backdropFilter: 'blur(8px)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.2s ease', maxWidth: 380,
        }}>
          {toast.type === 'error' ? '✕' : '✓'} {toast.msg}
        </div>
      )}

      <div style={S.container}>

        {/* ─── Header ─── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: '0 0 3px', fontSize: 24, fontWeight: 900, color: '#f9fafb', letterSpacing: '-0.02em' }}>
              🛡️ Moderator Panel
            </h1>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Signed in as{' '}
              <strong style={{ color: '#60a5fa' }}>{profile?.username}</strong>
              {' · '}
              <span style={{ color: '#60a5fa' }}>{isOwner ? 'Owner' : 'Moderator'}</span>
              {isOwner && (
                <>
                  {' · '}
                  <Link href="/admin" style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>→ Admin Panel</Link>
                </>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'Pending Reports', value: stats.pendingReports || 0, color: '#f59e0b', urgent: stats.pendingReports > 0 },
              { label: 'Open Disputes', value: stats.openDisputes || 0, color: '#f97316', urgent: stats.openDisputes > 0 },
            ].map(s => (
              <div key={s.label} style={{
                background: s.urgent ? `${s.color}10` : '#111118',
                border: `1px solid ${s.urgent ? s.color + '40' : '#1f2937'}`,
                borderRadius: 10, padding: '10px 16px', textAlign: 'center', minWidth: 90,
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.urgent ? s.color : '#f9fafb', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Role scope notice */}
        <div style={{
          background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 12, color: '#9ca3af',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>🛡️</span>
          <span>
            <strong style={{ color: '#60a5fa' }}>Moderator scope:</strong> You can review and action reports and disputes.
            For user bans that need review, user deletion, VIP promotions, or badge changes — escalate to an Owner.
          </span>
        </div>

        {/* ─── Tabs ─── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1f2937', marginBottom: 24, overflowX: 'auto', gap: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              color: tab === t.id ? '#60a5fa' : '#6b7280',
              borderBottom: tab === t.id ? '2px solid #60a5fa' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ─── OVERVIEW TAB ─── */}
        {tab === 'overview' && (
          <ModOverview stats={stats} onTabSwitch={setTab} profile={profile} />
        )}

        {/* ─── REPORTS TAB ─── */}
        {tab === 'reports' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['pending', 'reviewed', 'resolved', 'dismissed', 'all'].map(s => (
                  <button key={s} onClick={() => { setReportFilter(s); loadReports(s) }}
                    style={S.pill('#60a5fa', reportFilter === s)}>{s}</button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: '#4b5563' }}>{reports.length} reports</span>
            </div>
            {reportsLoading
              ? <Loader />
              : reports.length === 0
              ? <EmptyState icon="✅" message={`No ${reportFilter} reports`} />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reports.map(r => (
                    <ModReportCard key={r.id} report={r} modUser={user} onUpdate={updateReport} onBanUser={warnBanUser} />
                  ))}
                </div>
            }
          </div>
        )}

        {/* ─── DISPUTES TAB ─── */}
        {tab === 'disputes' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['open', 'under_review', 'resolved', 'dismissed', 'all'].map(s => (
                  <button key={s} onClick={() => { setDisputeFilter(s); loadDisputes(s) }}
                    style={S.pill('#f97316', disputeFilter === s)}>{s.replace('_', ' ')}</button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: '#4b5563' }}>{disputes.length} disputes</span>
            </div>
            {disputesLoading
              ? <Loader />
              : disputes.length === 0
              ? <EmptyState icon="⚖️" message={`No ${disputeFilter.replace('_', ' ')} disputes`} />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {disputes.map(d => (
                    <ModDisputeCard key={d.id} dispute={d} modUser={user} onUpdate={updateDispute} />
                  ))}
                </div>
            }
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; }
        input, textarea, select { background: #0d0d14; border: 1px solid #2d2d3f; border-radius: 8px; padding: 9px 12px; color: #f9fafb; font-size: 13px; outline: none; }
        input:focus, textarea:focus { border-color: rgba(96,165,250,0.4); }
        textarea { resize: vertical; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d2d3f; border-radius: 2px; }
      `}</style>
    </div>
  )
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────

function ModOverview({ stats, onTabSwitch, profile }) {
  const profileBadges = profile?.badges?.length ? profile.badges : profile?.badge ? [profile.badge] : []
  const isOwner = profileBadges.includes('Owner')

  const actionItems = [
    {
      icon: '🚩',
      title: 'Pending Reports',
      description: 'Review flagged users and listings reported by the community',
      count: stats.pendingReports || 0,
      countColor: '#f59e0b',
      urgent: stats.pendingReports > 0,
      cta: 'Review Reports',
      tab: 'reports',
    },
    {
      icon: '⚖️',
      title: 'Open Disputes',
      description: 'Mediate trade disputes between buyers and sellers',
      count: stats.openDisputes || 0,
      countColor: '#f97316',
      urgent: stats.openDisputes > 0,
      cta: 'Handle Disputes',
      tab: 'disputes',
    },
  ]

  return (
    <div>
      {/* Action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 28 }}>
        {actionItems.map(item => (
          <div key={item.title} style={{
            background: item.urgent ? `${item.countColor}08` : '#111118',
            border: `1px solid ${item.urgent ? item.countColor + '40' : '#1f2937'}`,
            borderRadius: 14, padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 28 }}>{item.icon}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: item.urgent ? item.countColor : '#f9fafb', lineHeight: 1 }}>
                {item.count}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f9fafb', marginBottom: 6 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>{item.description}</div>
            <button onClick={() => onTabSwitch(item.tab)} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: item.urgent ? `${item.countColor}20` : '#1f2937',
              color: item.urgent ? item.countColor : '#9ca3af',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              boxShadow: item.urgent ? `0 0 0 1px ${item.countColor}40` : 'none',
            }}>{item.cta} →</button>
          </div>
        ))}
      </div>

      {/* Moderator guidelines */}
      <div style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 14, padding: '20px 22px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#9ca3af', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          🛡️ Moderator Guidelines
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { title: 'Reports — What to do', icon: '🚩', color: '#f59e0b', items: [
              'Mark as "reviewed" when you\'ve read and assessed it',
              'Resolve when clear violation confirmed + action taken',
              'Dismiss when report is unfounded or duplicate',
              'Use Notes to document your reasoning',
            ]},
            { title: 'Disputes — Mediation', icon: '⚖️', color: '#f97316', items: [
              'Move to "under review" when you start investigating',
              'Review chat logs and trade history before ruling',
              'Write a resolution summary visible to both parties',
              'Escalate to Owner for complex or high-value cases',
            ]},
            { title: 'Banning — Use with care', icon: '🚫', color: '#ef4444', items: [
              'You can issue temp bans from report cards below',
              'Always include a clear, specific ban reason',
              'Owners can reverse any mod ban if appealed',
              'For permanent bans, escalate to Owner',
            ]},
            { title: 'Escalation', icon: '📣', color: '#60a5fa', items: [
              'Escalate if a request involves account deletion or irreversible actions',
              'Route all VIP, badge, or permission changes to Owner review',
              'Flag unclear, high-risk, or policy-edge cases for Owner input',
              'Log context, actions taken, and reasoning before escalation',
            ]},
          ].map(section => (
            <div key={section.title}>
              <div style={{ fontSize: 11, fontWeight: 800, color: section.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                {section.icon} {section.title}
              </div>
              {section.items.map((item, i) => (
                <div key={i} style={{ fontSize: 11, color: '#6b7280', marginBottom: 5, paddingLeft: 12, position: 'relative', lineHeight: 1.5 }}>
                  <span style={{ position: 'absolute', left: 0, color: section.color }}>·</span>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MOD REPORT CARD ──────────────────────────────────────────────────────────

function ModReportCard({ report, modUser, onUpdate, onBanUser }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(report.admin_notes || '')
  const [chatLogs, setChatLogs] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const loadChatLogs = async () => {
    if (chatLogs) { setChatOpen(o => !o); return }
    setChatLoading(true)
    try {
      const { data } = await supabase
        .from('messages')
        .select(`*, sender:profiles!messages_sender_id_fkey(id, username)`)
        .or(`and(sender_id.eq.${report.reporter_id},receiver_id.eq.${report.reported_id}),and(sender_id.eq.${report.reported_id},receiver_id.eq.${report.reporter_id})`)
        .order('created_at', { ascending: true }).limit(150)
      setChatLogs(data || [])
      setChatOpen(true)
    } catch (err) {
      alert('Failed to load logs: ' + err.message)
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
          {/* Status + reason + time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={S.badge(STATUS_COLORS[report.status] || '#6b7280')}>{report.status}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{REASON_LABELS[report.reason] || report.reason}</span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>{timeAgo(report.created_at)}</span>
          </div>

          {/* Reporter / Reported */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6, fontSize: 12 }}>
            <span>
              <span style={{ color: '#6b7280' }}>Reporter: </span>
              <Link href={`/profile/${report.reporter?.username}`} style={{ color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>{report.reporter?.username || 'Unknown'}</Link>
            </span>
            <span>
              <span style={{ color: '#6b7280' }}>Reported: </span>
              <Link href={`/profile/${report.reported_user?.username}`} style={{ color: '#f87171', textDecoration: 'none', fontWeight: 600 }}>{report.reported_user?.username || 'Unknown'}</Link>
              {report.reported_user?.banned && <span style={{ ...S.badge('#ef4444'), marginLeft: 6 }}>BANNED</span>}
            </span>
            {report.listings && (
              <span>
                <span style={{ color: '#6b7280' }}>Listing: </span>
                <Link href={`/listing/${report.listing_id}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>{report.listings.title}</Link>
              </span>
            )}
          </div>

          {/* Details */}
          {report.details && (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9ca3af', lineHeight: 1.6, background: '#0d0d14', padding: '8px 12px', borderRadius: 6, border: '1px solid #1f2937' }}>
              {report.details}
            </p>
          )}

          {/* Existing notes (collapsed) */}
          {report.admin_notes && !notesOpen && (
            <p style={{ margin: '0 0 6px', fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Notes: {report.admin_notes}</p>
          )}

          {/* Notes textarea */}
          {notesOpen && (
            <textarea rows={2} placeholder="Moderator notes (internal)..." value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ marginTop: 8, width: '100%', fontSize: 12 }} />
          )}

          {/* Chat logs */}
          {chatOpen && chatLogs !== null && (
            <ChatPreview chatLogs={chatLogs} reportedUsername={report.reported_user?.username} />
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button onClick={loadChatLogs} disabled={chatLoading} style={S.actionBtn('#60a5fa')}>
            {chatLoading ? '...' : chatOpen ? '💬 Hide' : '💬 Logs'}
          </button>
          <button onClick={() => setNotesOpen(o => !o)} style={S.actionBtn('#9ca3af')}>📝 Notes</button>
          {report.status === 'pending' && (
            <button onClick={() => onUpdate(report.id, 'reviewed', notes)} style={S.actionBtn('#60a5fa')}>👁 Review</button>
          )}
          {report.status !== 'resolved' && (
            <button onClick={() => onUpdate(report.id, 'resolved', notes)} style={S.actionBtn('#4ade80')}>✓ Resolve</button>
          )}
          {report.status !== 'dismissed' && (
            <button onClick={() => onUpdate(report.id, 'dismissed', notes)} style={S.actionBtn('#6b7280')}>✕ Dismiss</button>
          )}
          {/* Mod-level ban (reversible by Owner) */}
          {report.reported_user && !report.reported_user.banned && (
            <button onClick={() => onBanUser(report.reported_id, report.reported_user.username)} style={S.actionBtn('#f87171')}>
              🚫 Warn Ban
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MOD DISPUTE CARD ─────────────────────────────────────────────────────────

function ModDisputeCard({ dispute, modUser, onUpdate }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(dispute.admin_notes || '')
  const [resolution, setResolution] = useState(dispute.resolution || '')
  const [chatLogs, setChatLogs] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const statusColor = DISPUTE_STATUS_COLORS[dispute.status] || '#6b7280'

  const loadChatLogs = async () => {
    if (chatLogs) { setChatOpen(o => !o); return }
    setChatLoading(true)
    try {
      const { data } = await supabase
        .from('messages')
        .select(`*, sender:profiles!messages_sender_id_fkey(id, username)`)
        .or(`and(sender_id.eq.${dispute.opened_by},receiver_id.eq.${dispute.against_user_id}),and(sender_id.eq.${dispute.against_user_id},receiver_id.eq.${dispute.opened_by})`)
        .order('created_at', { ascending: true }).limit(150)
      setChatLogs(data || [])
      setChatOpen(true)
    } catch (err) {
      alert('Failed to load logs: ' + err.message)
    } finally {
      setChatLoading(false)
    }
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
            <span>
              <span style={{ color: '#6b7280' }}>Opened by: </span>
              <Link href={`/profile/${dispute.opener?.username}`} style={{ color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>{dispute.opener?.username || 'Unknown'}</Link>
            </span>
            <span>
              <span style={{ color: '#6b7280' }}>Against: </span>
              <Link href={`/profile/${dispute.against?.username}`} style={{ color: '#f87171', textDecoration: 'none', fontWeight: 600 }}>{dispute.against?.username || 'Unknown'}</Link>
            </span>
            {dispute.listings && (
              <span>
                <span style={{ color: '#6b7280' }}>Listing: </span>
                <Link href={`/listing/${dispute.listing_id}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>{dispute.listings.title}</Link>
              </span>
            )}
          </div>

          {dispute.details && (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9ca3af', lineHeight: 1.6, background: '#0d0d14', padding: '8px 12px', borderRadius: 6, border: '1px solid #1f2937' }}>
              {dispute.details}
            </p>
          )}

          {notesOpen && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea rows={2} placeholder="Internal notes (not visible to users)..." value={notes}
                onChange={e => setNotes(e.target.value)} style={{ fontSize: 12 }} />
              <input type="text" placeholder="Resolution summary (shown to both parties)..." value={resolution}
                onChange={e => setResolution(e.target.value)} style={{ fontSize: 12 }} />
            </div>
          )}

          {dispute.resolution && !notesOpen && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#4ade80', fontStyle: 'italic' }}>Resolution: {dispute.resolution}</p>
          )}

          {chatOpen && chatLogs !== null && (
            <ChatPreview chatLogs={chatLogs} reportedUsername={dispute.against?.username} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button onClick={loadChatLogs} disabled={chatLoading} style={S.actionBtn('#60a5fa')}>
            {chatLoading ? '...' : chatOpen ? '💬 Hide' : '💬 Logs'}
          </button>
          <button onClick={() => setNotesOpen(o => !o)} style={S.actionBtn('#9ca3af')}>📝 Notes</button>
          {dispute.status === 'open' && (
            <button onClick={() => onUpdate(dispute.id, 'under_review', resolution, notes)} style={S.actionBtn('#60a5fa')}>
              👁 Take Review
            </button>
          )}
          {dispute.status !== 'resolved' && (
            <button onClick={() => onUpdate(dispute.id, 'resolved', resolution, notes)} style={S.actionBtn('#4ade80')}>
              ✓ Resolve
            </button>
          )}
          {dispute.status !== 'dismissed' && (
            <button onClick={() => onUpdate(dispute.id, 'dismissed', resolution, notes)} style={S.actionBtn('#6b7280')}>
              ✕ Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CHAT PREVIEW ─────────────────────────────────────────────────────────────

function ChatPreview({ chatLogs, reportedUsername }) {
  return (
    <div style={{ marginTop: 12, background: '#0d0d14', border: '1px solid #2d2d3f', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1f2937', fontSize: 11, fontWeight: 700, color: '#6b7280' }}>
        💬 Message History ({chatLogs.length} messages)
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: 12 }}>
        {chatLogs.length === 0
          ? <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No messages between these users</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {chatLogs.map((m, i) => (
                <div key={m.id || i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap', marginTop: 2, minWidth: 55 }}>
                    {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: m.sender?.username === reportedUsername ? '#f87171' : '#4ade80', minWidth: 70, whiteSpace: 'nowrap' }}>
                    {m.sender?.username || '?'}:
                  </span>
                  <span style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5, wordBreak: 'break-word' }}>{m.content}</span>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', color: '#6b7280', fontSize: 13 }}>
      <div style={{ width: 16, height: 16, border: '2px solid #1f2937', borderTopColor: '#60a5fa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
