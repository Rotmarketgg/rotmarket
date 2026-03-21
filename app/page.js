'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Navbar from '@/components/Navbar'
import ListingCard, { ListingCardSkeleton } from '@/components/ListingCard'
import { getListings } from '@/lib/supabase'

const withTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Loading took too long — please refresh')), ms)
    )
  ])
import { GAMES } from '@/lib/constants'
import Link from 'next/link'

const FILTERS = [
  { id: 'all',   label: 'All Active' },
  { id: 'sale',  label: 'For Sale' },
  { id: 'trade', label: 'For Trade' },
  { id: 'sold',  label: 'Sold' },
]

const PAGE_SIZE = 24

export default function HomePage() {
  const [listings, setListings]         = useState([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [game, setGame]                 = useState('all')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebSearch] = useState('')
  const [page, setPage]                 = useState(0)
  const [hasMore, setHasMore]           = useState(true)
  const debounceTimer  = useRef(null)
  const sentinelRef    = useRef(null)   // invisible div at bottom of grid
  const observerRef    = useRef(null)   // IntersectionObserver instance

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebSearch(search), 350)
    return () => clearTimeout(debounceTimer.current)
  }, [search])

  const fetchListings = useCallback(async (reset = false, pageNum = 0) => {
    const isFirst = reset || pageNum === 0
    if (isFirst) setLoading(true)
    else setLoadingMore(true)

    try {
      const { data, total: t } = await withTimeout(getListings({
        game: game === 'all' ? null : game,
        type: typeFilter === 'all' || typeFilter === 'sold' ? null : typeFilter,
        status: typeFilter === 'sold' ? 'sold' : 'active',
        search: debouncedSearch || null,
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      }))

      if (isFirst) {
        setListings(data)
        setPage(0)
      } else {
        setListings(prev => [...prev, ...data])
      }
      setTotal(t)
      setHasMore(data.length === PAGE_SIZE && !debouncedSearch)
    } catch (err) {
      console.error('Listings load error:', err.message)
      if (isFirst) setListings([]) // clear loading state — never leave it stuck
    } finally {
      // Always runs — guarantees loading spinner clears no matter what
      setLoading(false)
      setLoadingMore(false)
    }
  }, [game, typeFilter, debouncedSearch])

  // Reset and fetch when filters change
  useEffect(() => { fetchListings(true, 0) }, [game, typeFilter, debouncedSearch])

  // Load next page
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchListings(false, nextPage)
  }, [loadingMore, hasMore, page, fetchListings])

  // IntersectionObserver — auto-load when sentinel comes into view
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!sentinelRef.current || !hasMore || loading) return

    observerRef.current = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }  // start loading 200px before user hits bottom
    )
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, loading, loadMore])

  const shown = listings.length

  return (
    <div className="noise" style={{ minHeight: '100vh' }}>
      <Navbar />

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(74,222,128,0.06) 0%, transparent 100%)',
        borderBottom: '1px solid #1f2937',
        padding: '48px 16px 32px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h1 style={{
            margin: '0 0 12px', fontSize: 'clamp(32px, 6vw, 52px)',
            fontFamily: 'var(--font-display)', fontWeight: 900,
            letterSpacing: '-1px', lineHeight: 1, color: '#fff',
          }}>
            Trade Your <span style={{ color: '#4ade80' }}>Brainrots</span>
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: 15, color: '#9ca3af', lineHeight: 1.6 }}>
            The trusted marketplace for Fortnite Brainrot & Roblox Brainrot trades.
            Verified sellers. Reputation system. Safe trades.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/create" style={{
              padding: '11px 24px', borderRadius: 10, textDecoration: 'none',
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              color: '#fff', fontSize: 13, fontWeight: 700,
            }}>+ Post a Listing</Link>
            <Link href="/how-it-works" style={{
              padding: '11px 24px', borderRadius: 10, textDecoration: 'none',
              background: 'transparent', border: '1px solid #2d2d3f',
              color: '#9ca3af', fontSize: 13, fontWeight: 600,
            }}>How It Works</Link>
          </div>
        </div>
      </div>

      {/* Filters + search */}
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>

          {/* Game filter */}
          <div style={{ display: 'flex', gap: 6, background: '#111118', border: '1px solid #1f2937', borderRadius: 10, padding: 4 }}>
            <FilterPill active={game === 'all'} onClick={() => setGame('all')}>All Games</FilterPill>
            {GAMES.map(g => (
              <FilterPill key={g.id} active={game === g.id} onClick={() => setGame(g.id)}>{g.emoji} {g.label}</FilterPill>
            ))}
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 6, background: '#111118', border: '1px solid #1f2937', borderRadius: 10, padding: 4 }}>
            {FILTERS.map(f => (
              <FilterPill key={f.id} active={typeFilter === f.id} onClick={() => setTypeFilter(f.id)}>{f.label}</FilterPill>
            ))}
          </div>

          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#4b5563', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="Search listings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34, width: '100%' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            )}
          </div>

          {/* Count */}
          {!loading && (
            <div style={{ fontSize: 12, color: '#4b5563', flexShrink: 0, fontWeight: 600 }}>
              {debouncedSearch
                ? `${shown} result${shown !== 1 ? 's' : ''}`
                : total > 0
                ? `${shown.toLocaleString()} of ${total.toLocaleString()} listing${total !== 1 ? 's' : ''}`
                : ''
              }
            </div>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="listing-grid">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState game={game} search={debouncedSearch} />
        ) : (
          <>
            <div className="listing-grid animate-fade-in">
              {listings.map((listing, i) => (
                <div key={listing.id} style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }} className="animate-slide-up">
                  <ListingCard listing={listing} />
                </div>
              ))}
            </div>

            {/* Sentinel — IntersectionObserver watches this */}
            {hasMore && !debouncedSearch && (
              <div ref={sentinelRef} style={{ marginTop: 32, textAlign: 'center', paddingBottom: 16 }}>
                {loadingMore ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#6b7280', fontSize: 13 }}>
                    <div className="skeleton" style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0 }} />
                    Loading more listings...
                  </div>
                ) : (
                  /* Fallback button — shown if IntersectionObserver doesn't fire (e.g. reduced motion) */
                  <button onClick={loadMore} className="btn-ghost" style={{ fontSize: 13 }}>
                    Load More · {total - shown} remaining
                  </button>
                )}
              </div>
            )}

            {/* End of results */}
            {!hasMore && listings.length > PAGE_SIZE && (
              <div style={{ textAlign: 'center', padding: '32px 0 16px', fontSize: 13, color: '#374151' }}>
                ✓ All {total.toLocaleString()} listings loaded
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1f2937', marginTop: 64, padding: '24px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
          RotMarket is not affiliated with Epic Games or Roblox Corporation.<br />
          Trade at your own risk. Always use Goods & Services payments for buyer protection.
        </div>
      </footer>
    </div>
  )
}

function FilterPill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.15s', border: 'none',
      background: active ? 'rgba(74,222,128,0.2)' : 'transparent',
      color: active ? '#4ade80' : '#6b7280',
      boxShadow: active ? '0 0 0 1px rgba(74,222,128,0.4)' : 'none',
    }}>{children}</button>
  )
}

function EmptyState({ game, search }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>{search ? '🔍' : '🎮'}</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: '#f9fafb', margin: '0 0 8px' }}>
        {search ? `No results for "${search}"` : 'No listings yet'}
      </h3>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
        {search
          ? 'Try a different search term or clear the filter.'
          : `Be the first to list a Brainrot${game !== 'all' ? ` in ${game}` : ''}!`
        }
      </p>
      {!search && (
        <Link href="/create" style={{
          display: 'inline-block', padding: '11px 24px',
          background: 'linear-gradient(135deg, #16a34a, #15803d)',
          color: '#fff', textDecoration: 'none', borderRadius: 10,
          fontSize: 13, fontWeight: 700,
        }}>Post First Listing</Link>
      )}
    </div>
  )
}
