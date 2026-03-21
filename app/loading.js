'use client'

import { useEffect, useState } from 'react'

export default function Loading() {
  const [showRetry, setShowRetry] = useState(false)

  useEffect(() => {
    // Show a "Tap to refresh" button after 8 seconds instead of auto-reloading.
    // Auto-reload caused infinite reload loops on slow connections.
    const timer = setTimeout(() => setShowRetry(true), 8000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🎮</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Loading...</div>
        {showRetry && (
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20, padding: '9px 20px',
              background: 'rgba(74,222,128,0.12)',
              border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: 8, color: '#4ade80',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'block', margin: '16px auto 0',
            }}
          >
            Taking too long? Tap to refresh
          </button>
        )}
      </div>
    </div>
  )
}
