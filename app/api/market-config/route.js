import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function createAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function GET() {
  try {
    const admin = createAdminClient()
    if (!admin) return Response.json({ error: 'Admin client unavailable' }, { status: 503 })

    const [gamesRes, raritiesRes, paymentsRes] = await Promise.all([
      admin.from('market_games').select('id, label, emoji, color, active, sort_order').order('sort_order', { ascending: true }),
      admin.from('market_rarities').select('id, game_id, label, color, bg, glow, active, sort_order').order('sort_order', { ascending: true }),
      admin.from('market_payment_methods').select('id, label, emoji, note, handle_field, active, sort_order').order('sort_order', { ascending: true }),
    ])
    if (gamesRes.error || raritiesRes.error || paymentsRes.error) {
      const msg = gamesRes.error?.message || raritiesRes.error?.message || paymentsRes.error?.message || 'Failed to load config'
      return Response.json({ error: msg }, { status: 500 })
    }

    return Response.json({
      ok: true,
      games: gamesRes.data || [],
      rarities: raritiesRes.data || [],
      paymentMethods: paymentsRes.data || [],
    })
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to load config' }, { status: 500 })
  }
}
