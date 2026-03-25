// ─── SERVER COMPONENT ────────────────────────────────────────────
// This file has NO 'use client' — it runs on the server so Next.js can
// generate per-listing <title> and Open Graph tags before sending HTML.
// Google, Discord, and Twitter all read these tags from the raw HTML.
//
// The interactive UI lives in ListingPageClient.js ('use client').

import { createClient } from '@supabase/supabase-js'
import ListingPageClient from './ListingPageClient'

async function getListingMeta(id) {
  if (!id || id === 'undefined') return null
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    )
    const { data } = await supabase
      .from('listings')
      .select('title, game, rarity, type, price, images, profiles(username)')
      .eq('id', id)
      .neq('status', 'deleted')
      .single()
    return data
  } catch {
    return null
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const listing = await getListingMeta(id)

  if (!listing) {
    return {
      title: 'Listing Not Found — RotMarket',
      description: 'This listing could not be found on RotMarket.',
    }
  }

  const gameLabel = listing.game === 'fortnite' ? 'Fortnite Brainrot' : 'Roblox Brainrot'
  const typeLabel = listing.type === 'sale' ? 'for sale' : 'for trade'
  const priceStr  = listing.price ? ` — $${Number(listing.price).toFixed(2)}` : ''
  const seller    = listing.profiles?.username ? ` by ${listing.profiles.username}` : ''
  const rarityStr = listing.rarity ? listing.rarity.replace(/_/g, ' ') : ''

  const title       = `${listing.title} | RotMarket`
  const description = `${rarityStr} ${gameLabel} ${typeLabel}${priceStr}${seller}. Trade safely on RotMarket — the trusted Brainrot marketplace with verified sellers and a reputation system.`
  const image       = listing.images?.[0] ?? null
  const url         = `https://rotmarket.net/listing/${id}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: 'website',
      url,
      siteName: 'RotMarket',
      ...(image ? { images: [{ url: image, width: 800, height: 600, alt: listing.title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

// Pass the id as a prop so the client component can read it without
// useParams() on the first render — avoids a flash of empty state.
export default async function ListingPage({ params }) {
  const { id } = await params
  return <ListingPageClient id={id} />
}
