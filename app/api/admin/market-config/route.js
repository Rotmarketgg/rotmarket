import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function createAnonClient(authHeader) {
  if (!supabaseUrl || !anonKey) return null
  return createClient(supabaseUrl, anonKey, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function createAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function isOwnerProfile(profile) {
  const badges = Array.isArray(profile?.badges) ? profile.badges : profile?.badge ? [profile.badge] : []
  return badges.includes('Owner')
}

async function requireOwner(request) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return { ok: false, status: 401, error: 'Missing auth token' }

  const anon = createAnonClient(authHeader)
  if (!anon) return { ok: false, status: 503, error: 'Supabase client unavailable' }

  const { data: authData, error: userErr } = await anon.auth.getUser()
  const user = authData?.user
  if (userErr || !user) return { ok: false, status: 401, error: 'Invalid auth token' }

  const { data: profile, error: profileErr } = await anon
    .from('profiles')
    .select('id, badge, badges')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr || !profile || !isOwnerProfile(profile)) {
    return { ok: false, status: 403, error: 'Owner access required' }
  }

  return { ok: true, user }
}

function sanitizeId(input = '') {
  return String(input).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64)
}

function normalizeSortOrder(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(-9999, Math.min(9999, Math.trunc(n)))
}

async function readConfig(admin) {
  const [gamesRes, raritiesRes, paymentsRes] = await Promise.all([
    admin.from('market_games').select('id, label, emoji, color, active, sort_order').order('sort_order', { ascending: true }),
    admin.from('market_rarities').select('id, game_id, label, color, bg, glow, active, sort_order').order('sort_order', { ascending: true }),
    admin.from('market_payment_methods').select('id, label, emoji, note, handle_field, active, sort_order').order('sort_order', { ascending: true }),
  ])

  if (gamesRes.error || raritiesRes.error || paymentsRes.error) {
    const msg = gamesRes.error?.message || raritiesRes.error?.message || paymentsRes.error?.message || 'Failed to read market config'
    throw new Error(msg)
  }

  return {
    games: gamesRes.data || [],
    rarities: raritiesRes.data || [],
    paymentMethods: paymentsRes.data || [],
  }
}

export async function GET(request) {
  try {
    const auth = await requireOwner(request)
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

    const admin = createAdminClient()
    if (!admin) return Response.json({ error: 'Admin client unavailable' }, { status: 503 })

    const config = await readConfig(admin)
    return Response.json({ ok: true, ...config })
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to load config' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const auth = await requireOwner(request)
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

    const admin = createAdminClient()
    if (!admin) return Response.json({ error: 'Admin client unavailable' }, { status: 503 })

    const body = await request.json().catch(() => ({}))
    const entity = String(body?.entity || '').toLowerCase()
    const action = String(body?.action || '').toLowerCase()
    const payload = body?.payload || {}

    if (!['game', 'rarity', 'payment'].includes(entity)) {
      return Response.json({ error: 'Invalid entity' }, { status: 400 })
    }
    if (!['create', 'update', 'delete'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (entity === 'game') {
      const id = sanitizeId(payload.id)
      if (!id) return Response.json({ error: 'Game id is required' }, { status: 400 })
      if (action === 'delete') {
        const { error } = await admin.from('market_games').delete().eq('id', id)
        if (error) throw error
      } else {
        const row = {
          id,
          label: String(payload.label || '').trim() || id,
          emoji: String(payload.emoji || '').trim() || '🎮',
          color: String(payload.color || '').trim() || '#4ade80',
          active: payload.active !== false,
          sort_order: normalizeSortOrder(payload.sort_order),
        }
        if (action === 'create') {
          const { error } = await admin.from('market_games').insert(row)
          if (error) throw error
        } else {
          const { error } = await admin.from('market_games').update(row).eq('id', id)
          if (error) throw error
        }
      }
    }

    if (entity === 'rarity') {
      const id = sanitizeId(payload.id)
      const gameId = sanitizeId(payload.game_id)
      if (!id || !gameId) return Response.json({ error: 'Rarity id and game id are required' }, { status: 400 })
      if (action === 'delete') {
        const { error } = await admin.from('market_rarities').delete().eq('id', id).eq('game_id', gameId)
        if (error) throw error
      } else {
        const row = {
          id,
          game_id: gameId,
          label: String(payload.label || '').trim() || id,
          color: String(payload.color || '').trim() || '#4ade80',
          bg: String(payload.bg || '').trim() || '#111118',
          glow: String(payload.glow || '').trim() || 'rgba(74,222,128,0.25)',
          active: payload.active !== false,
          sort_order: normalizeSortOrder(payload.sort_order),
        }
        if (action === 'create') {
          const { error } = await admin.from('market_rarities').insert(row)
          if (error) throw error
        } else {
          const { error } = await admin.from('market_rarities').update(row).eq('id', id).eq('game_id', gameId)
          if (error) throw error
        }
      }
    }

    if (entity === 'payment') {
      const id = sanitizeId(payload.id)
      if (!id) return Response.json({ error: 'Payment id is required' }, { status: 400 })
      if (action === 'delete') {
        const { error } = await admin.from('market_payment_methods').delete().eq('id', id)
        if (error) throw error
      } else {
        const row = {
          id,
          label: String(payload.label || '').trim() || id,
          emoji: String(payload.emoji || '').trim() || '💳',
          note: String(payload.note || '').trim() || '',
          handle_field: String(payload.handle_field || '').trim().toLowerCase() || null,
          active: payload.active !== false,
          sort_order: normalizeSortOrder(payload.sort_order),
        }
        if (action === 'create') {
          const { error } = await admin.from('market_payment_methods').insert(row)
          if (error) throw error
        } else {
          const { error } = await admin.from('market_payment_methods').update(row).eq('id', id)
          if (error) throw error
        }
      }
    }

    const config = await readConfig(admin)
    return Response.json({ ok: true, ...config })
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to update config' }, { status: 500 })
  }
}
