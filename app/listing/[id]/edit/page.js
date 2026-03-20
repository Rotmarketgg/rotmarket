'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { getUser, getListing, updateListing, deleteListing } from '@/lib/supabase'
import { RARITIES, PAYMENT_METHODS, LISTING_TYPES } from '@/lib/constants'

export default function EditListingPage() {
  const { id } = useParams()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '', rarity: '', type: 'sale',
    price: '', description: '', accepts: [], status: 'active',
  })

  useEffect(() => {
    async function load() {
      const u = await getUser()
      if (!u) { router.push('/auth/login'); return }
      setUser(u)
      const l = await getListing(id)
      if (!l) { router.push('/'); return }
      if (l.user_id !== u.id) { router.push('/'); return }
      setListing(l)
      setForm({
        title: l.title || '',
        rarity: l.rarity || '',
        type: l.type || 'sale',
        price: l.price || '',
        description: l.description || '',
        accepts: l.accepts || [],
        status: l.status || 'active',
      })
      setLoading(false)
    }
    load()
  }, [id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const togglePayment = (method) => {
    setForm(f => ({
      ...f,
      accepts: f.accepts.includes(method)
        ? f.accepts.filter(m => m !== method)
        : [...f.accepts, method]
    }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    try {
      await updateListing(id, {
        title: form.title.trim(),
        rarity: form.rarity,
        type: form.type,
        price: form.type === 'sale' ? parseFloat(form.price) : null,
        description: form.description.trim(),
        accepts: form.accepts,
        status: form.status,
      })
      router.push(`/listing/${id}`)
    } catch (err) {
      setError('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this listing permanently?')) return
    await deleteListing(id)
    router.push('/')
  }

  const rarities = RARITIES[listing?.game] || RARITIES.fortnite

  if (loading) return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: 80, color: '#6b7280' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: 26, fontWeight: 900, color: '#f9fafb', fontFamily: 'var(--font-display)' }}>
          Edit Listing
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Field label="Title" required>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} maxLength={80} />
          </Field>

          <Field label="Rarity">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {rarities.map(r => (
                <button key={r.id} onClick={() => set('rarity', r.id)} style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: form.rarity === r.id ? `${r.bg}cc` : '#111118',
                  color: form.rarity === r.id ? r.color : '#6b7280',
                  boxShadow: form.rarity === r.id ? `0 0 0 1px ${r.color}` : '0 0 0 1px #2d2d3f',
                  fontSize: 12, fontWeight: 700,
                }}>{r.label}</button>
              ))}
            </div>
          </Field>

          <Field label="Type">
            <div style={{ display: 'flex', gap: 10 }}>
              {LISTING_TYPES.map(t => (
                <button key={t.id} onClick={() => set('type', t.id)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: form.type === t.id ? 'rgba(74,222,128,0.2)' : '#111118',
                  color: form.type === t.id ? '#4ade80' : '#6b7280',
                  boxShadow: form.type === t.id ? '0 0 0 1px rgba(74,222,128,0.4)' : '0 0 0 1px #2d2d3f',
                  fontSize: 13, fontWeight: 700,
                }}>{t.emoji} {t.label}</button>
              ))}
            </div>
          </Field>

          {form.type === 'sale' && (
            <Field label="Price (USD)">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>$</span>
                <input type="number" value={form.price} onChange={e => set('price', e.target.value)} min="0.01" step="0.01" style={{ paddingLeft: 28 }} />
              </div>
            </Field>
          )}

          <Field label="Payment Methods">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PAYMENT_METHODS.map(pm => (
                <label key={pm.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderRadius: 8, cursor: 'pointer',
                  background: form.accepts.includes(pm.label) ? 'rgba(74,222,128,0.08)' : '#0d0d14',
                  border: form.accepts.includes(pm.label) ? '1px solid rgba(74,222,128,0.3)' : '1px solid #2d2d3f',
                }}>
                  <input type="checkbox" checked={form.accepts.includes(pm.label)} onChange={() => togglePayment(pm.label)} style={{ width: 'auto', margin: 0 }} />
                  <span>{pm.emoji}</span>
                  <span style={{ fontSize: 13, color: '#d1d5db' }}>{pm.label}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Description">
            <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} maxLength={500} style={{ resize: 'vertical' }} />
          </Field>

          <Field label="Status">
            <div style={{ display: 'flex', gap: 8 }}>
              {['active', 'sold'].map(s => (
                <button key={s} onClick={() => set('status', s)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: form.status === s ? (s === 'active' ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)') : '#111118',
                  color: form.status === s ? (s === 'active' ? '#4ade80' : '#f87171') : '#6b7280',
                  boxShadow: form.status === s ? (s === 'active' ? '0 0 0 1px rgba(74,222,128,0.4)' : '0 0 0 1px rgba(239,68,68,0.4)') : '0 0 0 1px #2d2d3f',
                  fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                }}>{s}</button>
              ))}
            </div>
          </Field>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 1 }}>
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
            <button onClick={handleDelete} style={{
              padding: '12px 18px', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
              color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>🗑 Delete</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
