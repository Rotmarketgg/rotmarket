import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', textAlign: 'center', padding: 24,
    }}>
      <div style={{ fontSize: 80, marginBottom: 16 }}>🦈</div>
      <h1 style={{ margin: '0 0 8px', fontSize: 48, fontWeight: 900, color: '#f9fafb', fontFamily: 'var(--font-display)' }}>
        404
      </h1>
      <p style={{ margin: '0 0 8px', fontSize: 18, color: '#6b7280' }}>This page doesn't exist.</p>
      <p style={{ margin: '0 0 28px', fontSize: 13, color: '#4b5563' }}>Maybe the listing was sold or the URL is wrong.</p>
      <Link href="/" style={{
        display: 'inline-block', padding: '12px 28px',
        background: 'linear-gradient(135deg, #16a34a, #15803d)',
        color: '#fff', textDecoration: 'none', borderRadius: 10,
        fontSize: 14, fontWeight: 700,
        boxShadow: '0 4px 20px rgba(22,163,74,0.4)',
      }}>
        Back to RotMarket
      </Link>
    </div>
  )
}
