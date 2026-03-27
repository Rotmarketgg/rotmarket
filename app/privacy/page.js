
export const metadata = { title: 'Privacy Policy — RotMarket' }

export default function PrivacyPage() {
  const sections = [
    {
      title: 'What We Collect',
      content: `We collect your email address (for account creation), username, in-game usernames you provide, payment handles you choose to display publicly, and listing data you submit. We also collect standard server logs (IP address, browser type) for security purposes.`,
    },
    {
      title: 'How We Use Your Data',
      content: `Your data is used to operate the platform: showing your listings, enabling messaging between traders, and maintaining your reputation/review history. We do not sell your data to third parties. We do not use your data for advertising.`,
    },
    {
      title: 'What Is Public',
      content: `Your username, in-game usernames, payment handles, listings, reviews, trade count, and rating are publicly visible to all users. Your email address is never shown publicly.`,
    },
    {
      title: 'Data Storage',
      content: `Your data is stored securely in Supabase (PostgreSQL database hosted on AWS infrastructure). Listing images are stored in Supabase Storage. We use industry-standard encryption for data at rest and in transit.`,
    },
    {
      title: 'Cookies',
      content: `We use essential cookies only — specifically the authentication session cookie required to keep you logged in. We do not use tracking or advertising cookies.`,
    },
    {
      title: 'Your Rights',
      content: `You can edit or delete your profile information at any time in Settings. You can delete your listings at any time. To request full account deletion including all associated data, contact us through the platform.`,
    },
    {
      title: 'Children',
      content: `RotMarket is not intended for users under 13. If you believe a user under 13 has created an account, please report it through the platform.`,
    },
    {
      title: 'Changes',
      content: `We may update this policy. Continued use of RotMarket after changes constitutes acceptance of the updated policy.`,
    },
  ]

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 32, fontWeight: 900, color: '#f9fafb', fontFamily: 'var(--font-display)' }}>
          Privacy Policy
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
      </div>
    </div>
  )
}
