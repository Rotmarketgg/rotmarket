// ─── SERVER COMPONENT ────────────────────────────────────────────
// Generates per-profile metadata AND pre-fetches the profile so
// ProfilePageClient gets data on first render with no double-fetch.

import { createClient } from '@supabase/supabase-js'
import ProfilePageClient from './ProfilePageClient'

async function getProfileData(username) {
  if (!username) return null
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    )
    const { data } = await supabase
      .from('profiles')
      .select(`
        id, username, avatar_url, bio, badge, badges,
        trade_count, rating, review_count, banned, ban_reason,
        epic_username, roblox_username, profile_url,
        paypal_email, cashapp_handle, venmo_handle,
        created_at
      `)
      .eq('username', username)
      .single()
    return data
  } catch {
    return null
  }
}

export async function generateMetadata({ params }) {
  const { username } = await params
  const profile = await getProfileData(username)

  if (!profile) {
    return {
      title: 'Profile Not Found — RotMarket',
      description: 'This user profile could not be found on RotMarket.',
    }
  }

  const badges = profile.badges?.length ? profile.badges : profile.badge ? [profile.badge] : []
  const badgeStr = badges.length ? ` · ${badges[0]}` : ''
  const trades = profile.trade_count ?? 0
  const rating = profile.rating ?? 0
  const reviews = profile.review_count ?? 0

  const title = `${profile.username}${badgeStr} — RotMarket`
  const description = profile.bio
    ? `${profile.bio} · ${trades} trades · ${rating}★ (${reviews} reviews) on RotMarket.`
    : `${profile.username}'s RotMarket profile — ${trades} completed trades, ${rating}★ rating from ${reviews} reviews.`

  const url = `https://rotmarket.net/profile/${username}`
  const image = profile.avatar_url ?? null

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: 'profile',
      url,
      siteName: 'RotMarket',
      ...(image ? { images: [{ url: image, width: 256, height: 256, alt: profile.username }] } : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

// Pre-fetch profile server-side and pass as prop — eliminates double-fetch
export default async function ProfilePage({ params }) {
  const { username } = await params
  const initialProfile = await getProfileData(username)
  return <ProfilePageClient username={username} initialProfile={initialProfile} />
}
