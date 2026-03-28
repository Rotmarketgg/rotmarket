import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const isUUID = (value = '') =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

function createAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// ─── IN-MEMORY RATE LIMIT ─────────────────────────────────────────
// 10 lookups per IP per minute — prevents bulk email enumeration.
const rlMap = new Map()
const RL_WINDOW_MS = 60_000
const RL_MAX = 10

function checkRateLimit(ip) {
  const now = Date.now()
  const key = String(ip || 'unknown').slice(0, 128)
  const history = (rlMap.get(key) || []).filter(t => now - t < RL_WINDOW_MS)
  if (history.length >= RL_MAX) return false
  history.push(now)
  rlMap.set(key, history)
  // Prune stale entries to avoid unbounded growth
  if (rlMap.size > 2000) {
    for (const [k, v] of rlMap.entries()) {
      if (v.every(t => now - t > RL_WINDOW_MS)) rlMap.delete(k)
    }
  }
  return true
}

export async function POST(request) {
  try {
    // ── Auth: only our own login flow should call this ────────────
    // Set LOGIN_RESOLVER_SECRET in Vercel env vars (server-only, no NEXT_PUBLIC_ prefix).
    // The signIn() function in lib/supabase.js sends this header.
    // When the env var is unset (local dev), the check is skipped.
    const resolverSecret = process.env.LOGIN_RESOLVER_SECRET
    if (resolverSecret) {
      const provided = request.headers.get('x-resolver-secret') || ''
      if (provided !== resolverSecret) {
        return Response.json({ email: null }, { status: 401 })
      }
    }

    // ── Rate limit by IP ──────────────────────────────────────────
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(ip)) {
      return Response.json({ email: null }, { status: 429 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return Response.json({ error: 'Login resolver unavailable' }, { status: 503 })
    }

    const body = await request.json().catch(() => ({}))
    const userId = String(body?.userId || '').trim()
    const username = String(body?.username || '').trim()

    let targetUserId = null

    if (userId && isUUID(userId)) {
      targetUserId = userId
    } else if (username) {
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .maybeSingle()
      targetUserId = profile?.id || null
    }

    if (!targetUserId) {
      return Response.json({ email: null })
    }

    const { data, error } = await admin.auth.admin.getUserById(targetUserId)
    if (error || !data?.user?.email) {
      return Response.json({ email: null })
    }

    return Response.json({ email: data.user.email.toLowerCase() })
  } catch (_) {
    return Response.json({ email: null })
  }
}
