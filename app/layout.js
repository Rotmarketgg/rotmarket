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
  openGraph: {
    title: 'RotMarket — Brainrot Trading Marketplace',
    description: 'The trusted marketplace to buy, sell, and trade Brainrots.',
    type: 'website',
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="bg-rot-dark text-white font-body antialiased min-h-screen">
        <BanGate>{children}</BanGate>
      </body>
    </html>
  )
}
