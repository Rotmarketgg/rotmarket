'use client'

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body style={{ background: '#0a0a0f', margin: 0, fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>💥</div>
        <h2 style={{ color: '#f9fafb', margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Something went wrong</h2>
        <p style={{ color: '#6b7280', margin: '0 0 24px', fontSize: 14 }}>An unexpected error occurred.</p>
        <button
          onClick={() => reset()}
          style={{ padding: '11px 24px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Try Again
        </button>
      </body>
    </html>
  )
}
