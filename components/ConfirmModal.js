'use client'
import { useEffect, useState, useRef } from 'react'

/**
 * Inline confirmation / alert / input modal — replaces window.confirm(), alert(), prompt().
 *
 * Props on `modal` object:
 *   title        – optional bold heading
 *   message      – body text
 *   confirmLabel – button label (default "Confirm")
 *   danger       – red confirm button
 *   alertOnly    – no Cancel, single OK button
 *   inputLabel   – if set, shows a text input; onConfirm receives the input value
 *   inputPlaceholder
 *   onConfirm(value?) – called with input value (or undefined if no input)
 */
export default function ConfirmModal({ modal, onClose }) {
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!modal) return
    setInputVal('')
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    if (modal.inputLabel) setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, onClose])

  if (!modal) return null

  const handleConfirm = () => {
    if (modal.inputLabel && !inputVal.trim()) { inputRef.current?.focus(); return }
    modal.onConfirm?.(modal.inputLabel ? inputVal.trim() : undefined)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111118', border: '1px solid #2d2d3f',
          borderRadius: 14, padding: '24px 28px', maxWidth: 420, width: '100%',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        {modal.title && (
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f9fafb', marginBottom: 8 }}>
            {modal.title}
          </div>
        )}
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#9ca3af', lineHeight: 1.6 }}>
          {modal.message}
        </p>

        {modal.inputLabel && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6 }}>
              {modal.inputLabel}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
              placeholder={modal.inputPlaceholder || ''}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                background: '#0d0d14', border: '1px solid #2d2d3f',
                color: '#f9fafb', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {!modal.alertOnly && (
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px', borderRadius: 8, border: '1px solid #2d2d3f',
                background: 'none', color: '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleConfirm}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: modal.danger ? '#dc2626' : '#16a34a',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {modal.confirmLabel || (modal.alertOnly ? 'OK' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
