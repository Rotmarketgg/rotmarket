'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import StarRating from '@/components/StarRating'
import ReportButton from '@/components/ReportButton'
import { getListing, getReviews, getSessionUser, getProfile, createReview, supabase } from '@/lib/supabase'
import { getRarityStyle, timeAgo, formatPrice, getInitial, checkRateLimit, withTimeout } from '@/lib/utils'
import { BADGE_HIERARCHY, BADGE_META, getPrimaryBadge, PAYMENT_METHODS } from '@/lib/constants'
import { isClean } from '@/lib/profanity'

// ─── TRADE HELPERS ────────────────────────────────────────────────

async function getMyTradeRequest(listingId, userId) {
  const { data } = await supabase
    .from('trade_requests')
    .select('*')
    .eq('listing_id', listingId)
    .eq('buyer_id', userId)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
  return data?.[0] || null
}

async function getSellerOffers(listingId, sellerId) {
  const { data } = await supabase
    .from('trade_requests')
    .select(`
      *,
      buyer:profiles!trade_requests_buyer_id_fkey (id, username, avatar_url, trade_count, rating, badge)
    `)
    .eq('listing_id', listingId)
    .eq('seller_id', sellerId)
    .not('status', 'in', '("cancelled","declined")')
    .order('created_at', { ascending: false })
  return data || []
}

async function createTradeRequest({ listingId, buyerId, sellerId, offerMessage, offerPrice }) {
  // Cancel any previous declined requests so new insert succeeds
  await supabase
    .from('trade_requests')
    .update({ status: 'cancelled' })
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .in('status', ['declined', 'cancelled'])

  const { data, error } = await supabase
    .from('trade_requests')
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: sellerId,
      offer_message: offerMessage,
      offer_price: offerPrice || null,
      status: 'pending',
    })
    .select().single()
  if (error) throw error
  return data
}

async function updateTradeRequest(id, updates) {
  const { data, error } = await supabase
    .from('trade_requests')
    .update(updates)
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

async function completeTrade(requestId) {
  const { error } = await supabase.rpc('complete_trade', { request_id: requestId })
  if (error) throw error
}

// ─── MODULE-LEVEL SUB-COMPONENTS ─────────────────────────────────────────────
// Defined outside ListingPage so React doesn't recreate their identity on every
// parent render. Previously defined inside caused unmount/remount on each render,
// destroying local state (e.g. `working` in SellerOfferCard mid-action).

function SellerOfferCard({ offer, onUpdate, onSetListing }) {
  const [working, setWorking] = useState(false)
  const buyer = offer.buyer
  const statusColor = { pending: '#f59e0b', accepted: '#4ade80', completed: '#4ade80' }[offer.status] || '#6b7280'

  const doAction = async (fn) => {
    setWorking(true)
    try { await fn() } finally { setWorking(false) }
  }

  return (
    <div style={{
      background: '#0d0d14',
      border: `1px solid ${offer.status === 'pending' ? 'rgba(245,158,11,0.25)' : '#1f2937'}`,
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          background: buyer?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 900, color: '#0a0a0f',
        }}>
          {buyer?.avatar_url ? <img src={buyer.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitial(buyer?.username)}
        </div>
        <div style={{ flex: 1 }}>
          <Link href={`/profile/${buyer?.username}`} style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb', textDecoration: 'none' }}>
            {buyer?.username || 'Unknown'}
          </Link>
          <span style={{ marginLeft: 8, fontSize: 10, color: '#6b7280' }}>{buyer?.trade_count || 0} trades</span>
          {buyer?.rating > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: '#6b7280' }}>⭐{buyer.rating}</span>}
        </div>
        <span style={{
          fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
          color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40`,
          borderRadius: 3, padding: '2px 6px',
        }}>{offer.status}</span>
      </div>

      {offer.offer_price && (
        <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 700, marginBottom: 4 }}>Offered: ${offer.offer_price}</div>
      )}
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{offer.offer_message}</p>

      {offer.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={working} onClick={() => doAction(async () => {
            const u = await updateTradeRequest(offer.id, { status: 'accepted' })
            onUpdate(offer.id, u)
          })} style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {working ? '...' : '✓ Accept'}
          </button>
          <button disabled={working} onClick={() => doAction(async () => {
            const u = await updateTradeRequest(offer.id, { status: 'declined' })
            onUpdate(offer.id, u)
          })} style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {working ? '...' : '✕ Decline'}
          </button>
        </div>
      )}

      {offer.status === 'accepted' && (
        <button disabled={offer.seller_confirmed || working} onClick={() => doAction(async () => {
          const u = await updateTradeRequest(offer.id, { seller_confirmed: true })
          if (u.buyer_confirmed) {
            await completeTrade(offer.id)
            u.status = 'completed'
            onSetListing(prev => {
              const newQty = Math.max(0, (prev.quantity || 1) - 1)
              return { ...prev, quantity: newQty, status: newQty <= 0 ? 'sold' : prev.status }
            })
          }
          onUpdate(offer.id, u)
        })} style={{
          width: '100%', padding: '7px 0', borderRadius: 7, border: 'none',
          background: offer.seller_confirmed ? 'rgba(74,222,128,0.15)' : '#16a34a',
          color: offer.seller_confirmed ? '#4ade80' : '#fff',
          fontSize: 11, fontWeight: 700, cursor: offer.seller_confirmed ? 'default' : 'pointer',
        }}>
          {offer.seller_confirmed ? '✓ You Confirmed' : '💰 I Received Payment'}
        </button>
      )}

      {offer.status === 'completed' && (
        <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>🎉 Trade Complete</div>
      )}
    </div>
  )
}

function BuyerTradePanel({ myOffer, listing, seller, listingId, copiedId, setCopiedId, handleBuyerConfirm, setMyOffer, setOfferSent, setOfferMessage, setOfferPrice, confirmError, setConfirmError }) {
  if (!myOffer) return null
  const isTradeType = listing?.type === 'trade'

  if (myOffer.status === 'pending') return (
    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: 14, marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fde68a', marginBottom: 4 }}>⏳ Offer Pending</div>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9ca3af' }}>Waiting for the seller to respond.</p>
      <button onClick={async () => {
        if (!confirm('Cancel your offer?')) return
        await updateTradeRequest(myOffer.id, { status: 'cancelled' })
        setMyOffer(null); setOfferSent(false); setOfferMessage(''); setOfferPrice('')
      }} style={{ background: 'none', border: '1px solid #2d2d3f', color: '#6b7280', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
        Cancel Offer
      </button>
    </div>
  )

  if (myOffer.status === 'declined') return (
    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 14, marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>✕ Offer Declined</div>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9ca3af' }}>The seller declined. You can send a new offer.</p>
      <button onClick={() => { setMyOffer(null); setOfferSent(false); setOfferMessage(''); setOfferPrice('') }}
        className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>↩ Send New Offer</button>
    </div>
  )

  if (myOffer.status === 'accepted') return (
    <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 10, padding: 14, marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 10 }}>✓ Offer Accepted</div>

      {isTradeType ? (
        <div style={{ background: '#0d0d14', border: '1px solid #2d2d3f', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🔄 Next Steps</div>
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.7 }}>
            The seller accepted your trade. Message them to coordinate the exchange — agree on how you'll swap items, then both confirm below once the trade is done.
          </p>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href={`/messages?user=${seller?.username}`} style={{
              display: 'inline-block', padding: '7px 14px',
              background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#4ade80', textDecoration: 'none',
            }}>💬 Message Seller</Link>
          </div>
        </div>
      ) : (
        <div style={{ background: '#0d0d14', border: '1px solid #2d2d3f', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>💳 Payment Info</div>
          {seller?.paypal_email && <div style={{ fontSize: 12, color: '#d1d5db', marginBottom: 3 }}>🔵 PayPal: <strong>{seller.paypal_email}</strong></div>}
          {seller?.cashapp_handle && <div style={{ fontSize: 12, color: '#d1d5db', marginBottom: 3 }}>🟢 Cash App: <strong>{seller.cashapp_handle}</strong></div>}
          {seller?.venmo_handle && <div style={{ fontSize: 12, color: '#d1d5db', marginBottom: 3 }}>💙 Venmo: <strong>{seller.venmo_handle}</strong></div>}
          {!seller?.paypal_email && !seller?.cashapp_handle && !seller?.venmo_handle && (
            <div style={{ fontSize: 12, color: '#4b5563' }}>Message the seller for payment details.</div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: '#4b5563', borderTop: '1px solid #1f2937', paddingTop: 6 }}>
            Memo: <strong style={{ color: '#9ca3af' }}>{listingId.slice(0, 8)}</strong>
            <button onClick={() => { navigator.clipboard.writeText(listingId); setCopiedId(true); setTimeout(() => setCopiedId(false), 2000) }}
              style={{ marginLeft: 8, background: 'none', border: '1px solid #2d2d3f', color: copiedId ? '#4ade80' : '#6b7280', borderRadius: 4, padding: '1px 7px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>
              {copiedId ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <button onClick={() => { setConfirmError && setConfirmError(''); handleBuyerConfirm() }} disabled={myOffer.buyer_confirmed}
        style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: myOffer.buyer_confirmed ? 'default' : 'pointer', background: myOffer.buyer_confirmed ? 'rgba(74,222,128,0.15)' : '#16a34a', color: myOffer.buyer_confirmed ? '#4ade80' : '#fff', fontSize: 12, fontWeight: 700 }}>
        {myOffer.buyer_confirmed ? '✓ You Confirmed' : isTradeType ? '🔄 I Received My Item' : '📦 I Received My Item'}
      </button>
      {confirmError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginTop: 8 }}>
          ⚠️ {confirmError}
        </div>
      )}
    </div>
  )

  if (myOffer.status === 'completed') return (
    <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 10, padding: 14, marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>🎉 Trade Complete!</div>
      <p style={{ margin: '5px 0 0', fontSize: 12, color: '#9ca3af' }}>Scroll down to leave a review for the seller.</p>
    </div>
  )
  return null
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────

// id prop is passed from the server wrapper (page.js) — avoids an extra
// useParams() call and ensures the id is available on the very first render.
export default function ListingPageClient({ id: idProp }) {
  const params = useParams()
  const id = idProp ?? params?.id
  const router = useRouter()

  const [listing, setListing] = useState(null)
  const [reviews, setReviews] = useState([])
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [myOffer, setMyOffer] = useState(null)         // buyer's own offer
  const [sellerOffers, setSellerOffers] = useState([]) // seller's incoming offers
  const [tab, setTab] = useState('details')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedId, setCopiedId] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const [offerMessage, setOfferMessage] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [offerLoading, setOfferLoading] = useState(false)
  const [offerSent, setOfferSent] = useState(false)
  const [offerError, setOfferError] = useState('')

  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewSuccess, setReviewSuccess] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [confirmError, setConfirmError] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [listingData, currentUser] = await Promise.all([withTimeout(getListing(id)), getSessionUser()])
      setListing(listingData)
      setUser(currentUser)
      const [reviewsData, profileData] = await withTimeout(Promise.all([
        getReviews(listingData.profiles?.id),
        currentUser ? getProfile(currentUser.id) : null,
      ]))
      setReviews(reviewsData || [])
      setProfile(profileData)
      if (currentUser) {
        const isSellerUser = listingData.profiles?.id === currentUser.id
        if (isSellerUser) {
          const offers = await getSellerOffers(id, currentUser.id)
          setSellerOffers(offers)
        } else {
          const tr = await getMyTradeRequest(id, currentUser.id)
          setMyOffer(tr)
        }
      }
    } catch (err) {
      // Only show error on initial load — on silent tab-return refresh keep existing data
      if (!silent) setError('Listing not found.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Silent refresh on tab return — fires after rotmarket:tab-visible (600ms delay)
  // so the Supabase client has been verified healthy before we hit the DB.
  // Previously used raw visibilitychange which fired before client recovery.
  useEffect(() => {
    const onVisible = async () => {
      try { await load(true) }
      catch { setTimeout(() => load(true), 2000) }
    }
    window.addEventListener('rotmarket:tab-visible', onVisible)
    return () => window.removeEventListener('rotmarket:tab-visible', onVisible)
  }, [load])

  const rarity = listing ? getRarityStyle(listing.rarity) : getRarityStyle('common')
  const seller = listing?.profiles
  const isSeller = user && seller && user.id === seller.id

  // VIP / Owner glow — mirrors ListingCard behaviour
  const sellerBadgesForGlow = seller?.badges?.length ? seller.badges
    : seller?.badge ? [seller.badge]
    : []
  const isVip = sellerBadgesForGlow.includes('VIP') || sellerBadgesForGlow.includes('Owner')
  // Allow reviewing the same seller multiple times (different listings)
  // but not the same listing twice
  const alreadyReviewedThisListing = reviews.some(r => r.reviewer_id === user?.id)

  // ─── HANDLERS ─────────────────────────────────────────────────

  const handleSendOffer = async () => {
    if (!user) { router.push('/auth/login'); return }
    if (!offerMessage.trim()) return
    if (!isClean(offerMessage)) { setOfferError('Your message contains inappropriate language.'); return }
    const rl = checkRateLimit('offer')
    if (rl) { setOfferError(rl); return }
    setOfferError('')
    setOfferLoading(true)
    try {
      const tr = await createTradeRequest({
        listingId: id, buyerId: user.id, sellerId: seller.id,
        offerMessage: offerMessage.trim(),
        offerPrice: listing.type === 'sale' ? (offerPrice || listing.price) : null,
      })
      setMyOffer(tr)
      setOfferSent(true)
    } catch (err) {
      if (err.message?.includes('unique')) setOfferError('You already have an active offer on this listing.')
      else setOfferError('Failed to send offer. Please try again.')
    } finally {
      setOfferLoading(false)
    }
  }

  const handleReview = async () => {
    if (!user) { router.push('/auth/login'); return }
    if (!isClean(reviewComment)) { setReviewError('Your review contains inappropriate language.'); return }
    setReviewError('')
    setReviewLoading(true)
    try {
      await createReview({ reviewerId: user.id, sellerId: seller.id, listingId: id, rating: reviewRating, comment: reviewComment })
      setReviewSuccess(true)
      const [refreshedReviews, refreshedListing] = await Promise.all([getReviews(seller.id), getListing(id)])
      setReviews(refreshedReviews)
      setListing(refreshedListing)
    } catch (err) {
      setReviewError(err.message || 'Failed to post review.')
    } finally {
      setReviewLoading(false)
    }
  }

  const handleBuyerConfirm = async () => {
    if (!myOffer) return
    try {
      const updated = await updateTradeRequest(myOffer.id, { buyer_confirmed: true })
      if (updated.seller_confirmed) {
        await completeTrade(myOffer.id)
        updated.status = 'completed'
        // Decrement quantity locally; DB handles actual sold-out logic
        setListing(prev => {
          const newQty = Math.max(0, (prev.quantity || 1) - 1)
          return { ...prev, quantity: newQty, status: newQty <= 0 ? 'sold' : prev.status }
        })
      }
      setMyOffer(updated)
    } catch { setConfirmError('Failed to confirm trade. Please refresh and try again.') }
  }


  const updateSellerOffer = (offerId, updated) => {
    setSellerOffers(prev => prev.map(o => o.id === offerId ? { ...o, ...updated } : o))
  }


  // ─── LOADING / ERROR ─────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh' }}><Navbar />
      <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>
        <div className="skeleton" style={{ height: 500, borderRadius: 16 }} />
      </div>
    </div>
  )

  if (error || !listing) return (
    <div style={{ minHeight: '100vh' }}><Navbar />
      <div style={{ textAlign: 'center', padding: '100px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
        <h2 style={{ color: '#f9fafb', marginBottom: 8 }}>Listing Not Found</h2>
        <Link href="/browse" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Back to Listings</Link>
      </div>
    </div>
  )

  // ─── RENDER ───────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />

      {/* Lightbox */}
      {lightboxOpen && listing.images?.[selectedImage] && (
        <div onClick={() => setLightboxOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out',
        }}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <img src={listing.images[selectedImage]} alt={listing.title}
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 12, boxShadow: `0 0 60px ${rarity.glow}`, pointerEvents: 'none' }} />
            <button onClick={() => setLightboxOpen(false)} style={{
              position: 'absolute', top: -14, right: -14, width: 32, height: 32, borderRadius: '50%',
              background: '#1f2937', border: '1px solid #2d2d3f', color: '#fff', fontSize: 16,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            }}>×</button>
            {listing.images.length > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                {listing.images.map((img, i) => (
                  <div key={i} onClick={() => setSelectedImage(i)} style={{
                    width: 48, height: 48, borderRadius: 6, overflow: 'hidden',
                    border: `2px solid ${selectedImage === i ? rarity.border : '#2d2d3f'}`, cursor: 'pointer',
                  }}>
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ marginBottom: 14, fontSize: 12, color: '#6b7280' }}>
          <Link href="/browse" style={{ color: '#6b7280', textDecoration: 'none' }}>Browse</Link>
          <span style={{ margin: '0 6px' }}>›</span>
          <span style={{ color: '#9ca3af' }}>{listing.title}</span>
        </div>

        {listing.status === 'sold' && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 14, color: '#f87171', fontSize: 13, fontWeight: 600 }}>
            🔴 This listing has been marked as sold.
          </div>
        )}

        <div style={{
            background: '#0f0f18',
            border: listing?.promoted
              ? '2px solid rgba(59,130,246,0.7)'
              : isVip
              ? '2px solid rgba(245,158,11,0.6)'
              : `1px solid ${rarity.border}44`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: listing?.promoted
              ? `0 0 40px rgba(59,130,246,0.35), 0 20px 60px rgba(0,0,0,0.5)`
              : isVip
              ? `0 0 40px rgba(245,158,11,0.3), inset 0 0 0 1px rgba(245,158,11,0.1), 0 20px 60px rgba(0,0,0,0.5)`
              : `0 0 40px ${rarity.glow}66, 0 20px 60px rgba(0,0,0,0.5)`,
          }}>

          {/* Rarity accent bar — matches card design */}
          <div style={{ height: 4, background: `linear-gradient(90deg, ${rarity.border}, ${rarity.border}88, transparent)` }} />

          {/* Rarity / meta header */}
          <div style={{ background: `linear-gradient(90deg, ${rarity.bg}66, transparent)`, borderBottom: `1px solid ${rarity.border}33`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: rarity.text, background: `${rarity.bg}88`, border: `1px solid ${rarity.border}88`, borderRadius: 4, padding: '3px 9px' }}>{listing.rarity?.replace('_', ' ')}</span>
            <span style={{ fontSize: 13, color: '#475569' }}>·</span>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{listing.game === 'fortnite' ? '🎮 Fortnite Brainrot' : '🟥 Roblox Brainrot'}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }} className="hide-mobile">
              <span style={{ fontSize: 12, color: '#475569' }}>👁 {listing.views}</span>
              <span style={{ fontSize: 12, color: '#374151' }}>{timeAgo(listing.created_at)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap' }} className="stack-mobile">

            {/* LEFT COLUMN */}
            <div style={{ width: 240, minWidth: 200, borderRight: '1px solid #1a1a2e', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'rgba(0,0,0,0.3)' }} className="full-mobile no-border-mobile pad-mobile">

              {/* Main image */}
              <div onClick={() => listing.images?.[selectedImage] && setLightboxOpen(true)} style={{
                width: '100%', aspectRatio: '1/1',
                background: listing.images?.[selectedImage]
                  ? 'transparent'
                  : `radial-gradient(ellipse at 50% 30%, ${rarity.bg} 0%, #080810 75%)`,
                borderRadius: 12, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 72, position: 'relative',
                boxShadow: `0 0 24px ${rarity.glow}`,
                cursor: listing.images?.[selectedImage] ? 'zoom-in' : 'default',
                outline: `1px solid ${rarity.border}55`,
              }}>
                {listing.images?.[selectedImage]
                  ? <img src={listing.images[selectedImage]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                  : '🎮'
                }
                {/* Bottom gradient fade */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to top, rgba(15,15,24,0.6) 0%, transparent 100%)', pointerEvents: 'none' }} />
                {listing.images?.[selectedImage] && (
                  <div style={{ position: 'absolute', bottom: 6, right: 8, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>🔍 Expand</div>
                )}
              </div>

              {/* Thumbnails */}
              {listing.images?.length > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {listing.images.map((img, i) => (
                    <div key={i} onClick={() => setSelectedImage(i)} style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', border: `2px solid ${selectedImage === i ? rarity.border : '#2d2d3f'}`, cursor: 'pointer' }}>
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Price */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#4ade80', letterSpacing: '-1px' }}>
                  {listing.type === 'trade' ? '🔄 Trade' : formatPrice(listing.price)}
                </div>
                {listing.type === 'sale' && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>or best offer</div>}
                {/* Quantity indicator */}
                {listing.type === 'sale' && listing.quantity > 1 && listing.status === 'active' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '4px 10px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6 }}>
                    <span style={{ fontSize: 14 }}>📦</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>{listing.quantity} available</span>
                  </div>
                )}
                {listing.type === 'sale' && listing.quantity === 1 && listing.status === 'active' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '4px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>⚡ Last one</span>
                  </div>
                )}
              </div>

              {/* Payment methods */}
              {listing.accepts?.length > 0 && (
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Accepts</div>
                  {listing.accepts.map(method => {
                    const pm = PAYMENT_METHODS.find(p => p.label === method)
                    return (
                      <div key={method} style={{ fontSize: 11, color: '#d1d5db', background: '#1a1a2e', border: '1px solid #2d2d3f', borderRadius: 6, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span>{pm?.emoji || '💳'}</span> {method}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ flex: 1, minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }} className="pad-mobile">
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(18px, 4vw, 24px)', fontWeight: 700, color: '#f9fafb', fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif', letterSpacing: '-0.3px' }}>
                    {listing.title}
                  </h1>
                  {!isSeller && user && seller && (
                    <div style={{ flexShrink: 0 }}>
                      <ReportButton reportedUserId={seller.id} listingId={id} label="Report" />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  {listing.status === 'sold' ? '🔴 Sold' : listing.type === 'sale' ? 'For Sale' : 'For Trade'}
                </div>
              </div>

              {/* Tabs — no reviews tab */}
              <div style={{ display: 'flex', borderBottom: '1px solid #1f2937' }}>
                {['details', 'seller'].map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '10px 18px', fontSize: 13, fontWeight: 700, textTransform: 'capitalize',
                    color: tab === t ? '#4ade80' : '#6b7280',
                    borderBottom: tab === t ? '2px solid #4ade80' : '2px solid transparent',
                    marginBottom: -1, transition: 'all 0.15s',
                  }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT */}
              <div style={{ flex: 1, minHeight: 160 }}>

                {/* DETAILS */}
                {tab === 'details' && (
                  <div>
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#9ca3af', lineHeight: 1.7 }}>
                      {listing.description || 'No description provided.'}
                    </p>

                    {/* SELLER: show all incoming offers */}
                    {isSeller && listing.status === 'active' && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 8 }}>
                          Incoming Offers ({sellerOffers.filter(o => o.status !== 'declined').length})
                        </div>
                        {sellerOffers.filter(o => o.status !== 'declined').length === 0 ? (
                          <div style={{ fontSize: 12, color: '#4b5563', background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 8, padding: '10px 12px' }}>
                            No active offers yet.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {sellerOffers.filter(o => o.status !== 'declined').map(offer => (
                              <SellerOfferCard key={offer.id} offer={offer} onUpdate={updateSellerOffer} onSetListing={setListing} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* BUYER: show their offer status */}
                    {!isSeller && <BuyerTradePanel myOffer={myOffer} listing={listing} seller={seller} listingId={id} copiedId={copiedId} setCopiedId={setCopiedId} handleBuyerConfirm={handleBuyerConfirm} setMyOffer={setMyOffer} setOfferSent={setOfferSent} setOfferMessage={setOfferMessage} setOfferPrice={setOfferPrice} confirmError={confirmError} setConfirmError={setConfirmError} />}

                    {/* REVIEW FORM — shows in details tab after completed trade */}
                    {!isSeller && user && myOffer?.status === 'completed' && (
                      <div style={{ marginTop: 14 }}>
                        {!alreadyReviewedThisListing && !reviewSuccess ? (
                          <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 10, padding: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 10 }}>⭐ Leave a Review for {seller?.username}</div>
                            <div style={{ marginBottom: 10 }}><StarRating rating={reviewRating} size={24} interactive onChange={setReviewRating} /></div>
                            <textarea rows={3} placeholder="How was the trade? Other buyers will see this." value={reviewComment} onChange={e => { setReviewComment(e.target.value); setReviewError('') }} style={{ marginBottom: reviewError ? 8 : 10, resize: 'vertical' }} />
                            {reviewError && (
                              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 10 }}>
                                ⚠️ {reviewError}
                              </div>
                            )}
                            <button onClick={handleReview} disabled={reviewLoading} className="btn-primary" style={{ fontSize: 13, padding: '10px 20px' }}>
                              {reviewLoading ? 'Posting...' : 'Post Review'}
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 600, padding: '10px 14px', background: 'rgba(74,222,128,0.06)', borderRadius: 8, border: '1px solid rgba(74,222,128,0.2)' }}>
                            ✓ Review posted! View it on <Link href={`/profile/${seller?.username}`} style={{ color: '#4ade80' }}>their profile</Link>.
                          </div>
                        )}
                      </div>
                    )}

                    {/* BUYER: send offer form */}
                    {!isSeller && !myOffer && listing.status === 'active' && (
                      <div style={{ marginTop: 14 }}>
                        {!user ? (
                          <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 10 }}>Sign in to make an offer.</p>
                            <Link href="/auth/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Sign In</Link>
                          </div>
                        ) : offerSent ? (
                          <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                            <p style={{ color: '#4ade80', fontWeight: 700, fontSize: 13 }}>Offer sent! The seller will respond shortly.</p>
                          </div>
                        ) : (
                          <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 10, padding: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 10 }}>
                              {listing.type === 'trade' ? '🔄 Make a Trade Offer' : '💰 Make an Offer'}
                            </div>
                            {listing.type === 'sale' && (
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Your offer (blank = asking price {formatPrice(listing.price)})</label>
                                <div style={{ position: 'relative' }}>
                                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>$</span>
                                  <input type="number" placeholder={listing.price} value={offerPrice} onChange={e => setOfferPrice(e.target.value)} min="0.01" step="0.01" style={{ paddingLeft: 24 }} />
                                </div>
                              </div>
                            )}
                            <textarea rows={3} placeholder={listing.type === 'trade' ? 'What are you offering to trade?' : "Hi! I'd like to buy this..."} value={offerMessage} onChange={e => { setOfferMessage(e.target.value); setOfferError('') }} style={{ marginBottom: offerError ? 8 : 10, resize: 'vertical' }} />
                            {offerError && (
                              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 10 }}>
                                ⚠️ {offerError}
                              </div>
                            )}
                            <button onClick={handleSendOffer} disabled={offerLoading || !offerMessage.trim()} className="btn-primary" style={{ width: '100%' }}>
                              {offerLoading ? 'Sending...' : listing.type === 'trade' ? '🔄 Send Trade Offer' : '💰 Send Offer'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SELLER TAB */}
                {tab === 'seller' && seller && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Link href={`/profile/${seller.username}`} style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 10, transition: 'border-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#4ade80'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#1f2937'}
                      >
                        {/* Avatar */}
                        <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: seller.avatar_url ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#0a0a0f', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                          {seller.avatar_url ? <img src={seller.avatar_url} alt={seller.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitial(seller.username)}
                        </div>

                        {/* Name + game usernames */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 17, fontWeight: 700, color: '#f9fafb', marginBottom: 2, fontFamily: '"DM Sans", system-ui, sans-serif' }}>{seller.username}</div>
                          {seller.epic_username && <div style={{ fontSize: 12, color: '#6b7280' }}>🎮 {seller.epic_username}</div>}
                          {seller.roblox_username && <div style={{ fontSize: 12, color: '#6b7280' }}>🟥 {seller.roblox_username}</div>}
                        </div>

                        {/* All badges — hierarchy order */}
                        {(() => {
                          const sellerBadges = seller.badges?.length ? seller.badges
                            : seller.badge ? [seller.badge] : []
                          const activeBadges = BADGE_HIERARCHY.filter(b => sellerBadges.includes(b))
                          if (!activeBadges.length) return null
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                              {activeBadges.map(b => {
                                const m = BADGE_META[b]
                                return (
                                  <div key={b} style={{ fontSize: 10, fontWeight: 800, color: m.color, background: m.bg, border: `1px solid ${m.border}`, borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {m.icon} {b}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                    </Link>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 10 }} className="stack-mobile">
                      <div style={{ flex: 1, background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#4ade80' }}>{seller.trade_count || 0}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Trades</div>
                      </div>

                      {/* Rating — links to profile reviews */}
                      <Link href={`/profile/${seller.username}#reviews`} style={{
                        flex: 1, background: '#0d0d14', border: '1px solid #1f2937',
                        borderRadius: 8, padding: '12px', textAlign: 'center',
                        textDecoration: 'none', display: 'flex',
                        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        transition: 'border-color 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#f59e0b'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#1f2937'}
                      >
                        {(() => {
                          // Use DB-stored rating/review_count as primary source;
                          // fall back to live calculation from fetched reviews if absent.
                          const count = seller.review_count ?? reviews.length
                          const avg = seller.rating ?? (
                            reviews.length > 0
                              ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
                              : 0
                          )
                          return count > 0 ? (
                            <>
                              <StarRating rating={avg} size={14} />
                              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                                {count} review{count !== 1 ? 's' : ''}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 18, marginBottom: 2 }}>⭐</div>
                              <div style={{ fontSize: 12, color: '#6b7280' }}>No reviews yet</div>
                            </>
                          )
                        })()}
                      </Link>
                    </div>

                    {seller.bio && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, lineHeight: 1.7 }}>{seller.bio}</p>}
                    <div style={{ fontSize: 12, color: '#4b5563', background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 8, padding: '10px 14px' }}>
                      💳 Payment info is revealed after the seller accepts your offer.
                    </div>
                  </div>
                )}

                {/* REVIEWS TAB removed — click rating on Seller tab to see reviews */}

              </div>

              {isSeller && listing.status === 'active' && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 12, color: '#4b5563', margin: 0 }}>
                    To remove this listing, go to your <Link href={`/profile/${seller?.username}`} style={{ color: '#4ade80', textDecoration: 'none' }}>profile page</Link>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
