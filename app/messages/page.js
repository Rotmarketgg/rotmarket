'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { getSessionUser, getConversations, getMessages, sendMessage, getProfile, supabase } from '@/lib/supabase'
import { timeAgo, getInitial, checkRateLimit, withTimeout } from '@/lib/utils'
import { isClean } from '@/lib/profanity'

function MessagesInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeConvo, setActiveConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [inboxTab, setInboxTab] = useState('active')
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeForm, setDisputeForm] = useState({ reason: '', details: '' })
  const [disputeLoading, setDisputeLoading] = useState(false)
  const [disputeSuccess, setDisputeSuccess] = useState(false)
  const [mobileView, setMobileView] = useState('list') // 'list' | 'chat'

  // Hoisted to useCallback so the visibilitychange handler below can call it.
  // Previously init() was defined inside the first useEffect, making it
  // unreachable from the second useEffect — causing a ReferenceError crash.
  const init = useCallback(async () => {
    try {
      const u = await getSessionUser()
      if (!u) { router.push('/auth/login'); return }
      setUser(u)
      const [p, convos] = await withTimeout(Promise.all([
        getProfile(u.id),
        getConversations(u.id),
      ]))
      setProfile(p)
      setConversations(convos || [])
      const targetUsername = searchParams.get('user')
      if (targetUsername && convos?.length > 0) {
        const match = convos.find(c => {
          const other = c.sender_id === u.id ? c.receiver : c.sender
          return other?.username === targetUsername
        })
        if (match) setActiveConvo(match)
      }
      setAuthLoading(false)
      setLoading(false)
    } catch (err) {
      console.error('Messages load error:', err)
      setAuthLoading(false)
      setLoading(false)
    }
  }, [router, searchParams])

  useEffect(() => {
    init()
  }, [init])

  // loadMessages must be defined BEFORE the useEffect below that lists it as a dependency.
  // Having it after caused a use-before-define crash that Suspense caught as "Something went wrong".
  const loadMessages = useCallback(async () => {
    if (!activeConvo || !user) return
    const otherId = activeConvo.sender_id === user.id ? activeConvo.receiver_id : activeConvo.sender_id
    const msgs = await getMessages(user.id, otherId, activeConvo.listing_id)
    setMessages(msgs || [])
    scrollToBottom()
    // Update unread counts in sidebar without refetching entire conversation list
    setConversations(prev => prev.map(c =>
      c.listing_id === activeConvo.listing_id ? { ...c, read: true } : c
    ))
  }, [activeConvo, user])

  // Refetch conversations when tab becomes visible again.
  // init is now a stable useCallback ref so this handler can safely reach it.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') init() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [init])

  useEffect(() => {
    if (!activeConvo || !user) return
    loadMessages()
    const channel = supabase
      .channel(`msg-${activeConvo.listing_id}-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `listing_id=eq.${activeConvo.listing_id}`,
      }, async (payload) => {
        // Raw postgres_changes payload has no joined profile data — fetch the
        // full row with sender profile so avatars and usernames render correctly
        const { data: fullMsg } = await supabase
          .from('messages')
          .select('*, sender:profiles!messages_sender_id_fkey (id, username, avatar_url)')
          .eq('id', payload.new.id)
          .single()

        const msg = fullMsg || payload.new // fallback to raw if fetch fails
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        // Update sidebar: refresh latest message preview + timestamp
        setConversations(prev => prev.map(c =>
          c.listing_id === activeConvo.listing_id
            ? { ...c, content: msg.content, created_at: msg.created_at }
            : c
        ))
        scrollToBottom()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeConvo, loadMessages])

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }

  const handleSend = async () => {
    if (!newMsg.trim() || !activeConvo || !user || sending) return
    if (!isClean(newMsg)) { alert('Your message contains inappropriate language.'); return }
    setSending(true)
    const otherId = activeConvo.sender_id === user.id ? activeConvo.receiver_id : activeConvo.sender_id
    try {
      const msg = await sendMessage({
        senderId: user.id, receiverId: otherId,
        listingId: activeConvo.listing_id, content: newMsg.trim(),
      })
      setMessages(prev => [...prev, msg])
      setNewMsg('')
      scrollToBottom()
    } catch { alert('Failed to send message.') }
    finally { setSending(false) }
  }

  const selectConvo = (c) => {
    setActiveConvo(c)
    setDisputeOpen(false)
    setDisputeSuccess(false)
    setMobileView('chat')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleArchive = async (convo) => {
    const otherId = convo.sender_id === user.id ? convo.receiver_id : convo.sender_id
    const isArchived = convo.archived_by?.includes(user.id)
    await supabase.rpc(isArchived ? 'unarchive_conversation' : 'archive_conversation', {
      p_listing_id: convo.listing_id, p_other_user_id: otherId
    })
    const updated = await getConversations(user.id)
    setConversations(updated || [])
    if (!isArchived) { setActiveConvo(null); setMobileView('list') }
  }

  const handleOpenDispute = async () => {
    if (!disputeForm.reason) { alert('Please select a reason.'); return }
    const rl = checkRateLimit('dispute')
    if (rl) { alert(rl); return }
    setDisputeLoading(true)
    try {
      const otherId = activeConvo.sender_id === user.id ? activeConvo.receiver_id : activeConvo.sender_id
      const { error } = await supabase.from('disputes').insert({
        listing_id: activeConvo.listing_id,
        opened_by: user.id, against_user_id: otherId,
        reason: disputeForm.reason, details: disputeForm.details,
        trade_request_id: null,
      })
      if (error) throw error
      setDisputeSuccess(true)
      setDisputeOpen(false)
      setDisputeForm({ reason: '', details: '' })
    } catch (err) { alert('Failed to open dispute: ' + err.message) }
    finally { setDisputeLoading(false) }
  }



  const getOtherUser = (convo) => {
    if (!convo || !user) return null
    return convo.sender_id === user.id ? convo.receiver : convo.sender
  }
  const otherUser = getOtherUser(activeConvo)

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

  const filteredConvos = conversations.filter(c =>
    inboxTab === 'archived' ? c.archived_by?.includes(user?.id) : !c.archived_by?.includes(user?.id)
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: '20px 16px 32px', display: 'flex', flexDirection: 'column' }}>

        <div style={{
          display: 'flex', gap: 0,
          background: '#111118', border: '1px solid #1f2937',
          borderRadius: 16, overflow: 'hidden',
          height: 'calc(100vh - 160px)', minHeight: 560,
          position: 'relative',
        }}>

          {/* ── SIDEBAR ──────────────────────────────── */}
          <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #1f2937', display: 'flex', flexDirection: 'column', background: '#0a0a0f', flex: 'none' }}
            className={`${mobileView === 'chat' ? 'hide-mobile' : ''} full-mobile`}>

            {/* Inbox / Archived tab bar */}
            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #1f2937' }}>
              <div style={{ display: 'flex', gap: 3, background: '#111118', borderRadius: 8, padding: 3 }}>
                {[
                  { id: 'active', label: '💬 Inbox', count: conversations.filter(c => !c.archived_by?.includes(user?.id)).length },
                  { id: 'archived', label: '📦 Archived', count: conversations.filter(c => c.archived_by?.includes(user?.id)).length },
                ].map(t => (
                  <button key={t.id} onClick={() => setInboxTab(t.id)} style={{
                    flex: 1, padding: '7px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: inboxTab === t.id ? 'rgba(74,222,128,0.12)' : 'transparent',
                    color: inboxTab === t.id ? '#4ade80' : '#6b7280',
                    fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}>
                    {t.label}
                    {t.count > 0 && (
                      <span style={{ fontSize: 10, background: inboxTab === t.id ? 'rgba(74,222,128,0.2)' : '#1f2937', color: inboxTab === t.id ? '#4ade80' : '#4b5563', borderRadius: 10, padding: '1px 5px', fontWeight: 800 }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 16 }}>
                  {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 8, marginBottom: 8 }} />)}
                </div>
              ) : filteredConvos.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>{inboxTab === 'archived' ? '📦' : '💬'}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                    {inboxTab === 'archived' ? 'No archived conversations' : 'No conversations yet'}
                  </div>
                  {inboxTab === 'active' && (
                    <Link href="/" style={{ fontSize: 12, color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>Browse listings →</Link>
                  )}
                </div>
              ) : filteredConvos.map(c => {
                const other = getOtherUser(c)
                const isActive = activeConvo?.id === c.id
                const isUnread = !c.read && c.receiver_id === user?.id

                return (
                  <div key={c.id} onClick={() => selectConvo(c)} style={{
                    padding: '12px 14px', cursor: 'pointer',
                    background: isActive ? 'rgba(74,222,128,0.06)' : 'transparent',
                    borderLeft: `3px solid ${isActive ? '#4ade80' : 'transparent'}`,
                    borderBottom: '1px solid #111118', transition: 'all 0.1s',
                  }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 42, height: 42, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                        background: other?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 900, color: '#0a0a0f', position: 'relative',
                      }}>
                        {other?.avatar_url
                          ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : getInitial(other?.username || '?')
                        }
                        {isUnread && (
                          <div style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, background: '#4ade80', borderRadius: '50%', border: '2px solid #0a0a0f' }} />
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: isUnread ? 800 : 600, color: isUnread ? '#f9fafb' : '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                            {other?.username || 'Unknown'}
                          </span>
                          <span style={{ fontSize: 10, color: '#4b5563', flexShrink: 0 }}>{timeAgo(c.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 1 }}>
                          {c.listings?.title || 'Deleted listing'}
                        </div>
                        <div style={{ fontSize: 11, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.content}
                        </div>
                      </div>
                    </div>

                    {/* Archive/Unarchive action — always visible, not on hover */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        onClick={e => { e.stopPropagation(); handleArchive(c) }}
                        style={{
                          background: 'none', border: '1px solid #1f2937',
                          borderRadius: 4, padding: '2px 8px', fontSize: 10,
                          color: '#4b5563', cursor: 'pointer', fontWeight: 600,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#4ade80'; e.currentTarget.style.color = '#4ade80' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f2937'; e.currentTarget.style.color = '#4b5563' }}
                      >
                        {c.archived_by?.includes(user?.id) ? '↩ Unarchive' : '📦 Archive'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── MAIN CHAT ──────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
            className={mobileView === 'list' ? 'hide-mobile' : ''}>
            {!activeConvo ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 52, opacity: 0.2 }}>💬</div>
                <div style={{ fontSize: 15, color: '#4b5563', fontWeight: 600 }}>Select a conversation</div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div style={{ padding: '12px 18px', borderBottom: '1px solid #1f2937', background: '#0d0d14', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {/* Mobile back button */}
                  <button className="hide-desktop" onClick={() => setMobileView('list')} style={{ background: 'none', border: '1px solid #2d2d3f', borderRadius: 6, color: '#9ca3af', padding: '5px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>← Back</button>
                  {otherUser?.username ? (
                    <Link href={`/profile/${otherUser.username}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                        background: otherUser?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 900, color: '#0a0a0f',
                      }}>
                        {otherUser?.avatar_url
                          ? <img src={otherUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : getInitial(otherUser?.username || '?')
                        }
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb' }}>{otherUser.username}</div>
                        {activeConvo.listings?.title && (
                          <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Re: {activeConvo.listings.title}
                          </div>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#6b7280' }}>Unknown User</div>
                  )}

                  {/* Header actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {activeConvo.listing_id && activeConvo.listings && (
                      <Link href={`/listing/${activeConvo.listing_id}`} style={{
                        fontSize: 12, fontWeight: 600, color: '#4ade80',
                        textDecoration: 'none', padding: '6px 12px',
                        background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
                        borderRadius: 6, whiteSpace: 'nowrap',
                      }}>View Listing →</Link>
                    )}
                    {/* Dispute — only available on active (non-archived) conversations */}
                    {!activeConvo.archived_by?.includes(user?.id) && (
                      <button onClick={() => setDisputeOpen(d => !d)} style={{
                        padding: '6px 10px', borderRadius: 6,
                        border: `1px solid ${disputeOpen ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.2)'}`,
                        background: disputeOpen ? 'rgba(239,68,68,0.12)' : 'transparent',
                        color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>⚠️ Dispute</button>
                    )}
                  </div>
                </div>

                {/* Dispute success banner */}
                {disputeSuccess && (
                  <div style={{ padding: '10px 18px', background: 'rgba(74,222,128,0.08)', borderBottom: '1px solid rgba(74,222,128,0.2)', fontSize: 13, color: '#4ade80', fontWeight: 600 }}>
                    ✓ Dispute submitted. A moderator will review the conversation and activity.
                  </div>
                )}

                {/* Dispute form */}
                {disputeOpen && (
                  <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.04)', borderBottom: '1px solid rgba(239,68,68,0.12)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 10 }}>⚠️ Open a Dispute</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {[
                        { id: 'item_not_received', label: "Didn't receive item" },
                        { id: 'item_not_as_described', label: 'Not as described' },
                        { id: 'payment_not_received', label: "Didn't receive payment" },
                        { id: 'fraud', label: 'Fraud / Scam' },
                        { id: 'other', label: 'Other' },
                      ].map(r => (
                        <button key={r.id} onClick={() => setDisputeForm(f => ({ ...f, reason: r.id }))} style={{
                          padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          background: disputeForm.reason === r.id ? 'rgba(239,68,68,0.2)' : '#1f2937',
                          color: disputeForm.reason === r.id ? '#f87171' : '#9ca3af',
                          boxShadow: disputeForm.reason === r.id ? '0 0 0 1px rgba(239,68,68,0.4)' : 'none',
                        }}>{r.label}</button>
                      ))}
                    </div>
                    <textarea rows={2} placeholder="Describe the issue in detail (screenshots, dates, what happened)..."
                      value={disputeForm.details}
                      onChange={e => setDisputeForm(f => ({ ...f, details: e.target.value }))}
                      style={{ marginBottom: 8, resize: 'vertical', fontSize: 12 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleOpenDispute} disabled={disputeLoading || !disputeForm.reason} style={{
                        padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: !disputeForm.reason ? '#1f2937' : '#dc2626',
                        color: !disputeForm.reason ? '#6b7280' : '#fff',
                        fontSize: 12, fontWeight: 700,
                      }}>{disputeLoading ? 'Submitting...' : 'Submit Dispute'}</button>
                      <button onClick={() => { setDisputeOpen(false); setDisputeForm({ reason: '', details: '' }) }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #2d2d3f', background: 'transparent', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#4b5563', fontSize: 13, marginTop: 48 }}>
                      No messages yet — say hello!
                    </div>
                  )}

                  {Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 10px' }}>
                        <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
                        <span style={{ fontSize: 11, color: '#4b5563', fontWeight: 600, whiteSpace: 'nowrap' }}>{date}</span>
                        <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
                      </div>
                      {msgs.map((m, i) => {
                        const isMine = m.sender_id === user?.id
                        const prevMsg = msgs[i - 1]
                        const nextMsg = msgs[i + 1]
                        const isFirst = !prevMsg || prevMsg.sender_id !== m.sender_id
                        const isLast = !nextMsg || nextMsg.sender_id !== m.sender_id

                        return (
                          <div key={m.id || i} style={{
                            display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row',
                            alignItems: 'flex-end', gap: 8,
                            marginBottom: isLast ? 10 : 2,
                          }}>
                            {/* Avatar — only for others, on last msg in chain */}
                            {!isMine && (
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                                background: otherUser?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 900, color: '#0a0a0f',
                                visibility: isLast ? 'visible' : 'hidden',
                              }}>
                                {otherUser?.avatar_url
                                  ? <img src={otherUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : getInitial(otherUser?.username || '?')
                                }
                              </div>
                            )}

                            <div style={{ maxWidth: '68%' }}>
                              {isFirst && !isMine && (
                                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, marginLeft: 4, fontWeight: 600 }}>
                                  {otherUser?.username}
                                </div>
                              )}
                              <div style={{
                                padding: '9px 13px',
                                background: isMine ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#1a1a2e',
                                color: isMine ? '#fff' : '#e5e7eb',
                                borderRadius: isMine
                                  ? `14px 14px ${isLast ? '4px' : '14px'} 14px`
                                  : `14px 14px 14px ${isLast ? '4px' : '14px'}`,
                                fontSize: 13, lineHeight: 1.5,
                                boxShadow: isMine ? '0 2px 8px rgba(22,163,74,0.3)' : 'none',
                                wordBreak: 'break-word',
                              }}>
                                {m.content}
                              </div>
                              {isLast && (
                                <div style={{ fontSize: 10, color: '#4b5563', marginTop: 3, textAlign: isMine ? 'right' : 'left', marginLeft: 4, marginRight: 4 }}>
                                  {timeAgo(m.created_at)}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid #1f2937', background: '#0d0d14', display: 'flex', gap: 10 }}>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Type a message..."
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    style={{ flex: 1, background: '#111118', fontSize: 14 }}
                  />
                  <button onClick={handleSend} disabled={!newMsg.trim() || sending} className="btn-primary" style={{ padding: '10px 20px', fontSize: 13, flexShrink: 0 }}>
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0f' }} />}>
      <MessagesInner />
    </Suspense>
  )
}
