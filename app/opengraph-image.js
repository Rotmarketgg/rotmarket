import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'RotMarket — Brainrot Trading Marketplace'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow blobs */}
        <div style={{
          position: 'absolute', top: -100, left: -100,
          width: 600, height: 600, borderRadius: '50%',
          background: 'rgba(74,222,128,0.06)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -150, right: -100,
          width: 500, height: 500, borderRadius: '50%',
          background: 'rgba(96,165,250,0.05)',
          display: 'flex',
        }} />

        {/* Top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #4ade80, #22c55e, transparent)',
          display: 'flex',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <span style={{
            fontSize: 80, fontWeight: 900, color: '#4ade80',
            fontFamily: 'sans-serif', letterSpacing: '-2px', lineHeight: 1,
          }}>ROT</span>
          <span style={{
            fontSize: 80, fontWeight: 900, color: '#ffffff',
            fontFamily: 'sans-serif', letterSpacing: '-2px', lineHeight: 1,
          }}>MARKET</span>
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 28, color: '#9ca3af', fontFamily: 'sans-serif',
          fontWeight: 500, textAlign: 'center', maxWidth: 700,
          lineHeight: 1.4, marginBottom: 48,
        }}>
          The trusted marketplace for Fortnite & Roblox Brainrot trades
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { icon: '✓', label: 'Verified Traders' },
            { icon: '⭐', label: 'Reputation System' },
            { icon: '🛡️', label: 'Safe Trades' },
          ].map((item) => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 100, padding: '10px 20px',
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ fontSize: 18, color: '#d1d5db', fontFamily: 'sans-serif', fontWeight: 600 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Domain */}
        <div style={{
          position: 'absolute', bottom: 32,
          fontSize: 20, color: '#374151',
          fontFamily: 'sans-serif', fontWeight: 600,
          letterSpacing: '0.05em',
        }}>
          rotmarket.net
        </div>
      </div>
    ),
    { ...size }
  )
}
