import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [maintenanceRes, vipRes] = await Promise.all([
      supabase.rpc('daily_maintenance'),
      supabase.rpc('expire_vip_badges'),
    ])

    if (maintenanceRes.error) throw maintenanceRes.error
    if (vipRes.error) throw vipRes.error

    console.log('Daily maintenance complete:', maintenanceRes.data)
    console.log('VIP expiry run complete')
    return Response.json({ ok: true, result: maintenanceRes.data })
  } catch (err) {
    console.error('Cron error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
