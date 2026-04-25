import { createClient } from '@supabase/supabase-js'
import { DEFAULT_GAMES, DEFAULT_RARITIES, DEFAULT_PAYMENT_METHODS } from '@/lib/constants'

// Admin-level Supabase client using service role key (bypasses RLS)
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase service role env vars')
  return createClient(url, serviceKey)
}

// ─── GET: fetch current site config ──────────────────────────────
export async function GET() {
  try {
    const admin = getAdminClient()
    const { data, error } = await admin
      .from('site_config')
      .select('key, value')

    if (error) {
      // Table may not exist yet — return defaults
      return Response.json({
        games: DEFAULT_GAMES,
        rarities: DEFAULT_RARITIES,
        payment_methods: DEFAULT_PAYMENT_METHODS,
      })
    }

    const cfg = Object.fromEntries((data || []).map(r => [r.key, r.value]))

    return Response.json({
      games:           cfg.games           ?? DEFAULT_GAMES,
      rarities:        cfg.rarities        ?? DEFAULT_RARITIES,
      payment_methods: cfg.payment_methods ?? DEFAULT_PAYMENT_METHODS,
    })
  } catch (err) {
    console.error('[site-config GET]', err)
    return Response.json({
      games: DEFAULT_GAMES,
      rarities: DEFAULT_RARITIES,
      payment_methods: DEFAULT_PAYMENT_METHODS,
    })
  }
}

// ─── POST: update a config key ────────────────────────────────────
// Body: { key: 'games'|'rarities'|'payment_methods', value: [...] }
// Requires a valid Owner/Admin session cookie checked via anon client
export async function POST(req) {
  try {
    // Verify caller is an Owner via their session
    const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const anon = createClient(anonUrl, anonKey)

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await anon.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Check badges
    const { data: profile } = await anon
      .from('profiles')
      .select('badges')
      .eq('id', user.id)
      .single()

    const isOwner = profile?.badges?.some(b => ['Owner', 'Admin'].includes(b))
    if (!isOwner) return Response.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { key, value } = body

    const allowed = ['games', 'rarities', 'payment_methods']
    if (!allowed.includes(key)) {
      return Response.json({ error: 'Invalid config key' }, { status: 400 })
    }

    const admin = getAdminClient()
    const { error } = await admin
      .from('site_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[site-config POST]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
