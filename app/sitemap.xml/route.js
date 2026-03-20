import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://rotmarket.net'

export async function GET() {
  const staticPages = [
    { url: '/', changefreq: 'hourly', priority: '1.0' },
    { url: '/leaderboard', changefreq: 'daily', priority: '0.8' },
    { url: '/how-it-works', changefreq: 'monthly', priority: '0.7' },
    { url: '/contact', changefreq: 'monthly', priority: '0.5' },
    { url: '/vip', changefreq: 'monthly', priority: '0.6' },
    { url: '/terms', changefreq: 'monthly', priority: '0.3' },
    { url: '/privacy', changefreq: 'monthly', priority: '0.3' },
  ]

  // Fetch active listings — graceful fallback on error
  let listings = []
  let profiles = []
  try {
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from('listings').select('id, created_at').eq('status', 'active')
        .order('created_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('username, created_at')
        .not('username', 'is', null).order('created_at', { ascending: false }).limit(500),
    ])
    listings = l || []
    profiles = p || []
  } catch {
    // If DB is unreachable, return static pages only
  }

  const listingUrls = (listings || []).map(l => ({
    url: `/listing/${l.id}`,
    lastmod: l.created_at?.split('T')[0],
    changefreq: 'weekly',
    priority: '0.6',
  }))

  const profileUrls = (profiles || []).map(p => ({
    url: `/profile/${p.username}`,
    lastmod: p.created_at?.split('T')[0],
    changefreq: 'weekly',
    priority: '0.5',
  }))

  const allPages = [...staticPages, ...listingUrls, ...profileUrls]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    ${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
