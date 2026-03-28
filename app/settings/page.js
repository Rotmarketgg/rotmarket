'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { clearProfileCache } from '@/components/Navbar'
import { getSessionUser, getVerifiedUser, getProfile, updateProfile, supabase } from '@/lib/supabase'
import { withTimeout, getInitial } from '@/lib/utils'
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
      }
      setLoading(false)
      } catch (err) {
        console.error('Settings load error:', err)
        setLoading(false)
      }
    }
    load()
  }, [])

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
