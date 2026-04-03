'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { clearProfileCache } from '@/components/Navbar'
import { getSessionUser, getVerifiedUser, getProfile, updateProfile, supabase } from '@/lib/supabase'
import { withTimeout, getInitial } from '@/lib/utils'
import { getVipAccessTier } from '@/lib/constants'
import { validateClean } from '@/lib/profanity'

export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0f' }} />}>
      <SettingsPage />
    </Suspense>
  )
}

function SettingsPage() {
  const router = useRouter()
  const avatarInputRef = useRef(null)

  const [user, setUser] = useState(null)
  const [profileUsername, setProfileUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [vipExpiresAt, setVipExpiresAt] = useState(null)
  const [referralCopied, setReferralCopied] = useState(false)
  const [profileBadges, setProfileBadges] = useState([])
  const [wishlistInput, setWishlistInput] = useState('')
  const [wishlistSaved, setWishlistSaved] = useState(false)

  const [form, setForm] = useState({
    epic_username: '',
    roblox_username: '',
    paypal_email: '',
    cashapp_handle: '',
    venmo_handle: '',
    bio: '',
    avatar_url: '',
    profile_url: '',
  })

  useEffect(() => {
    async function load() {
      try {
      const { user: u, redirect, unverified } = await getVerifiedUser()
      if (redirect) { router.push('/auth/login'); return }
      if (unverified) { router.push('/auth/verify'); return }
      setUser(u)
      const p = await getProfile(u.id)
      if (p) {
        const badges = p.badges?.length ? p.badges : p.badge ? [p.badge] : []
        setProfileBadges(badges)
        setProfileUsername(p.username || '')
        setForm({
          epic_username: p.epic_username || '',
          roblox_username: p.roblox_username || '',
          paypal_email: p.paypal_email || '',
          cashapp_handle: p.cashapp_handle || '',
          venmo_handle: p.venmo_handle || '',
          bio: p.bio || '',
          avatar_url: p.avatar_url || '',
          profile_url: p.profile_url || '',
        })
        if (p.avatar_url) setAvatarPreview(p.avatar_url)
        setReferralCode(p.referral_code || '')
        setReferralCount(p.referral_count || 0)
        setVipExpiresAt(p.vip_expires_at || null)
      }
      setLoading(false)
      } catch (err) {
        console.error('Settings load error:', err)
        setLoading(false)
      }
    }
    load()
  }, [])

  const vipAccessTier = getVipAccessTier(profileBadges)
  const canUseWishlistAlerts = vipAccessTier === 'VIP Plus' || vipAccessTier === 'VIP Max'

  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(`rotmarket-wishlist:${user.id}`)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed) && parsed.length > 0) {
        setWishlistInput(parsed.join(', '))
      } else {
        setWishlistInput('')
      }
    } catch {
      setWishlistInput('')
    }
  }, [user?.id])

  const persistWishlist = () => {
    if (!user?.id) return
    const next = Array.from(new Set(
      wishlistInput
        .split(/[,\n]/)
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    )).slice(0, 20)
    try {
      localStorage.setItem(`rotmarket-wishlist:${user.id}`, JSON.stringify(next))
      setWishlistSaved(true)
      setTimeout(() => setWishlistSaved(false), 2000)
    } catch {}
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or GIF).')
      return
    }
    if (file.size > 2 * 1024 * 1024) { setError('Avatar must be under 2MB.'); return }
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = e => setAvatarPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const uploadAvatar = async (userId) => {
    if (!avatarFile) return form.avatar_url
    setAvatarUploading(true)
    try {
      // Derive extension from MIME type — never trust file.name which can be spoofed
      const mimeToExt = {
        'image/jpeg': 'jpg', 'image/jpg': 'jpg',
        'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
      }
      const ext = mimeToExt[avatarFile.type]
      if (!ext) throw new Error('Unsupported image format.')
      const path = `avatars/${userId}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
      if (uploadError) {
        if (uploadError.message?.includes('Bucket not found')) {
          throw new Error('Avatar uploads are not configured yet. Please contact support.')
        }
        throw uploadError
      }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      return publicUrl
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSave = async () => {
    const bioErr = validateClean(form.bio, 'Bio')
    if (bioErr) { setError(bioErr); return }
    // Validate profile URL — must be http/https to prevent javascript: XSS
    if (form.profile_url.trim() && !/^https?:\/\//i.test(form.profile_url.trim())) {
      setError('Profile link must start with https:// or http://')
      return
    }
    setError('')
    setSaving(true)
    try {
      const avatarUrl = await uploadAvatar(user.id)
      await updateProfile(user.id, {
        epic_username: form.epic_username.trim() || null,
        roblox_username: form.roblox_username.trim() || null,
        paypal_email: form.paypal_email.trim() || null,
        cashapp_handle: form.cashapp_handle.trim() || null,
        venmo_handle: form.venmo_handle.trim() || null,
        bio: form.bio.trim() || null,
        avatar_url: avatarUrl || null,
        profile_url: form.profile_url.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Bust the Navbar profile cache so updated avatar/username shows immediately
      clearProfileCache()
      if (canUseWishlistAlerts) persistWishlist()
    } catch (err) {
      setError(err.message || 'Failed to save. Username may already be taken.')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    setPasswordMsg({ type: '', text: '' })
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/update-password`,
    })
    if (!error) {
      setPasswordMsg({ type: 'success', text: `Reset link sent to ${user.email} — check your inbox.` })
    } else {
      setPasswordMsg({ type: 'error', text: 'Failed to send reset email. Please try again.' })
    }
  }


  if (loading) return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', padding: 80, color: '#6b7280' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px 60px' }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 900, color: '#f9fafb', fontFamily: 'var(--font-display)' }}>
            Account Settings
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            Manage your public profile and payment info.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Avatar */}
          <Section title="Profile Picture">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div
                onClick={() => avatarInputRef.current?.click()}
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: avatarPreview ? 'transparent' : 'linear-gradient(135deg, #4ade80, #22c55e)',
                  border: '2px solid #2d2d3f', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#4ade80'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#2d2d3f'}
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28, fontWeight: 900, color: '#0a0a0f', fontFamily: 'var(--font-display)' }}>{getInitial(profileUsername)}</span>
                }
              </div>
              <div>
                <button onClick={() => avatarInputRef.current?.click()} className="btn-ghost" style={{ fontSize: 12, marginBottom: 6 }} type="button">
                  {avatarPreview ? 'Change Photo' : 'Upload Photo'}
                </button>
                <div style={{ fontSize: 11, color: '#4b5563' }}>PNG, JPG up to 2MB</div>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>
          </Section>

          {/* Public Profile */}
          <Section title="Public Profile">
            <div style={{ padding: '8px 12px', background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Username</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb' }}>{profileUsername}</div>
              <div style={{ marginLeft: 'auto', fontSize: 11, color: '#4b5563' }}>Set at signup · cannot be changed</div>
            </div>
            <Field label="Bio" hint="Optional — tell traders about yourself">
              <textarea
                rows={3}
                placeholder="Max level collector. 47 clean trades. Happy to go first."
                value={form.bio}
                onChange={e => set('bio', e.target.value)}
                maxLength={200}
                style={{ resize: 'vertical' }}
              />
            </Field>

            <Field label="Profile Link" hint="Discord, YouTube, Twitter, etc.">
              <input
                type="url"
                placeholder="https://discord.gg/yourserver"
                value={form.profile_url}
                onChange={e => set('profile_url', e.target.value)}
              />
            </Field>
          </Section>

          {/* Game Usernames */}
          <Section title="Game Usernames">
            <Field label="Epic Games Username" hint="For Fortnite Brainrot trades">
              <input type="text" placeholder="Your Epic username" value={form.epic_username} onChange={e => set('epic_username', e.target.value)} />
            </Field>
            <Field label="Roblox Username" hint="For Roblox Brainrot trades">
              <input type="text" placeholder="Your Roblox username" value={form.roblox_username} onChange={e => set('roblox_username', e.target.value)} />
            </Field>
          </Section>

          {/* Payment Info */}
          <Section title="Payment Info" hint="Shown to buyers only after you accept their offer">
            <Field label="PayPal Email" hint="Recommended — buyer protection">
              <input type="email" placeholder="you@paypal.com" value={form.paypal_email} onChange={e => set('paypal_email', e.target.value)} />
            </Field>
            <Field label="Cash App Handle">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>$</span>
                <input type="text" placeholder="YourHandle" value={form.cashapp_handle.replace('$', '')} onChange={e => set('cashapp_handle', '$' + e.target.value.replace('$', ''))} style={{ paddingLeft: 28 }} />
              </div>
            </Field>
            <Field label="Venmo Handle">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>@</span>
                <input type="text" placeholder="YourHandle" value={form.venmo_handle.replace('@', '')} onChange={e => set('venmo_handle', '@' + e.target.value.replace('@', ''))} style={{ paddingLeft: 28 }} />
              </div>
            </Field>
          </Section>

          {/* Account */}
          <Section title="Account">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1f2937', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db' }}>Email</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{user?.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db' }}>Password</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Change your account password</div>
              </div>
              <button onClick={handlePasswordChange} className="btn-ghost" style={{ fontSize: 12 }} type="button">
                Send Reset Email
              </button>
            </div>
            {passwordMsg.text && (
              <div style={{
                background: passwordMsg.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${passwordMsg.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: 8, padding: '10px 14px', fontSize: 13,
                color: passwordMsg.type === 'success' ? '#4ade80' : '#f87171',
                marginTop: 4,
              }}>
                {passwordMsg.type === 'success' ? '✓' : '⚠️'} {passwordMsg.text}
              </div>
            )}
          </Section>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Referral Section */}
          <Section title="🔗 Referral Program" hint="Invite friends, earn rewards">
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
              Share your unique link. Friends who sign up get a{' '}
              <span style={{ color: '#a78bfa', fontWeight: 700 }}>Referred</span> badge.
              You earn <span style={{ color: '#f59e0b', fontWeight: 700 }}>time-limited VIP</span> at 5, 10, and 25 referrals — with <strong style={{ color: '#f59e0b' }}>Lifetime VIP</strong> at 25.
            </div>

            {referralCode ? (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
                  <div style={{
                    flex: 1, minWidth: 180,
                    background: '#0d0d14', border: '1px solid #2d2d3f', borderRadius: 8,
                    padding: '10px 14px', fontFamily: 'monospace', fontSize: 16,
                    fontWeight: 800, color: '#4ade80', letterSpacing: '0.15em',
                  }}>
                    {referralCode}
                  </div>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/auth/signup?ref=${referralCode}`
                      navigator.clipboard.writeText(url).then(() => {
                        setReferralCopied(true)
                        setTimeout(() => setReferralCopied(false), 2000)
                      })
                    }}
                    style={{
                      padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: referralCopied ? 'rgba(74,222,128,0.15)' : '#1f2937',
                      color: referralCopied ? '#4ade80' : '#f9fafb',
                      fontSize: 13, fontWeight: 700, transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                  >
                    {referralCopied ? '✓ Copied!' : '📋 Copy Link'}
                  </button>
                </div>

                {/* Tier progress */}
                {[
                  { threshold: 5,  days: '30-day VIP',   label: '5 refs' },
                  { threshold: 10, days: '90-day VIP',   label: '10 refs' },
                  { threshold: 25, days: 'Lifetime VIP', label: '25 refs' },
                ].map(tier => {
                  const done = referralCount >= tier.threshold
                  const pct = Math.min(100, Math.round((referralCount / tier.threshold) * 100))
                  return (
                    <div key={tier.threshold} style={{
                      background: done ? 'rgba(245,158,11,0.07)' : '#0d0d14',
                      border: `1px solid ${done ? 'rgba(245,158,11,0.3)' : '#1f2937'}`,
                      borderRadius: 8, padding: '10px 14px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: done ? '#f59e0b' : '#6b7280' }}>
                          {done ? '✓ ' : ''}{tier.days}
                        </span>
                        <span style={{ fontSize: 11, color: '#4b5563' }}>{tier.label}</span>
                      </div>
                      <div style={{ height: 4, background: '#1f2937', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: done ? '#f59e0b' : '#374151', borderRadius: 2, transition: 'width 0.4s' }} />
                      </div>
                      {done && tier.days === '30-day VIP' && vipExpiresAt && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                          Expires {new Date(vipExpiresAt).toLocaleDateString()}
                        </div>
                      )}
                      {done && tier.days === '90-day VIP' && vipExpiresAt && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                          Expires {new Date(vipExpiresAt).toLocaleDateString()}
                        </div>
                      )}
                      {done && tier.days === 'Lifetime VIP' && (
                        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, fontWeight: 700 }}>🎉 Lifetime — never expires</div>
                      )}
                    </div>
                  )
                })}

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <div style={{ fontSize: 28 }}>🔗</div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#4ade80' }}>{referralCount}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      {referralCount === 1 ? 'person referred' : 'people referred'}
                      {referralCount < 5 && ` · ${5 - referralCount} more for 30-day VIP`}
                      {referralCount >= 5 && referralCount < 10 && ` · ${10 - referralCount} more for 90-day VIP`}
                      {referralCount >= 10 && referralCount < 25 && ` · ${25 - referralCount} more for Lifetime VIP`}
                      {referralCount >= 25 && ' · 🏆 Lifetime VIP earned!'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#4b5563' }}>Loading your referral code…</div>
            )}
          </Section>

          {canUseWishlistAlerts && (
            <Section title="🔔 Wishlist Alerts" hint="VIP Plus and VIP Max feature">
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                Add keywords for items you want. On Browse/Home, matching listings will be highlighted for you.
              </div>
              <textarea
                rows={3}
                placeholder="e.g. tralalero, mythic, max level"
                value={wishlistInput}
                onChange={e => setWishlistInput(e.target.value)}
                style={{ resize: 'vertical' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, color: '#4b5563' }}>
                  Use commas to separate terms. Max 20 keywords.
                </div>
                <button
                  type="button"
                  onClick={persistWishlist}
                  style={{
                    border: '1px solid rgba(74,222,128,0.35)',
                    background: wishlistSaved ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.1)',
                    color: wishlistSaved ? '#4ade80' : '#86efac',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '6px 12px',
                    cursor: 'pointer',
                  }}
                >
                  {wishlistSaved ? '✓ Saved' : 'Save Wishlist Alerts'}
                </button>
              </div>
            </Section>
          )}

          <button onClick={handleSave} disabled={saving || avatarUploading} className="btn-primary" style={{ fontSize: 14, padding: '13px 0' }} type="button">
            {avatarUploading ? 'Uploading Photo...' : saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, hint, children }) {
  return (
    <div style={{ background: '#111118', border: '1px solid #1f2937', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #1f2937' }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f9fafb' }}>{title}</h2>
        {hint && <span style={{ fontSize: 11, color: '#6b7280' }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )
}

function Field({ label, children, required, hint }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: 11, color: '#4b5563' }}>— {hint}</span>}
      </div>
      {children}
    </div>
  )
}
