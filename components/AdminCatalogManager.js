'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { bumpMarketConfigVersion, clearMarketConfigCache } from '@/lib/market-config'

const BOX = { background: '#111118', border: '1px solid #1f2937', borderRadius: 10, padding: '12px 14px' }
const INPUT = { background: '#0d0d14', border: '1px solid #2d2d3f', borderRadius: 8, padding: '8px 10px', color: '#f9fafb', fontSize: 12, outline: 'none' }

function slugify(value = '') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 64)
}

function sortRows(list = []) {
  return [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.label || '').localeCompare(String(b.label || '')))
}

export default function AdminCatalogManager() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [games, setGames] = useState([])
  const [rarities, setRarities] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])

  const [newGame, setNewGame] = useState({ id: '', label: '', emoji: '🎮', color: '#4ade80', sort_order: 0 })
  const [newRarity, setNewRarity] = useState({ id: '', game_id: '', label: '', color: '#4ade80', bg: '#111118', glow: 'rgba(74,222,128,0.25)', sort_order: 0 })
  const [newPayment, setNewPayment] = useState({ id: '', label: '', emoji: '💳', note: '', handle_field: '', sort_order: 0 })

  const gameOptions = useMemo(() => sortRows(games), [games])
  const groupedRarities = useMemo(() => {
    const map = {}
    for (const r of sortRows(rarities)) {
      if (!map[r.game_id]) map[r.game_id] = []
      map[r.game_id].push(r)
    }
    return map
  }, [rarities])

  const authedFetch = async (method, body) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/market-config', {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Request failed')
    return json
  }

  const applyConfig = (json) => {
    setGames(json.games || [])
    setRarities(json.rarities || [])
    setPaymentMethods(json.paymentMethods || [])
    clearMarketConfigCache()
    bumpMarketConfigVersion()
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const json = await authedFetch('GET')
      applyConfig(json)
    } catch (err) {
      setError(err.message || 'Failed to load catalog')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const runMutation = async (payload, okMsg) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const json = await authedFetch('POST', payload)
      applyConfig(json)
      setSuccess(okMsg)
      setTimeout(() => setSuccess(''), 2200)
    } catch (err) {
      setError(err.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = (entity, row) => runMutation({
    entity,
    action: 'update',
    payload: { ...row, active: !row.active },
  }, `${row.label || row.id} ${row.active ? 'disabled' : 'enabled'}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...BOX, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f9fafb' }}>Catalog Manager</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Manage games, rarities, and payment methods used across RotMarket.</div>
        </div>
        <button onClick={load} disabled={loading || saving} style={{ border: '1px solid #2d2d3f', background: '#0d0d14', color: '#9ca3af', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div style={{ ...BOX, borderColor: 'rgba(239,68,68,0.35)', color: '#f87171', fontSize: 12 }}>⚠ {error}</div>}
      {success && <div style={{ ...BOX, borderColor: 'rgba(74,222,128,0.35)', color: '#4ade80', fontSize: 12 }}>✓ {success}</div>}

      {/* Games */}
      <div style={BOX}>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 8 }}>Games</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {gameOptions.map(g => (
            <div key={g.id} style={{ background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '110px 1fr 80px 70px 70px 66px 66px 66px', gap: 6, alignItems: 'center' }}>
              <input value={g.id} readOnly style={{ ...INPUT, opacity: 0.75 }} />
              <input value={g.label || ''} onChange={e => setGames(prev => prev.map(x => x.id === g.id ? { ...x, label: e.target.value } : x))} style={INPUT} />
              <input value={g.emoji || ''} onChange={e => setGames(prev => prev.map(x => x.id === g.id ? { ...x, emoji: e.target.value } : x))} style={INPUT} />
              <input type="color" value={g.color || '#4ade80'} onChange={e => setGames(prev => prev.map(x => x.id === g.id ? { ...x, color: e.target.value } : x))} style={{ ...INPUT, padding: 2, height: 34 }} />
              <input type="number" value={g.sort_order ?? 0} onChange={e => setGames(prev => prev.map(x => x.id === g.id ? { ...x, sort_order: Number(e.target.value) } : x))} style={INPUT} />
              <button onClick={() => toggleActive('game', g)} disabled={saving} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: g.active ? 'rgba(74,222,128,0.18)' : 'rgba(239,68,68,0.18)', color: g.active ? '#4ade80' : '#f87171', cursor: 'pointer' }}>{g.active ? 'Enabled' : 'Disabled'}</button>
              <button onClick={() => runMutation({ entity: 'game', action: 'update', payload: g }, 'Game updated')} disabled={saving} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: 'rgba(96,165,250,0.18)', color: '#93c5fd', cursor: 'pointer' }}>Save</button>
              <button onClick={() => runMutation({ entity: 'game', action: 'delete', payload: g }, 'Game removed')} disabled={saving} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: 'rgba(239,68,68,0.16)', color: '#f87171', cursor: 'pointer' }}>Delete</button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, background: '#0d0d14', border: '1px dashed #2d2d3f', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '110px 1fr 80px 70px 70px 100px', gap: 6, alignItems: 'center' }}>
          <input placeholder="id" value={newGame.id} onChange={e => setNewGame(p => ({ ...p, id: slugify(e.target.value), label: p.label || e.target.value }))} style={INPUT} />
          <input placeholder="label" value={newGame.label} onChange={e => setNewGame(p => ({ ...p, label: e.target.value }))} style={INPUT} />
          <input placeholder="emoji" value={newGame.emoji} onChange={e => setNewGame(p => ({ ...p, emoji: e.target.value }))} style={INPUT} />
          <input type="color" value={newGame.color} onChange={e => setNewGame(p => ({ ...p, color: e.target.value }))} style={{ ...INPUT, padding: 2, height: 34 }} />
          <input type="number" value={newGame.sort_order} onChange={e => setNewGame(p => ({ ...p, sort_order: Number(e.target.value) }))} style={INPUT} />
          <button onClick={() => runMutation({ entity: 'game', action: 'create', payload: newGame }, 'Game created')} disabled={saving || !newGame.id} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: 'rgba(74,222,128,0.18)', color: '#4ade80', cursor: 'pointer' }}>Add Game</button>
        </div>
      </div>

      {/* Rarities */}
      <div style={BOX}>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 8 }}>Rarities</div>
        {gameOptions.map(g => (
          <div key={g.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: g.color || '#9ca3af', fontWeight: 700, marginBottom: 6 }}>{g.emoji || '🎮'} {g.label || g.id}</div>
            {(groupedRarities[g.id] || []).map(r => (
              <div key={`${r.game_id}:${r.id}`} style={{ background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '100px 1fr 70px 70px 120px 70px 66px 66px 66px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input value={r.id} readOnly style={{ ...INPUT, opacity: 0.75 }} />
                <input value={r.label || ''} onChange={e => setRarities(prev => prev.map(x => x.id === r.id && x.game_id === r.game_id ? { ...x, label: e.target.value } : x))} style={INPUT} />
                <input type="color" value={r.color || '#4ade80'} onChange={e => setRarities(prev => prev.map(x => x.id === r.id && x.game_id === r.game_id ? { ...x, color: e.target.value } : x))} style={{ ...INPUT, padding: 2, height: 34 }} />
                <input type="color" value={r.bg || '#111118'} onChange={e => setRarities(prev => prev.map(x => x.id === r.id && x.game_id === r.game_id ? { ...x, bg: e.target.value } : x))} style={{ ...INPUT, padding: 2, height: 34 }} />
                <input value={r.glow || ''} onChange={e => setRarities(prev => prev.map(x => x.id === r.id && x.game_id === r.game_id ? { ...x, glow: e.target.value } : x))} style={INPUT} />
                <input type="number" value={r.sort_order ?? 0} onChange={e => setRarities(prev => prev.map(x => x.id === r.id && x.game_id === r.game_id ? { ...x, sort_order: Number(e.target.value) } : x))} style={INPUT} />
                <button onClick={() => toggleActive('rarity', r)} disabled={saving} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: r.active ? 'rgba(74,222,128,0.18)' : 'rgba(239,68,68,0.18)', color: r.active ? '#4ade80' : '#f87171', cursor: 'pointer' }}>{r.active ? 'On' : 'Off'}</button>
                <button onClick={() => runMutation({ entity: 'rarity', action: 'update', payload: r }, 'Rarity updated')} disabled={saving} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: 'rgba(96,165,250,0.18)', color: '#93c5fd', cursor: 'pointer' }}>Save</button>
                <button onClick={() => runMutation({ entity: 'rarity', action: 'delete', payload: r }, 'Rarity removed')} disabled={saving} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: 'rgba(239,68,68,0.16)', color: '#f87171', cursor: 'pointer' }}>Delete</button>
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 10, background: '#0d0d14', border: '1px dashed #2d2d3f', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '100px 120px 1fr 70px 70px 120px 70px 110px', gap: 6, alignItems: 'center' }}>
          <input placeholder="id" value={newRarity.id} onChange={e => setNewRarity(p => ({ ...p, id: slugify(e.target.value), label: p.label || e.target.value }))} style={INPUT} />
          <select value={newRarity.game_id} onChange={e => setNewRarity(p => ({ ...p, game_id: e.target.value }))} style={INPUT}>
            <option value="">Game</option>
            {gameOptions.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
          <input placeholder="label" value={newRarity.label} onChange={e => setNewRarity(p => ({ ...p, label: e.target.value }))} style={INPUT} />
          <input type="color" value={newRarity.color} onChange={e => setNewRarity(p => ({ ...p, color: e.target.value }))} style={{ ...INPUT, padding: 2, height: 34 }} />
          <input type="color" value={newRarity.bg} onChange={e => setNewRarity(p => ({ ...p, bg: e.target.value }))} style={{ ...INPUT, padding: 2, height: 34 }} />
          <input value={newRarity.glow} onChange={e => setNewRarity(p => ({ ...p, glow: e.target.value }))} style={INPUT} />
          <input type="number" value={newRarity.sort_order} onChange={e => setNewRarity(p => ({ ...p, sort_order: Number(e.target.value) }))} style={INPUT} />
          <button onClick={() => runMutation({ entity: 'rarity', action: 'create', payload: newRarity }, 'Rarity created')} disabled={saving || !newRarity.id || !newRarity.game_id} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: 'rgba(74,222,128,0.18)', color: '#4ade80', cursor: 'pointer' }}>Add Rarity</button>
        </div>
      </div>

      {/* Payment methods */}
      <div style={BOX}>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 8 }}>Payment Methods</div>
        {sortRows(paymentMethods).map(pm => (
          <div key={pm.id} style={{ background: '#0d0d14', border: '1px solid #1f2937', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '100px 1fr 80px 1fr 130px 70px 66px 66px 66px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <input value={pm.id} readOnly style={{ ...INPUT, opacity: 0.75 }} />
            <input value={pm.label || ''} onChange={e => setPaymentMethods(prev => prev.map(x => x.id === pm.id ? { ...x, label: e.target.value } : x))} style={INPUT} />
            <input value={pm.emoji || ''} onChange={e => setPaymentMethods(prev => prev.map(x => x.id === pm.id ? { ...x, emoji: e.target.value } : x))} style={INPUT} />
            <input value={pm.note || ''} onChange={e => setPaymentMethods(prev => prev.map(x => x.id === pm.id ? { ...x, note: e.target.value } : x))} style={INPUT} />
            <input value={pm.handle_field || ''} onChange={e => setPaymentMethods(prev => prev.map(x => x.id === pm.id ? { ...x, handle_field: e.target.value } : x))} placeholder="profile field (optional)" style={INPUT} />
            <input type="number" value={pm.sort_order ?? 0} onChange={e => setPaymentMethods(prev => prev.map(x => x.id === pm.id ? { ...x, sort_order: Number(e.target.value) } : x))} style={INPUT} />
            <button onClick={() => toggleActive('payment', pm)} disabled={saving} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: pm.active ? 'rgba(74,222,128,0.18)' : 'rgba(239,68,68,0.18)', color: pm.active ? '#4ade80' : '#f87171', cursor: 'pointer' }}>{pm.active ? 'On' : 'Off'}</button>
            <button onClick={() => runMutation({ entity: 'payment', action: 'update', payload: pm }, 'Payment updated')} disabled={saving} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: 'rgba(96,165,250,0.18)', color: '#93c5fd', cursor: 'pointer' }}>Save</button>
            <button onClick={() => runMutation({ entity: 'payment', action: 'delete', payload: pm }, 'Payment removed')} disabled={saving} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: 'rgba(239,68,68,0.16)', color: '#f87171', cursor: 'pointer' }}>Delete</button>
          </div>
        ))}

        <div style={{ marginTop: 10, background: '#0d0d14', border: '1px dashed #2d2d3f', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '100px 1fr 80px 1fr 130px 70px 110px', gap: 6, alignItems: 'center' }}>
          <input placeholder="id" value={newPayment.id} onChange={e => setNewPayment(p => ({ ...p, id: slugify(e.target.value), label: p.label || e.target.value }))} style={INPUT} />
          <input placeholder="label" value={newPayment.label} onChange={e => setNewPayment(p => ({ ...p, label: e.target.value }))} style={INPUT} />
          <input placeholder="emoji" value={newPayment.emoji} onChange={e => setNewPayment(p => ({ ...p, emoji: e.target.value }))} style={INPUT} />
          <input placeholder="note (optional)" value={newPayment.note} onChange={e => setNewPayment(p => ({ ...p, note: e.target.value }))} style={INPUT} />
          <input placeholder="profile field (optional)" value={newPayment.handle_field} onChange={e => setNewPayment(p => ({ ...p, handle_field: e.target.value }))} style={INPUT} />
          <input type="number" value={newPayment.sort_order} onChange={e => setNewPayment(p => ({ ...p, sort_order: Number(e.target.value) }))} style={INPUT} />
          <button onClick={() => runMutation({ entity: 'payment', action: 'create', payload: newPayment }, 'Payment created')} disabled={saving || !newPayment.id} style={{ border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, padding: '7px 0', background: 'rgba(74,222,128,0.18)', color: '#4ade80', cursor: 'pointer' }}>Add Method</button>
        </div>
      </div>
    </div>
  )
}
