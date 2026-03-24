// Route-level layout — exports metadata for /leaderboard so Google sees real
// <title> and OG tags even though page.js is 'use client'.

export const metadata = {
  title: 'Trader Leaderboard — RotMarket',
  description:
    'See the top Brainrot traders on RotMarket. Ranked by completed trades, rating, and reputation. Become a Verified Trader.',
  alternates: { canonical: 'https://rotmarket.net/leaderboard' },
  openGraph: {
    title: 'Trader Leaderboard — RotMarket',
    description:
      'Top Brainrot traders ranked by trades, rating, and reputation on RotMarket.',
    url: 'https://rotmarket.net/leaderboard',
    siteName: 'RotMarket',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Trader Leaderboard — RotMarket',
    description: 'Top Brainrot traders on RotMarket ranked by completed trades and rating.',
  },
}

export default function LeaderboardLayout({ children }) {
  return children
}
