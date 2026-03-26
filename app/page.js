'use client'

import { useState, useEffect, useCallback } from 'react'
import { withTimeout } from '@/lib/utils'
import Navbar from '@/components/Navbar'
import ListingCard, { ListingCardSkeleton } from '@/components/ListingCard'
import { getListings } from '@/lib/supabase'
import Link from 'next/link'

const PAGE_SIZE = 20

export default function HomePage() {
  const [listings, setListings] = useState([])
  const [loading, setLoading]   = useState(true)

  const fetchListings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data } = await withTimeout(getListings({
        status: 'active',
        limit: PAGE_SIZE,
        offset: 0,
      }), silent ? 8000 : 20000)
      setListings(data || [])
    } catch (err) {
      console.error('Listings load error:', err.message)
      if (!silent) setListings([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { fetchListings() }, [fetchListings])

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

      {/* Latest listings */}
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 16px 0' }}>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, flexWrap: 'wrap', gap: 8,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f9fafb' }}>
            🕐 Latest Listings
          </h2>
          <Link href="/browse" style={{
            fontSize: 13, fontWeight: 600, color: '#4ade80',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            Browse all listings →
          </Link>
        </div>

        {loading ? (
          <div className="listing-grid">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎮</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#f9fafb', margin: '0 0 8px' }}>
              No listings yet
            </h3>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
              Be the first to list a Brainrot!
            </p>
            <Link href="/create" style={{
              display: 'inline-block', padding: '11px 24px',
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              color: '#fff', textDecoration: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 700,
            }}>Post First Listing</Link>
          </div>
        ) : (
          <>
            <div className="listing-grid animate-fade-in">
              {listings.map((listing, i) => (
                <div key={listing.id} style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }} className="animate-slide-up">
                  <ListingCard listing={listing} />
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', padding: '40px 0 16px' }}>
              <Link href="/browse" style={{
                display: 'inline-block', padding: '12px 32px', borderRadius: 10,
                background: 'transparent', border: '1px solid #2d2d3f',
                color: '#9ca3af', textDecoration: 'none',
                fontSize: 14, fontWeight: 600,
              }}>Browse All Listings</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
