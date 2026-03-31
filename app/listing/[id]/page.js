// ─── SERVER COMPONENT ────────────────────────────────────────────
// Runs on the server to generate per-listing <title> and OG tags.
// Also fetches the full listing and passes it as a prop to the client
// component — eliminating the double-fetch (server for meta + client on mount).

import { createClient } from '@supabase/supabase-js'
import ListingPageClient from './ListingPageClient'

async function getListing(id) {
  if (!id || id === 'undefined') return null
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    )
    const { data } = await supabase
      .from('listings')
      .select(`
        *,
        profiles (
          id, username, epic_username, roblox_username,
          trade_count, rating, review_count, badge, badges, avatar_url, bio
        )
      `)
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
  const listing = await getListing(id)

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

// Pass id AND the pre-fetched listing as props — client component uses the
// prefetched data on first render and only re-fetches on tab-return / updates.
export default async function ListingPage({ params }) {
  const { id } = await params
  const initialListing = await getListing(id)
  return <ListingPageClient id={id} initialListing={initialListing} />
}
