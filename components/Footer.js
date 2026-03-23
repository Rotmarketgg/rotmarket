import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid #1f2937',
      marginTop: 64,
      padding: '24px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
        RotMarket is not affiliated with Epic Games or Roblox Corporation.
        Trade at your own risk.{' '}
        <Link href="/terms" style={{ color: '#4b5563', textDecoration: 'underline' }}>Terms of Service</Link>
        {' · '}
        <Link href="/privacy" style={{ color: '#4b5563', textDecoration: 'underline' }}>Privacy Policy</Link>
      </div>
    </footer>
  )
}
