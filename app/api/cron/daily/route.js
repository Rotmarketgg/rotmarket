import { createClient } from '@supabase/supabase-js'

// Cron jobs MUST run with the service role key — they call daily_maintenance
// which bypasses RLS. If the key is missing, fail loudly at startup rather than
// silently running with the anon key and having RLS block everything.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // This surfaces as a build/runtime error in Vercel logs and Vercel alerts
  throw new Error(
    '[RotMarket Cron] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
    'Add it to Vercel Environment Variables (never prefix with NEXT_PUBLIC_). ' +
    'The daily maintenance cron will NOT run without it.'
  )
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
