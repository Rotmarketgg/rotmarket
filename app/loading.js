'use client'

import { useEffect } from 'react'

export default function Loading() {
  useEffect(() => {
    // If stuck on loading for more than 5 seconds, hard reload the page.
    // This handles the case where a JS error during hydration leaves the
    // loading screen permanently visible.
    const timer = setTimeout(() => {
      window.location.reload()
    }, 5000)
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
      </div>
    </div>
  )
}
