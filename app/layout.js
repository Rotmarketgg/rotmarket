import './globals.css'

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
    <html lang="en">
      <body className="bg-rot-dark text-white font-body antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
