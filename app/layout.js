import { Barlow_Condensed, DM_Sans } from 'next/font/google'
import './globals.css'
import BanGate from '@/components/BanGate'

const displayFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-display',
})

const bodyFont = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
})

export const metadata = {
  title: 'RotMarket — Brainrot Trading Marketplace',
  description: 'The trusted marketplace to buy, sell, and trade Brainrots in Fortnite Brainrot and Roblox Brainrot. Verified traders, reputation system, safe trades.',
  keywords: 'Fortnite Brainrot, Roblox Brainrot, Brainrot marketplace, Brainrot trade, RotMarket',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.svg',
  },
  openGraph: {
    title: 'RotMarket — Brainrot Trading Marketplace',
    description: 'The trusted marketplace to buy, sell, and trade Brainrots in Fortnite Brainrot and Roblox Brainrot.',
    type: 'website',
    url: 'https://rotmarket.net',
    siteName: 'RotMarket',
  },
}

// Derive hostname from the env var so it never drifts from the actual project URL.
// Falls back to the hardcoded value so local dev without .env still works.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iuskguniacqeeaqscpfj.supabase.co').host
  } catch { return 'iuskguniacqeeaqscpfj.supabase.co' }
})()

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <head>
        {/* Preconnect to Supabase for faster first query — URL derived from env var */}
        <link rel="preconnect" href={`https://${supabaseHost}`} />
        <link rel="dns-prefetch" href={`https://${supabaseHost}`} />
      </head>
      <body className="bg-rot-dark text-white font-body antialiased min-h-screen">
        <BanGate>{children}</BanGate>
      </body>
    </html>
  )
}
