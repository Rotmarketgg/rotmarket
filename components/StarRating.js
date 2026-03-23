'use client'

import { useId } from 'react'

// Supports half-star display (e.g. 3.2 = 3 full + 1 half star)
// Interactive mode for review submission (whole stars only)
export default function StarRating({ rating = 0, size = 14, interactive = false, onChange, showValue = false }) {
  // useId gives a stable ID across server/client — Math.random() caused hydration mismatches
  const reactId = useId()
  const id = `star-half-${reactId.replace(/:/g, '')}`
  const stars = [1, 2, 3, 4, 5]

  const getStarFill = (star) => {
    if (interactive) {
      return star <= Math.round(rating) ? 'full' : 'empty'
    }
    // diff = how much of this star position is filled (0–1)
    // >= 0.75 → full star  (e.g. 4.8 → star 5 gets diff 0.8 → full)
    // >= 0.25 → half star  (e.g. 4.5 → star 5 gets diff 0.5 → half)
    //  < 0.25 → empty      (e.g. 4.1 → star 5 gets diff 0.1 → empty)
    const diff = rating - (star - 1)
    if (diff >= 0.75) return 'full'
    if (diff >= 0.25) return 'half'
    return 'empty'
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
      {stars.map((s) => {
        const fill = getStarFill(s)
        return (
          <svg
            key={s}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={fill === 'full' ? '#f59e0b' : fill === 'half' ? `url(#${id})` : 'none'}
            stroke="#f59e0b"
            strokeWidth="2"
            style={{ cursor: interactive ? 'pointer' : 'default', transition: 'transform 0.1s', flexShrink: 0 }}
            onClick={() => interactive && onChange?.(s)}
            onMouseEnter={e => interactive && (e.currentTarget.style.transform = 'scale(1.2)')}
            onMouseLeave={e => interactive && (e.currentTarget.style.transform = 'scale(1)')}
          >
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        )
      })}
      {showValue && rating > 0 && (
        <span style={{ fontSize: size * 0.85, color: '#f59e0b', fontWeight: 700, marginLeft: 3 }}>
          {rating.toFixed(1)}
        </span>
      )}
    </span>
  )
}
