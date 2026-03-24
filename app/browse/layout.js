// Route-level layout — exports metadata for /browse so Google sees real
// <title> and OG tags even though page.js is 'use client'.
// Next.js merges metadata from layout + page, with page taking precedence
// for any keys it defines. Since page.js defines none, this layout's
// metadata is what the crawler sees.

export const metadata = {
  title: 'Browse Brainrot Listings — RotMarket',
  description:
    'Browse all Fortnite Brainrot and Roblox Brainrot listings on RotMarket. Filter by game, type, and rarity. Buy, sell, or trade with verified sellers.',
  alternates: { canonical: 'https://rotmarket.net/browse' },
  openGraph: {
    title: 'Browse Brainrot Listings — RotMarket',
    description:
      'Browse all Fortnite Brainrot and Roblox Brainrot listings. Filter by game, rarity, and type.',
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

export default function BrowseLayout({ children }) {
  return children
}
