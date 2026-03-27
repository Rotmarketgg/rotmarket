import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://rotmarket.net'
const SITEMAP_BATCH_SIZE = 1000
const SITEMAP_MAX_ROWS = 10000

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function fetchAllRows(buildQuery) {
  const rows = []
  for (let offset = 0; offset < SITEMAP_MAX_ROWS; offset += SITEMAP_BATCH_SIZE) {
    const from = offset
    const to = offset + SITEMAP_BATCH_SIZE - 1
    const { data, error } = await buildQuery(from, to)
    if (error) throw error
    const batch = data || []
    rows.push(...batch)
    if (batch.length < SITEMAP_BATCH_SIZE) break
  }
  return rows
}

export async function GET() {
  const staticPages = [
    { url: '/', changefreq: 'hourly', priority: '1.0' },
    { url: '/browse', changefreq: 'hourly', priority: '0.9' },
    { url: '/leaderboard', changefreq: 'daily', priority: '0.8' },
    { url: '/how-it-works', changefreq: 'monthly', priority: '0.7' },
    { url: '/contact', changefreq: 'monthly', priority: '0.5' },
    { url: '/vip', changefreq: 'monthly', priority: '0.6' },
    { url: '/terms', changefreq: 'monthly', priority: '0.3' },
    { url: '/privacy', changefreq: 'monthly', priority: '0.3' },
  ]

  let listings = []
  let profiles = []

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase envs')

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const [listingRows, profileRows] = await Promise.all([
      fetchAllRows((from, to) => (
        supabase
          .from('listings')
          .select('id, created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .range(from, to)
      )),
      fetchAllRows((from, to) => (
        supabase
          .from('profiles')
          .select('username, created_at')
          .not('username', 'is', null)
          .order('created_at', { ascending: false })
          .range(from, to)
      )),
    ])
    listings = listingRows
    profiles = profileRows
  } catch {
    // Return static pages only if DB/env is unavailable
  }

  const listingUrls = listings.map(listing => ({
    url: `/listing/${listing.id}`,
    lastmod: listing.created_at?.split('T')[0],
    changefreq: 'weekly',
    priority: '0.6',
  }))

  const profileUrls = profiles.map(profile => ({
    url: `/profile/${encodeURIComponent(profile.username)}`,
    lastmod: profile.created_at?.split('T')[0],
    changefreq: 'weekly',
    priority: '0.5',
  }))

  const allPages = [...staticPages, ...listingUrls, ...profileUrls]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${escapeXml(`${BASE_URL}${encodeURI(page.url)}`)}</loc>
    ${page.lastmod ? `<lastmod>${escapeXml(page.lastmod)}</lastmod>` : ''}
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
