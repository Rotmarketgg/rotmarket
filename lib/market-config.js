'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GAMES, RARITIES, PAYMENT_METHODS, RARITY_STYLES } from '@/lib/constants'
import { setDynamicRarityStyles } from '@/lib/utils'

const DEFAULT_HANDLE_FIELD = {
  paypal: 'paypal_email',
  cashapp: 'cashapp_handle',
  venmo: 'venmo_handle',
  revolut: 'revolut_handle',
}

let cache = null
let cacheTs = 0
let inflight = null
const CACHE_MS = 60_000

function toLabelFromId(id) {
  return String(id || '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeGame(row, index) {
  return {
    id: String(row?.id || '').trim().toLowerCase(),
    label: String(row?.label || '').trim() || toLabelFromId(row?.id),
    emoji: String(row?.emoji || '').trim() || '🎮',
    color: String(row?.color || '').trim() || '#4ade80',
    active: row?.active !== false,
    sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index,
  }
}

function normalizeRarity(row, index) {
  const id = String(row?.id || '').trim().toLowerCase()
  return {
    id,
    game_id: String(row?.game_id || '').trim().toLowerCase(),
    label: String(row?.label || '').trim() || toLabelFromId(id),
    color: String(row?.color || '').trim() || '#4ade80',
    bg: String(row?.bg || '').trim() || '#111118',
    glow: String(row?.glow || '').trim() || 'rgba(74,222,128,0.25)',
    active: row?.active !== false,
    sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index,
  }
}

function normalizePayment(row, index) {
  const id = String(row?.id || '').trim().toLowerCase()
  return {
    id,
    label: String(row?.label || '').trim() || toLabelFromId(id),
    emoji: String(row?.emoji || '').trim() || '💳',
    note: String(row?.note || '').trim() || '',
    handle_field: String(row?.handle_field || '').trim().toLowerCase() || DEFAULT_HANDLE_FIELD[id] || '',
    active: row?.active !== false,
    sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index,
  }
}

function fallbackGames() {
  return (GAMES || []).map((g, index) => normalizeGame({ ...g, active: true, sort_order: index }, index))
}

function fallbackRarities() {
  const rows = []
  Object.entries(RARITIES || {}).forEach(([gameId, list]) => {
    ;(list || []).forEach((r, index) => {
      rows.push(normalizeRarity({
        id: r.id,
        game_id: gameId,
        label: r.label,
        color: r.color,
        bg: r.bg,
        glow: r.glow,
        active: true,
        sort_order: index,
      }, index))
    })
  })
  return rows
}

function fallbackPayments() {
  return (PAYMENT_METHODS || []).map((pm, index) => normalizePayment({
    id: pm.id,
    label: pm.label,
    emoji: pm.emoji,
    note: pm.note || '',
    handle_field: DEFAULT_HANDLE_FIELD[pm.id] || '',
    active: true,
    sort_order: index,
  }, index))
}

function buildConfig({ games, rarities, payments }) {
  const sortedGames = (games || []).map(normalizeGame).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
  const sortedRarities = (rarities || []).map(normalizeRarity).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
  const sortedPayments = (payments || []).map(normalizePayment).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))

  const activeGames = sortedGames.filter(g => g.active)
  const activePayments = sortedPayments.filter(pm => pm.active)

  const gamesById = Object.fromEntries(sortedGames.map(g => [g.id, g]))
  const raritiesByGame = {}
  const rarityStyles = { ...RARITY_STYLES }

  for (const rarity of sortedRarities) {
    if (!rarity.game_id) continue
    if (!raritiesByGame[rarity.game_id]) raritiesByGame[rarity.game_id] = []
    if (rarity.active) raritiesByGame[rarity.game_id].push(rarity)
    rarityStyles[rarity.id] = {
      border: rarity.color,
      text: rarity.color,
      bg: rarity.bg,
      glow: rarity.glow,
    }
  }

  for (const game of sortedGames) {
    if (!raritiesByGame[game.id]) raritiesByGame[game.id] = []
  }

  const paymentsById = Object.fromEntries(sortedPayments.map(pm => [pm.id, pm]))
  const paymentByValue = {}
  for (const pm of sortedPayments) {
    paymentByValue[pm.id.toLowerCase()] = pm
    paymentByValue[pm.label.toLowerCase()] = pm
  }

  return {
    games: activeGames,
    allGames: sortedGames,
    gamesById,
    raritiesByGame,
    allRarities: sortedRarities,
    rarityStyles,
    payments: activePayments,
    allPayments: sortedPayments,
    paymentsById,
    paymentByValue,
  }
}

async function readConfigRows() {
  const fallback = {
    games: fallbackGames(),
    rarities: fallbackRarities(),
    payments: fallbackPayments(),
  }

  try {
    const [gamesRes, raritiesRes, paymentsRes] = await Promise.all([
      supabase.from('market_games').select('id, label, emoji, color, active, sort_order').order('sort_order', { ascending: true }),
      supabase.from('market_rarities').select('id, game_id, label, color, bg, glow, active, sort_order').order('sort_order', { ascending: true }),
      supabase.from('market_payment_methods').select('id, label, emoji, note, handle_field, active, sort_order').order('sort_order', { ascending: true }),
    ])

    const games = gamesRes.error || !gamesRes.data?.length ? fallback.games : gamesRes.data
    const rarities = raritiesRes.error || !raritiesRes.data?.length ? fallback.rarities : raritiesRes.data
    const payments = paymentsRes.error || !paymentsRes.data?.length ? fallback.payments : paymentsRes.data

    return { games, rarities, payments }
  } catch {
    return fallback
  }
}

export async function getMarketConfig({ force = false } = {}) {
  const now = Date.now()
  if (!force && cache && now - cacheTs < CACHE_MS) return cache
  if (!force && inflight) return inflight

  inflight = (async () => {
    const rows = await readConfigRows()
    const next = buildConfig(rows)
    cache = next
    cacheTs = Date.now()
    setDynamicRarityStyles(next.rarityStyles)
    return next
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

export function clearMarketConfigCache() {
  cache = null
  cacheTs = 0
}

export function resolveGameLabel(gameId, fallback = '') {
  const id = String(gameId || '').toLowerCase()
  if (!id) return fallback || ''
  if (cache?.gamesById?.[id]?.label) return cache.gamesById[id].label
  return fallback || toLabelFromId(id)
}

export function resolvePaymentMethod(value) {
  const key = String(value || '').trim().toLowerCase()
  if (!key) return null
  return cache?.paymentByValue?.[key] || null
}

export function useMarketConfig() {
  const [config, setConfig] = useState(cache)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next = await getMarketConfig()
      if (cancelled) return
      setConfig(next)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return { config, loading, refresh: async () => {
    const next = await getMarketConfig({ force: true })
    setConfig(next)
    setLoading(false)
    return next
  } }
}
