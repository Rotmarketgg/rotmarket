export default function Loading() {
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
