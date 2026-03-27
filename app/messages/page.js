'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getSessionUser, getConversations, getMessagesPaginated, sendMessage, getUnreadCount, supabase } from '@/lib/supabase'
import { timeAgo, getInitial, checkRateLimit, withTimeout } from '@/lib/utils'
import { isClean } from '@/lib/profanity'

const QUICK_REPLIES = [
  'Still available?',
  'I can trade now if you are online.',
  'Can you share more details/screenshots?',
  'I can pay today. Ready when you are.',
]

function MessagesInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const [user, setUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeConvo, setActiveConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [inboxTab, setInboxTab] = useState('all')
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeForm, setDisputeForm] = useState({ reason: '', details: '' })
  const [disputeLoading, setDisputeLoading] = useState(false)
  const [disputeSuccess, setDisputeSuccess] = useState(false)
  const [disputeError, setDisputeError] = useState('')
  const [mobileView, setMobileView] = useState('list') // 'list' | 'chat'
  const [msgHasMore, setMsgHasMore] = useState(false)
  const [msgCursor, setMsgCursor] = useState(null)
  const [msgLoadingMore, setMsgLoadingMore] = useState(false)
  const [disputeKeys, setDisputeKeys] = useState([])
  const [offerStateByKey, setOfferStateByKey] = useState({})
  const [offerActionLoading, setOfferActionLoading] = useState(false)
  const [pinnedKeys, setPinnedKeys] = useState([])
  const [mutedKeys, setMutedKeys] = useState([])
  const [manualUnreadKeys, setManualUnreadKeys] = useState([])

  const getConvoOtherId = useCallback((convo, currentUserId) => {
    if (!convo || !currentUserId) return null
    return convo.sender_id === currentUserId ? convo.receiver_id : convo.sender_id
  }, [])

  const getConvoKey = useCallback((convo, currentUserId) => {
    const otherId = getConvoOtherId(convo, currentUserId)
    if (!convo?.listing_id || !otherId) return null
    return `${convo.listing_id}-${otherId}`
  }, [getConvoOtherId])

  const isSameConversation = useCallback((a, b, currentUserId) => {
    if (!a || !b || !currentUserId) return false
    return a.listing_id === b.listing_id && getConvoOtherId(a, currentUserId) === getConvoOtherId(b, currentUserId)
  }, [getConvoOtherId])

  const loadLocalPrefs = useCallback((userId) => {
    if (typeof window === 'undefined' || !userId) return
    try {
      const raw = window.localStorage.getItem(`rotmarket:inbox:prefs:${userId}`)
      if (!raw) return
      const parsed = JSON.parse(raw)
      setPinnedKeys(Array.isArray(parsed?.pinned) ? parsed.pinned.slice(0, 3) : [])
      setMutedKeys(Array.isArray(parsed?.muted) ? parsed.muted : [])
      setManualUnreadKeys(Array.isArray(parsed?.manualUnread) ? parsed.manualUnread : [])
    } catch (_) {}
  }, [])

  const persistLocalPrefs = useCallback((userId, nextPrefs) => {
    if (typeof window === 'undefined' || !userId) return
    try {
      window.localStorage.setItem(`rotmarket:inbox:prefs:${userId}`, JSON.stringify(nextPrefs))
    } catch (_) {}
  }, [])

  const loadDisputes = useCallback(async (userId) => {
    if (!userId) return
    const { data } = await supabase
      .from('disputes')
      .select('listing_id, opened_by, against_user_id, status')
      .or(`opened_by.eq.${userId},against_user_id.eq.${userId}`)
      .in('status', ['open', 'under_review'])
      .limit(200)

    const keys = []
    for (const d of data || []) {
      const otherId = d.opened_by === userId ? d.against_user_id : d.opened_by
      if (d.listing_id && otherId) keys.push(`${d.listing_id}-${otherId}`)
    }
    setDisputeKeys(keys)
  }, [])

  const loadOfferStates = useCallback(async (userId) => {
    if (!userId) return
    const { data } = await supabase
      .from('trade_requests')
      .select('id, listing_id, buyer_id, seller_id, status, created_at, offer_price')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(300)

    const next = {}
    for (const offer of data || []) {
      const otherId = offer.buyer_id === userId ? offer.seller_id : offer.buyer_id
      const key = offer.listing_id && otherId ? `${offer.listing_id}-${otherId}` : null
      if (!key || next[key]) continue
      next[key] = {
        id: offer.id,
        status: offer.status,
        role: offer.seller_id === userId ? 'seller' : 'buyer',
        offerPrice: offer.offer_price,
      }
    }
    setOfferStateByKey(next)
  }, [])

  // Hoisted to useCallback so the visibilitychange handler below can call it.
  // Previously init() was defined inside the first useEffect, making it
  // unreachable from the second useEffect — causing a ReferenceError crash.
  const init = useCallback(async () => {
    try {
      const u = await getSessionUser()
      if (!u) { router.push('/auth/login'); return }
      setUser(u)
      loadLocalPrefs(u.id)
      const convos = await withTimeout(getConversations(u.id))
      setConversations(convos || [])
      await Promise.all([loadDisputes(u.id), loadOfferStates(u.id)])
      const targetUsername = searchParams.get('user')
      if (targetUsername && convos?.length > 0) {
        const match = convos.find(c => {
          const other = c.sender_id === u.id ? c.receiver : c.sender
          return other?.username === targetUsername
        })
        if (match) setActiveConvo(match)
      }
      setLoading(false)
    } catch (err) {
      console.error('Messages load error:', err)
      setLoading(false)
    }
  }, [loadDisputes, loadLocalPrefs, loadOfferStates, router, searchParams])

  useEffect(() => {
    init()
  }, [init])

  // loadMessages must be defined BEFORE the useEffect below that lists it as a dependency.
  // Having it after caused a use-before-define crash that Suspense caught as "Something went wrong".
  const loadMessages = useCallback(async () => {
    if (!activeConvo || !user) return
    const otherId = activeConvo.sender_id === user.id ? activeConvo.receiver_id : activeConvo.sender_id
    const { messages: msgs, hasMore, nextCursor } = await getMessagesPaginated(
      user.id, otherId, activeConvo.listing_id, null, 50
    )
    setMessages(msgs)
    setMsgHasMore(hasMore)
    setMsgCursor(nextCursor)
    scrollToBottom()
    // Update unread counts in sidebar without refetching entire conversation list
    setConversations(prev => prev.map(c =>
      isSameConversation(c, activeConvo, user.id) ? { ...c, read: true } : c
    ))
    const activeKey = getConvoKey(activeConvo, user.id)
    if (activeKey) {
      setManualUnreadKeys(prev => prev.filter(k => k !== activeKey))
    }
    // Refresh navbar unread badge now that messages are marked read
    getUnreadCount(user.id).then(count => {
      window.dispatchEvent(new CustomEvent('rotmarket:unread-updated', { detail: count }))
    })
  }, [activeConvo, getConvoKey, isSameConversation, user])

  const loadEarlierMessages = useCallback(async () => {
    if (!activeConvo || !user || !msgCursor || msgLoadingMore) return
    setMsgLoadingMore(true)
    try {
      const otherId = activeConvo.sender_id === user.id ? activeConvo.receiver_id : activeConvo.sender_id
      const { messages: older, hasMore, nextCursor } = await getMessagesPaginated(
        user.id, otherId, activeConvo.listing_id, msgCursor, 50
      )
      setMessages(prev => [...older, ...prev])
      setMsgHasMore(hasMore)
      setMsgCursor(nextCursor)
    } catch (err) {
      console.error('Load earlier messages error:', err)
    } finally {
      setMsgLoadingMore(false)
    }
  }, [activeConvo, user, msgCursor, msgLoadingMore])

  // Refetch conversations when tab becomes visible again.
  // rotmarket:tab-visible fires after 600ms network-recovery delay (lib/supabase.js).
  // Retries once after 2s if connection is still waking up.
  useEffect(() => {
    const onVisible = async () => {
      try {
        await init()
      } catch {
        setTimeout(() => init(), 2000)
      }
    }
    window.addEventListener('rotmarket:tab-visible', onVisible)
    return () => window.removeEventListener('rotmarket:tab-visible', onVisible)
  }, [init])

  useEffect(() => {
    if (!activeConvo || !user) return
    const otherId = activeConvo.sender_id === user.id ? activeConvo.receiver_id : activeConvo.sender_id
    loadMessages()
    const channel = supabase
      .channel(`msg-${activeConvo.listing_id}-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `listing_id=eq.${activeConvo.listing_id}`,
      }, async (payload) => {
        const incoming = payload.new
        const isSameThread =
          incoming?.listing_id === activeConvo.listing_id &&
          (
            (incoming.sender_id === user.id && incoming.receiver_id === otherId) ||
            (incoming.sender_id === otherId && incoming.receiver_id === user.id)
          )
        if (!isSameThread) return

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
          isSameConversation(c, activeConvo, user.id)
            ? { ...c, content: msg.content, created_at: msg.created_at }
            : c
        ))
        scrollToBottom()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeConvo, isSameConversation, loadMessages, user])

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }

  const handleSend = async () => {
    if (!newMsg.trim() || !activeConvo || !user || sending) return
    if (!isClean(newMsg)) { setSendError('Your message contains inappropriate language.'); return }
    setSendError('')
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
    } catch { setSendError('Failed to send message. Please try again.') }
    finally { setSending(false) }
  }

  const selectConvo = (c) => {
    setActiveConvo(c)
    setDisputeOpen(false)
    setDisputeSuccess(false)
    setMobileView('chat')
    const key = getConvoKey(c, user?.id)
    if (key) setManualUnreadKeys(prev => prev.filter(k => k !== key))
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
    await loadOfferStates(user.id)
    if (!isArchived) { setActiveConvo(null); setMobileView('list') }
  }

  const handleOpenDispute = async () => {
    if (!disputeForm.reason) { setDisputeError('Please select a reason.'); return }
    const rl = checkRateLimit('dispute')
    if (rl) { setDisputeError(rl); return }
    setDisputeError('')
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
      await loadDisputes(user.id)
    } catch (err) { setDisputeError('Failed to open dispute: ' + (err.message || 'Please try again.')) }
    finally { setDisputeLoading(false) }
  }

  useEffect(() => {
    if (!user?.id) return
    persistLocalPrefs(user.id, {
      pinned: pinnedKeys.slice(0, 3),
      muted: mutedKeys,
      manualUnread: manualUnreadKeys,
    })
  }, [manualUnreadKeys, mutedKeys, persistLocalPrefs, pinnedKeys, user?.id])

  const togglePin = (convo) => {
    const key = getConvoKey(convo, user?.id)
    if (!key) return
    setPinnedKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= 3) return prev
      return [key, ...prev]
    })
  }

  const toggleMute = (convo) => {
    const key = getConvoKey(convo, user?.id)
    if (!key) return
    setMutedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const markUnread = (convo, unread = true) => {
    const key = getConvoKey(convo, user?.id)
    if (!key) return
    setManualUnreadKeys(prev => unread ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter(k => k !== key))
  }

  const handleOfferAction = async (action) => {
    if (!activeConvo || !user || !action) return
    const key = getConvoKey(activeConvo, user.id)
    const offer = key ? offerStateByKey[key] : null
    if (!offer) return
    setOfferActionLoading(true)
    try {
      if (action === 'accept' || action === 'decline' || action === 'cancel') {
        const nextStatus = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'cancelled'
        const { error } = await supabase
          .from('trade_requests')
          .update({ status: nextStatus })
          .eq('id', offer.id)
        if (error) throw error
      }
      if (action === 'counter') {
        setNewMsg('Counter-offer: I can do a different price. What works best for you?')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      await loadOfferStates(user.id)
    } catch (err) {
      setSendError('Offer action failed: ' + (err.message || 'Please try again.'))
    } finally {
      setOfferActionLoading(false)
    }
  }



  const getOtherUser = (convo) => {
    if (!convo || !user) return null
    return convo.sender_id === user.id ? convo.receiver : convo.sender
  }
  const otherUser = getOtherUser(activeConvo)
  const activeConvoKey = getConvoKey(activeConvo, user?.id)
  const activeOffer = activeConvoKey ? offerStateByKey[activeConvoKey] : null

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

  const convoMeta = (convo) => {
    const key = getConvoKey(convo, user?.id)
    const archived = !!convo.archived_by?.includes(user?.id)
    const unread = (!!(!convo.read && convo.receiver_id === user?.id) || !!(key && manualUnreadKeys.includes(key))) && !archived
    const pinned = !!(key && pinnedKeys.includes(key))
    const muted = !!(key && mutedKeys.includes(key))
    const hasDispute = !!(key && disputeKeys.includes(key))
    const offer = key ? offerStateByKey[key] : null
    const hasOffer = !!offer
    return { key, archived, unread, pinned, muted, hasDispute, offer, hasOffer }
  }

  const filteredConvos = conversations
    .filter(c => {
      const m = convoMeta(c)
      if (inboxTab === 'archived') return m.archived
      if (inboxTab === 'unread') return m.unread
      if (inboxTab === 'offers') return !m.archived && m.hasOffer
      if (inboxTab === 'disputes') return m.hasDispute
      return !m.archived
    })
    .sort((a, b) => {
      const ma = convoMeta(a)
      const mb = convoMeta(b)
      if (ma.pinned !== mb.pinned) return ma.pinned ? -1 : 1
      if (ma.unread !== mb.unread) return ma.unread ? -1 : 1
      if (ma.hasOffer !== mb.hasOffer) return ma.hasOffer ? -1 : 1
      if (ma.muted !== mb.muted) return ma.muted ? 1 : -1
      return new Date(b.created_at) - new Date(a.created_at)
    })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: '20px 16px 32px', display: 'flex', flexDirection: 'column' }}>

        <div style={{
          display: 'flex', gap: 0,
          background: '#111118', border: '1px solid #1f2937',
          borderRadius: 16, overflow: 'hidden',
          height: 'calc(100vh - 160px)', minHeight: 560,
          position: 'relative',
        }} className="messages-shell">

          {/* ── SIDEBAR ──────────────────────────────── */}
          <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #1f2937', display: 'flex', flexDirection: 'column', background: '#0a0a0f', flex: 'none' }}
            className={`${mobileView === 'chat' ? 'hide-mobile' : ''} full-mobile`}>

            {/* Inbox filters */}
            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #1f2937' }}>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }} className="hide-scrollbar">
                {[
                  { id: 'all', label: 'Inbox', count: conversations.filter(c => !c.archived_by?.includes(user?.id)).length },
                  { id: 'unread', label: 'Unread', count: conversations.filter(c => convoMeta(c).unread).length },
                  { id: 'offers', label: 'Offers', count: conversations.filter(c => convoMeta(c).hasOffer && !convoMeta(c).archived).length },
                  { id: 'disputes', label: 'Disputes', count: conversations.filter(c => convoMeta(c).hasDispute).length },
                  { id: 'archived', label: 'Archived', count: conversations.filter(c => c.archived_by?.includes(user?.id)).length },
                ].map(t => (
                  <button key={t.id} onClick={() => setInboxTab(t.id)} style={{
                    padding: '7px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: inboxTab === t.id ? 'rgba(74,222,128,0.16)' : '#111118',
                    color: inboxTab === t.id ? '#4ade80' : '#6b7280',
                    fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, whiteSpace: 'nowrap',
                    boxShadow: inboxTab === t.id ? '0 0 0 1px rgba(74,222,128,0.35)' : '0 0 0 1px #1f2937',
                  }}>
                    {t.id === 'all' ? '💬' : t.id === 'unread' ? '📨' : t.id === 'offers' ? '💰' : t.id === 'disputes' ? '⚠️' : '📦'} {t.label}
                    {t.count > 0 && (
                      <span style={{ fontSize: 10, background: inboxTab === t.id ? 'rgba(74,222,128,0.25)' : '#1f2937', color: inboxTab === t.id ? '#4ade80' : '#4b5563', borderRadius: 10, padding: '1px 5px', fontWeight: 800 }}>
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
                  <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>
                    {inboxTab === 'archived' ? '📦' : inboxTab === 'unread' ? '📨' : inboxTab === 'offers' ? '💰' : inboxTab === 'disputes' ? '⚠️' : '💬'}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                    {inboxTab === 'archived'
                      ? 'No archived conversations'
                      : inboxTab === 'unread'
                        ? 'No unread conversations'
                        : inboxTab === 'offers'
                          ? 'No active offer threads'
                          : inboxTab === 'disputes'
                            ? 'No disputed threads'
                            : 'No conversations yet'}
                  </div>
                  {inboxTab === 'all' && (
                    <Link href="/browse" style={{ fontSize: 12, color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>Browse listings →</Link>
                  )}
                </div>
              ) : filteredConvos.map(c => {
                const other = getOtherUser(c)
                const isActive = activeConvo?.id === c.id
                const meta = convoMeta(c)
                const isUnread = meta.unread

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
                          ? <Image src={other.avatar_url} alt="" fill sizes="42px" style={{ objectFit: 'cover', pointerEvents: 'none' }} />
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
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                          {meta.pinned && <span style={{ fontSize: 9, fontWeight: 800, color: '#60a5fa', background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, padding: '1px 6px' }}>📌 Pinned</span>}
                          {meta.hasOffer && <span style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '1px 6px' }}>💰 {meta.offer?.status === 'accepted' ? 'Offer Accepted' : 'Offer Pending'}</span>}
                          {meta.hasDispute && <span style={{ fontSize: 9, fontWeight: 800, color: '#f87171', background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '1px 6px' }}>⚠️ Dispute</span>}
                          {meta.muted && <span style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', background: 'rgba(156,163,175,0.08)', border: '1px solid rgba(156,163,175,0.2)', borderRadius: 10, padding: '1px 6px' }}>🔕 Muted</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 1 }}>
                          {c.listings?.title || 'Deleted listing'}
                        </div>
                        <div style={{ fontSize: 11, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.content}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={e => { e.stopPropagation(); togglePin(c) }}
                        style={{
                          background: 'none', border: '1px solid #1f2937',
                          borderRadius: 4, padding: '2px 8px', fontSize: 10,
                          color: meta.pinned ? '#60a5fa' : '#4b5563', cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        {meta.pinned ? '📌 Unpin' : '📌 Pin'}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); toggleMute(c) }}
                        style={{
                          background: 'none', border: '1px solid #1f2937',
                          borderRadius: 4, padding: '2px 8px', fontSize: 10,
                          color: meta.muted ? '#9ca3af' : '#4b5563', cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        {meta.muted ? '🔔 Unmute' : '🔕 Mute'}
                      </button>
                      {!meta.archived && (
                        <button
                          onClick={e => { e.stopPropagation(); markUnread(c, !meta.unread) }}
                          style={{
                            background: 'none', border: '1px solid #1f2937',
                            borderRadius: 4, padding: '2px 8px', fontSize: 10,
                            color: '#4b5563', cursor: 'pointer', fontWeight: 600,
                          }}
                        >
                          {meta.unread ? '✓ Read' : '📨 Unread'}
                        </button>
                      )}
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
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
                {loading ? null : conversations.length === 0 ? (
                  // True empty state — user has never messaged anyone
                  <>
                    <div style={{ fontSize: 56, opacity: 0.25 }}>💬</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#d1d5db' }}>No messages yet</div>
                    <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
                      Find a listing you like and message the seller to start trading.
                    </div>
                    <Link href="/browse" style={{
                      marginTop: 8, padding: '10px 24px', borderRadius: 10,
                      background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700,
                    }}>Browse Listings</Link>
                  </>
                ) : (
                  // Conversations exist but none selected yet
                  <>
                    <div style={{ fontSize: 52, opacity: 0.2 }}>💬</div>
                    <div style={{ fontSize: 15, color: '#4b5563', fontWeight: 600 }}>Select a conversation</div>
                  </>
                )}
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
                        position: 'relative',
                      }}>
                        {otherUser?.avatar_url
                          ? <Image src={otherUser.avatar_url} alt="" fill sizes="38px" style={{ objectFit: 'cover', pointerEvents: 'none' }} />
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

                {/* Offer quick actions */}
                {activeOffer && (
                  <div style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid #1f2937',
                    background: activeOffer.status === 'accepted' ? 'rgba(74,222,128,0.08)' : 'rgba(245,158,11,0.08)',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: activeOffer.status === 'accepted' ? '#4ade80' : '#f59e0b' }}>
                      {activeOffer.status === 'accepted' ? '✓ Offer accepted' : '💰 Offer pending'}
                      {activeOffer.offerPrice ? ` • $${activeOffer.offerPrice}` : ''}
                    </span>
                    {activeOffer.status === 'pending' && activeOffer.role === 'seller' && (
                      <>
                        <button onClick={() => handleOfferAction('accept')} disabled={offerActionLoading} style={{ border: 'none', background: '#16a34a', color: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Accept</button>
                        <button onClick={() => handleOfferAction('counter')} disabled={offerActionLoading} style={{ border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Counter</button>
                        <button onClick={() => handleOfferAction('decline')} disabled={offerActionLoading} style={{ border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.12)', color: '#f87171', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Decline</button>
                      </>
                    )}
                    {activeOffer.status === 'pending' && activeOffer.role === 'buyer' && (
                      <button onClick={() => handleOfferAction('cancel')} disabled={offerActionLoading} style={{ border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.12)', color: '#f87171', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cancel Offer</button>
                    )}
                    <Link href={`/listing/${activeConvo?.listing_id}`} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#4ade80', textDecoration: 'none' }}>Open Listing →</Link>
                  </div>
                )}

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
                      onChange={e => { setDisputeForm(f => ({ ...f, details: e.target.value })); setDisputeError('') }}
                      style={{ marginBottom: 8, resize: 'vertical', fontSize: 12 }} />
                    {disputeError && (
                      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#f87171', marginBottom: 8 }}>
                        ⚠️ {disputeError}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleOpenDispute} disabled={disputeLoading || !disputeForm.reason} style={{
                        padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: !disputeForm.reason ? '#1f2937' : '#dc2626',
                        color: !disputeForm.reason ? '#6b7280' : '#fff',
                        fontSize: 12, fontWeight: 700,
                      }}>{disputeLoading ? 'Submitting...' : 'Submit Dispute'}</button>
                      <button onClick={() => { setDisputeOpen(false); setDisputeForm({ reason: '', details: '' }); setDisputeError('') }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #2d2d3f', background: 'transparent', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Load earlier messages button — shown when there are older pages */}
                  {msgHasMore && (
                    <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                      <button
                        onClick={loadEarlierMessages}
                        disabled={msgLoadingMore}
                        style={{
                          background: 'transparent', border: '1px solid #2d2d3f',
                          borderRadius: 8, padding: '6px 16px', fontSize: 12,
                          color: msgLoadingMore ? '#4b5563' : '#9ca3af',
                          cursor: msgLoadingMore ? 'default' : 'pointer', fontWeight: 600,
                        }}
                      >
                        {msgLoadingMore ? 'Loading...' : '↑ Load earlier messages'}
                      </button>
                    </div>
                  )}
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
                                position: 'relative',
                              }}>
                                {otherUser?.avatar_url
                                  ? <Image src={otherUser.avatar_url} alt="" fill sizes="28px" style={{ objectFit: 'cover', pointerEvents: 'none' }} />
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
                <div style={{ borderTop: '1px solid #1f2937', background: '#0d0d14' }}>
                  <div style={{ padding: '8px 12px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {QUICK_REPLIES.map((txt) => (
                      <button
                        key={txt}
                        onClick={() => { setNewMsg(txt); setTimeout(() => inputRef.current?.focus(), 50) }}
                        style={{
                          border: '1px solid #2d2d3f',
                          background: '#111118',
                          color: '#9ca3af',
                          borderRadius: 999,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {txt}
                      </button>
                    ))}
                  </div>
                  {sendError && (
                    <div style={{ padding: '8px 16px 0', fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚠️</span>
                      <span>{sendError}</span>
                      <button onClick={() => setSendError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                    </div>
                  )}
                  <div style={{ padding: '12px 16px', display: 'flex', gap: 10 }}>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Type a message..."
                      value={newMsg}
                      onChange={e => { setNewMsg(e.target.value); if (sendError) setSendError('') }}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      style={{ flex: 1, background: '#111118', fontSize: 14 }}
                    />
                    <button onClick={handleSend} disabled={!newMsg.trim() || sending} className="btn-primary" style={{ padding: '10px 20px', fontSize: 13, flexShrink: 0 }}>
                      {sending ? '...' : 'Send'}
                    </button>
                  </div>
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
