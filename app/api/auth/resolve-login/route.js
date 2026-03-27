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

export async function POST(request) {
  try {
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

