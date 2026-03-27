import Link from 'next/link'
import Navbar from '@/components/Navbar'

export const metadata = { title: 'Terms of Service — RotMarket' }

export default function TermsPage() {
  const sections = [
    {
      title: '1. Platform Role',
      content: `RotMarket is a listing platform that connects buyers and sellers of in-game Brainrot items. We do not process, hold, or guarantee any payments between users. All transactions occur directly between traders.`,
    },
    {
      title: '2. User Accounts',
      content: `You must be at least 13 years old to create an account. You are responsible for all activity under your account. You must provide accurate information including your in-game username.`,
    },
    {
      title: '3. Listings',
      content: `Listings must accurately represent the item being sold or traded. Do not list items you do not own or cannot deliver. Misrepresentation of items is grounds for permanent ban. All listings must be for items from Steal the Brainrot (Fortnite) or Roblox Brainrot games.`,
    },
    {
      title: '4. Payments & Trades',
      content: `RotMarket does not process payments. Buyers and sellers agree on payment terms directly. We strongly recommend using payment methods that include buyer protection where possible. RotMarket is not responsible for lost funds, scams, or failed trades.`,
    },
    {
      title: '5. Prohibited Activity',
      content: `The following are prohibited: scamming or fraudulent listings, harassment of other users, creating multiple accounts to evade bans, listing stolen items or items you do not have the right to sell, and any activity that violates applicable laws.`,
    },
    {
      title: '6. Reviews & Reputation',
      content: `Reviews must be honest and based on real trade experiences. Fake reviews, review bombing, or manipulation of the reputation system will result in account termination. RotMarket reserves the right to remove reviews that violate these terms.`,
    },
    {
      title: '7. Third Party Platforms',
      content: `RotMarket is not affiliated with or endorsed by Epic Games or Roblox Corporation. Use of this platform does not violate any agreement with these companies as we facilitate community-to-community item trading, not official platform trading.`,
    },
    {
      title: '8. Termination',
      content: `RotMarket reserves the right to suspend or permanently ban any account that violates these terms, at our sole discretion. We may remove any listing at any time.`,
    },
    {
      title: '9. Disclaimer',
      content: `RotMarket is provided "as is" without warranties of any kind. We are not liable for any losses resulting from use of this platform, including scams, failed trades, or platform downtime.`,
    },
  ]

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 32, fontWeight: 900, color: '#f9fafb', fontFamily: 'var(--font-display)' }}>
          Terms of Service
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: 13, color: '#6b7280' }}>Last updated: March 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sections.map(s => (
            <div key={s.title} style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 12, padding: '16px 20px' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#f9fafb' }}>{s.title}</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.7 }}>{s.content}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          Questions? <Link href="/contact" style={{ color: '#4ade80' }}>Contact us</Link>
        </div>
      </div>
    </div>
  )
}
