'use client'

import { useState } from 'react'
import { supabase, getVerifiedUser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { checkRateLimit } from '@/lib/utils'

const REASONS = [
  { id: 'scam', label: '🚨 Scam / Fraud' },
  { id: 'fake_listing', label: '❌ Fake or misleading listing' },
  { id: 'inappropriate', label: '🔞 Inappropriate content' },
  { id: 'harassment', label: '😠 Harassment' },
  { id: 'spam', label: '📢 Spam' },
  { id: 'other', label: '💬 Other' },
]

export default function ReportButton({ reportedUserId, listingId, label = 'Report' }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!reason) { setError('Please select a reason.'); return }
    if (!reportedUserId) { setError('Invalid report target.'); return }
    const { user, redirect, unverified } = await getVerifiedUser()
    if (redirect) { router.push('/auth/login'); return }
    if (unverified) { setError('Please verify your email before submitting reports.'); return }
    // Prevent self-reporting
    if (user.id === reportedUserId) { setError('You cannot report yourself.'); return }
    // Rate limit: 1 report per target per 10 min
    const rl = checkRateLimit('report', reportedUserId)
    if (rl) { setError(rl); return }
    setError('')
    setLoading(true)

    try {
      const { error: dbError } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_id: reportedUserId,
        listing_id: listingId || null,
        reason,
        details: details.trim() || null,
      })

      if (dbError) throw dbError
      setSubmitted(true)
      setTimeout(() => { setOpen(false); setSubmitted(false); setReason(''); setDetails('') }, 2000)
    } catch (err) {
      setError('Failed to submit report: ' + (err.message || 'Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        type="button"
        style={{
          background: 'none', border: '1px solid #2d2d3f',
          color: '#6b7280', borderRadius: 6, padding: '5px 10px',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.color = '#f87171' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2d2d3f'; e.currentTarget.style.color = '#6b7280' }}
      >
        🚩 {label}
      </button>

      {/* Modal */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{
            background: '#111118', border: '1px solid #2d2d3f',
            borderRadius: 16, padding: 24, width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>Report submitted</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>Our moderation team will review this.</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f9fafb' }}>Submit a Report</h3>
                  <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Reason <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {REASONS.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setReason(r.id)}
                        style={{
                          textAlign: 'left', padding: '9px 12px', borderRadius: 8,
                          cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          background: reason === r.id ? 'rgba(239,68,68,0.1)' : '#0d0d14',
                          border: reason === r.id ? '1px solid rgba(239,68,68,0.35)' : '1px solid #2d2d3f',
                          color: reason === r.id ? '#f87171' : '#d1d5db',
                          transition: 'all 0.1s',
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Additional Details <span style={{ color: '#4b5563', fontWeight: 500, textTransform: 'none' }}>(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Any extra info that helps our team investigate (listing IDs, dates, etc.)"
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>⚠️ {error}</div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !reason}
                    type="button"
                    style={{
                      flex: 1, padding: '11px 0', borderRadius: 8, border: 'none',
                      background: loading || !reason ? '#1f2937' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                      color: loading || !reason ? '#6b7280' : '#fff',
                      fontSize: 13, fontWeight: 700, cursor: loading || !reason ? 'default' : 'pointer',
                    }}
                  >
                    {loading ? 'Submitting...' : 'Submit Report'}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    type="button"
                    style={{
                      padding: '11px 18px', borderRadius: 8,
                      background: 'transparent', border: '1px solid #2d2d3f',
                      color: '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
