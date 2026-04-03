import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function createAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function isUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))
}

export async function POST(_request, { params }) {
  try {
    const id = params?.id
    if (!isUuid(id)) return Response.json({ ok: false }, { status: 400 })

    const admin = createAdminClient()
    if (!admin) return Response.json({ ok: false }, { status: 503 })

    // Prefer DB RPC if available.
    let done = false
    const { error: rpcErr } = await admin.rpc('increment_view_count', { listing_id: id })
    if (!rpcErr) done = true

    // Fallback RPC signature.
    if (!done) {
      const { error: rpcErr2 } = await admin.rpc('increment_view_count', { p_listing_id: id })
      if (!rpcErr2) done = true
    }

    // Final fallback: read + write with service role.
    if (!done) {
      const { data: row, error: readErr } = await admin
        .from('listings')
        .select('id, views, status')
        .eq('id', id)
        .maybeSingle()
      if (readErr || !row || row.status === 'deleted') return Response.json({ ok: false }, { status: 404 })
      const nextViews = Number(row.views || 0) + 1
      const { error: updateErr } = await admin
        .from('listings')
        .update({ views: nextViews })
        .eq('id', id)
      if (updateErr) return Response.json({ ok: false }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 500 })
  }
}

