// ─── SERVER COMPONENT ────────────────────────────────────────────
// No 'use client' — generates static metadata so Google can index /browse.
// Interactive filters and listings live in BrowsePageClient.js.

import BrowsePageClient from './BrowsePageClient'

export const metadata = {
  title: 'Browse Brainrot Listings — RotMarket',
  description: 'Browse all Fortnite Brainrot and Roblox Brainrot listings on RotMarket. Filter by game, type, and rarity. Buy, sell, or trade with verified sellers.',
  alternates: { canonical: 'https://rotmarket.net/browse' },
  openGraph: {
    title: 'Browse Brainrot Listings — RotMarket',
    description: 'Browse all Fortnite Brainrot and Roblox Brainrot listings. Filter by game, rarity, and type.',
    url: 'https://rotmarket.net/browse',
    siteName: 'RotMarket',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Browse Brainrot Listings — RotMarket',
    description: 'Browse Fortnite Brainrot and Roblox Brainrot listings. Buy, sell, or trade.',
  },
}

export default function BrowsePage() {
  return <BrowsePageClient />
}
