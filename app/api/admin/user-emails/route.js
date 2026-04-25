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

function isUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))
}

export async function POST(request) {
  try {
    const auth = await requireOwner(request)
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

    const admin = createAdminClient()
    if (!admin) return Response.json({ error: 'Admin client unavailable' }, { status: 503 })

    const body = await request.json().catch(() => ({}))
    const ids = Array.isArray(body?.userIds) ? body.userIds : []
    const targetIds = [...new Set(ids.map(v => String(v || '').trim()).filter(isUuid))].slice(0, 200)
    if (!targetIds.length) return Response.json({ ok: true, emails: {} })

    const rows = await Promise.all(targetIds.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id)
      if (error || !data?.user) return [id, null]
      return [id, {
        email: data.user.email || null,
        lastSignIn: data.user.last_sign_in_at || null,
        confirmed: data.user.confirmed_at || null,
      }]
    }))

    const emails = {}
    for (const [id, info] of rows) {
      if (info) emails[id] = info
    }
    return Response.json({ ok: true, emails })
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to load emails' }, { status: 500 })
  }
}
