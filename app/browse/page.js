'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ListingCard, { ListingCardSkeleton } from '@/components/ListingCard'
import { getListings } from '@/lib/supabase'
import { withTimeout } from '@/lib/utils'
import { GAMES } from '@/lib/constants'
import Link from 'next/link'

const PAGE_SIZE = 24

const TYPE_FILTERS = [
  { id: 'all',   label: 'All Active' },
  { id: 'sale',  label: 'For Sale' },
  { id: 'trade', label: 'For Trade' },
  { id: 'sold',  label: 'Sold' },
]

// Wrap in Suspense because useSearchParams() requires it in Next.js App Router
export default function BrowsePageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0f' }} />}>
      <BrowsePage />
    </Suspense>
  )
}

function BrowsePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read filters from URL so the page is shareable / bookmarkable
  const pageParam  = parseInt(searchParams.get('page')  || '1', 10)
  const gameParam  = searchParams.get('game')  || 'all'
  const typeParam  = searchParams.get('type')  || 'all'
  const searchParam = searchParams.get('q')   || ''

  const [listings, setListings] = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)

  // Local state mirrors URL params — updated on user interaction then pushed to URL
  const [game, setGame]         = useState(gameParam)
  const [typeFilter, setType]   = useState(typeParam)
  const [search, setSearch]     = useState(searchParam)
  const [debouncedSearch, setDebSearch] = useState(searchParam)
  const debounceTimer = useRef(null)

  // Debounce search input
  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebSearch(search), 350)
    return () => clearTimeout(debounceTimer.current)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Push filter/page changes into the URL so back button works correctly
  const pushParams = useCallback((overrides = {}) => {
    const next = {
      page: pageParam,
      game,
      type: typeFilter,
      q: debouncedSearch,
      ...overrides,
    }
    const params = new URLSearchParams()
    if (next.page > 1)         params.set('page', next.page)
    if (next.game !== 'all')   params.set('game', next.game)
    if (next.type !== 'all')   params.set('type', next.type)
    if (next.q)                params.set('q', next.q)
    const qs = params.toString()
    router.push(`/browse${qs ? `?${qs}` : ''}`, { scroll: true })
  }, [pageParam, game, typeFilter, debouncedSearch, router])

  // Fetch whenever URL params change
  const fetchListings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data, total: t } = await withTimeout(getListings({
        game:   gameParam === 'all' ? null : gameParam,
        type:   typeParam === 'all' || typeParam === 'sold' ? null : typeParam,
        status: typeParam === 'sold' ? 'sold' : 'active',
        search: searchParam || null,
        limit:  PAGE_SIZE,
        offset: (pageParam - 1) * PAGE_SIZE,
      }), silent ? 8000 : 20000)
      setListings(data || [])
      setTotal(t || 0)
    } catch (err) {
      console.error('Browse load error:', err.message)
      if (!silent) setListings([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [gameParam, typeParam, searchParam, pageParam])

  useEffect(() => {
    // Sync local state with URL when navigating back/forward
    setGame(gameParam)
    setType(typeParam)
    setSearch(searchParam)
    setDebSearch(searchParam)
    fetchListings()
    // Scroll to top of listing grid on page change
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [fetchListings])

  // Silent refresh on tab return — debounced to 30s to avoid hammering storage CDN
  useEffect(() => {
    let lastRefresh = 0
    const onVisible = async () => {
      const now = Date.now()
      if (now - lastRefresh < 30000) return
      lastRefresh = now
      try { await fetchListings(true) }
      catch { setTimeout(() => fetchListings(true), 2000) }
    }
    window.addEventListener('rotmarket:tab-visible', onVisible)
    return () => window.removeEventListener('rotmarket:tab-visible', onVisible)
  }, [fetchListings])

  // When a filter changes, reset to page 1
  const handleGameChange = (g) => {
    setGame(g)
    pushParams({ game: g, page: 1 })
  }
  const handleTypeChange = (t) => {
    setType(t)
    pushParams({ type: t, page: 1 })
  }
  const handleSearchSubmit = () => {
    pushParams({ q: search, page: 1 })
  }
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearchSubmit()
  }
  const handleClearSearch = () => {
    setSearch('')
    pushParams({ q: '', page: 1 })
  }
  const handlePage = (p) => {
    pushParams({ page: p })
  }

  const shown = listings.length
  const startItem = (pageParam - 1) * PAGE_SIZE + 1
  const endItem   = Math.min(pageParam * PAGE_SIZE, total)

  return (
    <div className="noise" style={{ minHeight: '100vh' }}>
      <Navbar />

      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(74,222,128,0.04) 0%, transparent 100%)',
        borderBottom: '1px solid #1f2937',
        padding: '32px 16px 24px',
      }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <h1 style={{
            margin: '0 0 4px', fontSize: 'clamp(24px, 4vw, 36px)',
            fontFamily: 'var(--font-display)', fontWeight: 900,
            letterSpacing: '-0.5px', color: '#fff',
          }}>
            Browse <span style={{ color: '#4ade80' }}>Listings</span>
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            {loading ? 'Loading...' : total > 0 ? `${total.toLocaleString()} listing${total !== 1 ? 's' : ''} found` : 'No listings found'}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 16px 0' }}>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>

          {/* Game filter */}
          <div style={{ display: 'flex', gap: 6, background: '#111118', border: '1px solid #1f2937', borderRadius: 10, padding: 4 }}>
            <FilterPill active={game === 'all'} onClick={() => handleGameChange('all')}>All Games</FilterPill>
            {GAMES.map(g => (
              <FilterPill key={g.id} active={game === g.id} onClick={() => handleGameChange(g.id)}>
                {g.emoji} {g.label}
              </FilterPill>
            ))}
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 6, background: '#111118', border: '1px solid #1f2937', borderRadius: 10, padding: 4 }}>
            {TYPE_FILTERS.map(f => (
              <FilterPill key={f.id} active={typeFilter === f.id} onClick={() => handleTypeChange(f.id)}>
                {f.label}
              </FilterPill>
            ))}
          </div>

          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#4b5563', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="Search listings... (press Enter)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              style={{ paddingLeft: 34, paddingRight: search ? 60 : 12, width: '100%' }}
            />
            {search && (
              <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
                {search !== debouncedSearch || search !== searchParam ? (
                  <button onClick={handleSearchSubmit} style={{
                    background: '#4ade80', border: 'none', borderRadius: 5,
                    color: '#0a0a0f', cursor: 'pointer', fontSize: 11,
                    fontWeight: 700, padding: '3px 7px',
                  }}>Go</button>
                ) : null}
                <button onClick={handleClearSearch} style={{
                  background: 'none', border: 'none', color: '#6b7280',
                  cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px',
                }}>×</button>
              </div>
            )}
          </div>

          {/* Result count */}
          {!loading && total > 0 && (
            <div style={{ fontSize: 12, color: '#4b5563', flexShrink: 0, fontWeight: 600 }}>
              {searchParam
                ? `${shown} result${shown !== 1 ? 's' : ''}`
                : `${startItem}–${endItem} of ${total.toLocaleString()}`
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
          <EmptyState search={searchParam} />
        ) : (
          <div className="listing-grid animate-fade-in">
            {listings.map((listing, i) => (
              <div key={listing.id} style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }} className="animate-slide-up">
                <ListingCard listing={listing} />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <Pagination current={pageParam} total={totalPages} onChange={handlePage} />
        )}

      </div>
    </div>
  )
}

// ─── PAGINATION ────────────────────────────────────────────────────

function Pagination({ current, total, onChange }) {
  // Build the page number array with ellipsis for large ranges
  // Always show: first, last, current, and 1 on each side of current
  const pages = []
  const addPage = (n) => { if (n >= 1 && n <= total && !pages.includes(n)) pages.push(n) }

  addPage(1)
  addPage(current - 2)
  addPage(current - 1)
  addPage(current)
  addPage(current + 1)
  addPage(current + 2)
  addPage(total)
  pages.sort((a, b) => a - b)

  // Insert null as ellipsis marker where there are gaps
  const withEllipsis = []
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) withEllipsis.push(null)
    withEllipsis.push(pages[i])
  }

  const btnBase = {
    minWidth: 36, height: 36, borderRadius: 8, border: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 6, padding: '40px 0 24px', flexWrap: 'wrap',
    }}>
      {/* Prev */}
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        style={{
          ...btnBase,
          padding: '0 12px',
          background: current === 1 ? '#0d0d14' : '#111118',
          color: current === 1 ? '#374151' : '#9ca3af',
          border: '1px solid #1f2937',
          cursor: current === 1 ? 'not-allowed' : 'pointer',
        }}
      >
        ← Prev
      </button>

      {/* Page numbers */}
      {withEllipsis.map((p, i) =>
        p === null ? (
          <span key={`ellipsis-${i}`} style={{ color: '#374151', fontSize: 13, padding: '0 4px' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              ...btnBase,
              background: p === current ? 'rgba(74,222,128,0.15)' : '#111118',
              color: p === current ? '#4ade80' : '#9ca3af',
              border: `1px solid ${p === current ? 'rgba(74,222,128,0.4)' : '#1f2937'}`,
              cursor: p === current ? 'default' : 'pointer',
            }}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        style={{
          ...btnBase,
          padding: '0 12px',
          background: current === total ? '#0d0d14' : '#111118',
          color: current === total ? '#374151' : '#9ca3af',
          border: '1px solid #1f2937',
          cursor: current === total ? 'not-allowed' : 'pointer',
        }}
      >
        Next →
      </button>
    </div>
  )
}

// ─── SUBCOMPONENTS ─────────────────────────────────────────────────

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

function EmptyState({ search }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>{search ? '🔍' : '🎮'}</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: '#f9fafb', margin: '0 0 8px' }}>
        {search ? `No results for "${search}"` : 'No listings yet'}
      </h3>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
        {search ? 'Try different search terms or clear the filter.' : 'Be the first to post a listing!'}
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
