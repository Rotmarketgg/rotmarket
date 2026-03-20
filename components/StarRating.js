'use client'

export default function StarRating({ rating = 0, size = 14, interactive = false, onChange }) {
  const stars = [1, 2, 3, 4, 5]

  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {stars.map((s) => (
        <svg
          key={s}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={s <= Math.round(rating) ? '#f59e0b' : 'none'}
          stroke="#f59e0b"
          strokeWidth="2"
          style={{ cursor: interactive ? 'pointer' : 'default', transition: 'transform 0.1s' }}
          onClick={() => interactive && onChange?.(s)}
          onMouseEnter={e => interactive && (e.currentTarget.style.transform = 'scale(1.2)')}
          onMouseLeave={e => interactive && (e.currentTarget.style.transform = 'scale(1)')}
        >
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </span>
  )
}
