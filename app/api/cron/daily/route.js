import { createClient } from '@supabase/supabase-js'

// Use service role key for cron — bypasses RLS
// Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars (keep secret, never NEXT_PUBLIC_)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request) {
  // Verify this is called by Vercel Cron, not a random request
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase.rpc('daily_maintenance')
    if (error) throw error

    console.log('Daily maintenance complete:', data)
    return Response.json({ ok: true, result: data })
  } catch (err) {
    console.error('Cron error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
