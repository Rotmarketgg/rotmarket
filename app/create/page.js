'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSessionUser, getProfile, createListing, updateListing, uploadListingImage, supabase } from '@/lib/supabase'
import { GAMES, RARITIES, PAYMENT_METHODS, LISTING_TYPES } from '@/lib/constants'
import { validateListing, checkRateLimit, withTimeout } from '@/lib/utils'
import { validateClean, validateContent } from '@/lib/profanity'

const MAX_IMAGE_SIZE_MB = 10
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

export default function CreateListingPage() {
  const router = useRouter()
  const fileInputRef = useRef(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [images, setImages] = useState([]) // [{file, preview}]
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    title: '',
    game: 'fortnite',
    rarity: '',
    type: 'sale',
    price: '',
    description: '',
    accepts: [],
    quantity: 1,
  })

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await getSessionUser()
        if (!currentUser) { router.push('/auth/login'); return }
        setUser(currentUser)
        const p = await getProfile(currentUser.id)
        setProfile(p)
        // Clear rate limit entries for privileged users — stale sessionStorage
        // from before their role was assigned would otherwise block them
        const badges = p?.badges?.length ? p.badges : p?.badge ? [p.badge] : []
        if (badges.some(b => ['VIP', 'Owner', 'Admin', 'Moderator'].includes(b))) {
          sessionStorage.removeItem('rl_listing')
          sessionStorage.removeItem('rl_listing_day')
        }
      } catch (err) {
        console.error('Auth check error:', err)
        router.push('/auth/login')
      }
    }
    checkAuth()
  }, [])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const togglePayment = (method) => {
    setForm(f => ({
      ...f,
      accepts: f.accepts.includes(method)
        ? f.accepts.filter(m => m !== method)
        : [...f.accepts, method]
    }))
  }

  const handleImages = (files) => {
    // Only allow 1 image per listing
    if (images.length >= 1) {
      setErrors(e => ({ ...e, images: 'Only one image is allowed. Remove the current image first.' }))
      return
    }
    const file = Array.from(files).find(f => f.type.startsWith('image/'))
    if (!file) return
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrors(e => ({ ...e, images: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 10 MB.` }))
      return
    }
    const reader = new FileReader()
    reader.onload = e => setImages([{ file, preview: e.target.result }])
    reader.readAsDataURL(file)
  }

  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    const errs = validateListing(form)
    const titleErr = validateClean(form.title, 'Title')
    const descErr = validateClean(form.description, 'Description')
    if (titleErr) errs.title = titleErr
    if (descErr) errs.description = descErr
    // Image is required
    if (images.length === 0) {
      errs.images = 'An image is required for your listing.'
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    // Wait for profile if it hasn't loaded yet (e.g. direct navigation)
    if (!profile && user) {
      setErrors({ general: 'Profile still loading — please try again in a moment.' })
      return
    }

    // Rate limit is bypassed for VIP, Owner, Admin, and Moderator users
    const profileBadges = profile?.badges?.length ? profile.badges : profile?.badge ? [profile.badge] : []
    const isPrivileged = profileBadges.some(b => ['Owner', 'VIP', 'Moderator', 'Admin'].includes(b))
    if (!isPrivileged) {
      const rl = checkRateLimit('listing')
      if (rl) { setErrors({ general: rl }); return }
      const rlDay = checkRateLimit('listing_daily')
      if (rlDay) { setErrors({ general: rlDay }); return }
    }
    setErrors({})
    setLoading(true)

    try {
      // Create listing first to get ID
      const listing = await createListing({
        user_id: user.id,
        title: form.title.trim(),
        game: form.game,
        rarity: form.rarity,
        type: form.type,
        price: form.type === 'sale' ? parseFloat(form.price) : null,
        description: form.description.trim(),
        accepts: form.type === 'sale' ? form.accepts : [],
        quantity: form.type === 'sale' ? Math.max(1, parseInt(form.quantity) || 1) : 1,
        images: [],
      })

      // Upload images — clean up listing if uploads fail
      let imageUrls = []
      try {
        for (let i = 0; i < images.length; i++) {
          const url = await uploadListingImage(images[i].file, listing.id, i)
          imageUrls.push(url)
        }
      } catch (uploadErr) {
        // Soft-delete the listing so we don't leave a ghost — consistent with rest of app
        await supabase.rpc('soft_delete_listing', { listing_id: listing.id })
        throw new Error('Image upload failed. Your listing was not created. Please try again.')
      }

      // Update with image URLs
      if (imageUrls.length > 0) {
        await updateListing(listing.id, { images: imageUrls }, user.id)
      }

      setSuccess(true)
      setTimeout(() => router.push(`/listing/${listing.id}`), 1200)
    } catch (err) {
      setErrors(e => ({ ...e, general: err.message || 'Failed to create listing. Please try again.' }))
    } finally {
      setLoading(false)
    }
  }

  const rarities = RARITIES[form.game] || RARITIES.fortnite



  if (success) return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', padding: 100 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ color: '#4ade80', margin: '0 0 8px' }}>Listing Created!</h2>
        <p style={{ color: '#9ca3af' }}>Redirecting to your listing...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 900, color: '#f9fafb', fontFamily: 'var(--font-display)' }}>
            Post a Listing
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>List your Brainrot for sale or trade.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Game select */}
          <Section title="Game" required>
            <div style={{ display: 'flex', gap: 10 }}>
              {GAMES.map(g => (
                <GameOption key={g.id} game={g} selected={form.game === g.id} onClick={() => { set('game', g.id); set('rarity', '') }} />
              ))}
            </div>
          </Section>

          {/* Title */}
          <Section title="Listing Title" required error={errors.title}>
            <input
              type="text"
              placeholder="e.g. Max Level Tralalero Tralala"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              maxLength={80}
            />
            <div style={{ fontSize: 11, color: '#4b5563', textAlign: 'right', marginTop: 4 }}>{form.title.length}/80</div>
          </Section>

          {/* Rarity */}
          <Section title="Rarity" required error={errors.rarity}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {rarities.map(r => (
                <button key={r.id}
                  onClick={() => set('rarity', r.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: form.rarity === r.id ? `${r.bg}cc` : '#111118',
                    color: form.rarity === r.id ? r.color : '#6b7280',
                    boxShadow: form.rarity === r.id ? `0 0 0 1px ${r.color}` : '0 0 0 1px #2d2d3f',
                    fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Type */}
          <Section title="Listing Type" required error={errors.type}>
            <div style={{ display: 'flex', gap: 10 }}>
              {LISTING_TYPES.map(t => (
                <button key={t.id}
                  onClick={() => {
                    set('type', t.id)
                    // Clear sale-only fields when switching to trade
                    if (t.id === 'trade') {
                      setForm(f => ({ ...f, type: 'trade', price: '', accepts: [], quantity: 1 }))
                    }
                  }}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: form.type === t.id ? 'rgba(74,222,128,0.2)' : '#111118',
                    color: form.type === t.id ? '#4ade80' : '#6b7280',
                    boxShadow: form.type === t.id ? '0 0 0 1px rgba(74,222,128,0.4)' : '0 0 0 1px #2d2d3f',
                    fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
                  }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Price (sale only) */}
          {form.type === 'sale' && (
            <Section title="Price (USD)" required error={errors.price}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 14 }}>$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                  min="0.01" step="0.01"
                  style={{ paddingLeft: 28 }}
                />
              </div>
            </Section>
          )}

          {/* Quantity (sale only) */}
          {form.type === 'sale' && (
            <Section title="Quantity" hint="How many copies of this item are you selling?">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0d0d14', border: '1px solid #2d2d3f', borderRadius: 10, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => set('quantity', Math.max(1, (parseInt(form.quantity) || 1) - 1))}
                    style={{ width: 40, height: 40, background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                  >−</button>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={e => set('quantity', Math.min(99, Math.max(1, parseInt(e.target.value) || 1)))}
                    min="1" max="99"
                    style={{ width: 48, textAlign: 'center', background: 'none', border: 'none', outline: 'none', fontSize: 16, fontWeight: 700, color: '#f9fafb', padding: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => set('quantity', Math.min(99, (parseInt(form.quantity) || 1) + 1))}
                    style={{ width: 40, height: 40, background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                  >+</button>
                </div>
                {form.quantity > 1 && (
                  <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>
                    {form.quantity}× · ${form.price ? (parseFloat(form.price) * form.quantity).toFixed(2) : '0.00'}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 8 }}>
                Each accepted offer deducts 1 from your quantity. The listing closes automatically when all {form.quantity > 1 ? form.quantity : ''} {form.quantity > 1 ? 'copies are' : 'copy is'} sold.
              </div>
            </Section>
          )}

          {/* Payment methods — only for sale listings */}
          {form.type === 'sale' && (
            <Section title="Accepted Payment Methods" required error={errors.accepts}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PAYMENT_METHODS.map(pm => (
                  <label key={pm.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    background: form.accepts.includes(pm.label) ? 'rgba(74,222,128,0.08)' : '#0d0d14',
                    border: form.accepts.includes(pm.label) ? '1px solid rgba(74,222,128,0.3)' : '1px solid #2d2d3f',
                    transition: 'all 0.15s',
                  }}>
                    <input
                      type="checkbox"
                      checked={form.accepts.includes(pm.label)}
                      onChange={() => togglePayment(pm.label)}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    <span style={{ fontSize: 16 }}>{pm.emoji}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pm.label}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{pm.note}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Section>
          )}

          {/* Description */}
          <Section title="Description" hint="Optional — tell buyers about condition, level, etc.">
            <textarea
              rows={4}
              placeholder="e.g. Max level, fully evolved. Screenshots available on request. Happy to go first if you have 20+ trades."
              value={form.description}
              onChange={e => set('description', e.target.value)}
              maxLength={500}
              style={{ resize: 'vertical' }}
            />
            <div style={{ fontSize: 11, color: '#4b5563', textAlign: 'right', marginTop: 4 }}>{form.description.length}/500</div>
          </Section>

          {/* Images */}
          <Section title="Image" required hint="1 image required. Max 10MB." error={errors.images}>
            {images.length === 0 && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleImages(e.dataTransfer.files) }}
                style={{
                  border: '2px dashed #2d2d3f', borderRadius: 12, padding: 24,
                  textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s',
                  marginBottom: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#4ade80'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#2d2d3f'}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Click or drag an image here</div>
                <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>PNG, JPG, WebP, GIF · max 10 MB</div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImages(e.target.files)} />
              </div>
            )}

            {images.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {images.map(({ preview }, i) => (
                  <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                    <img src={preview} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #2d2d3f' }} />
                    {i === 0 && <div style={{ position: 'absolute', bottom: 2, left: 2, fontSize: 8, background: 'rgba(74,222,128,0.9)', color: '#000', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>MAIN</div>}
                    <button
                      onClick={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                        borderRadius: '50%', background: '#ef4444', border: 'none',
                        color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Terms reminder */}
          <div style={{
            background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#92400e', lineHeight: 1.6,
          }}>
            ⚠️ By posting, you agree to RotMarket's Terms of Service. Do not list stolen items or misrepresent your item. Violations result in permanent bans.
          </div>

          {/* General / rate-limit errors */}
          {errors.general && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#f87171', fontWeight: 600 }}>
              ⚠️ {errors.general}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary"
            style={{ fontSize: 15, padding: '14px 0' }}
          >
            {loading ? '⏳ Creating Listing...' : '🚀 Post Listing'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, required, hint, error }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: '#d1d5db' }}>
          {title} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: 11, color: '#6b7280' }}>— {hint}</span>}
      </div>
      {children}
      {error && <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>⚠️ {error}</div>}
    </div>
  )
}

function GameOption({ game, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '14px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
        background: selected ? 'rgba(74,222,128,0.1)' : '#111118',
        boxShadow: selected ? `0 0 0 1px ${game.color}` : '0 0 0 1px #2d2d3f',
        transition: 'all 0.15s', textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 4 }}>{game.emoji}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: selected ? game.color : '#6b7280' }}>{game.label}</div>
    </button>
  )
}
