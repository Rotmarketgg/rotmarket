import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,          // keep session in localStorage across tabs
    autoRefreshToken: true,        // silently refresh before expiry
    detectSessionInUrl: true,      // needed for email confirmation links
    storageKey: 'rotmarket-auth',  // explicit key avoids conflicts
  },
})

// ─── TAB VISIBILITY RECOVERY ─────────────────────────────────────
// Browsers throttle/suspend JS and network connections when a tab is hidden.
// When the user returns, the Supabase realtime websocket and fetch connections
// may be stale or broken.
//
// CRITICAL: We must AWAIT getSession() before dispatching the tab-visible
// event. Pages listen for 'rotmarket:tab-visible' and immediately call
// getSessionUser() — if we dispatch before the token refresh resolves,
// getSessionUser() will still see the expired token and return null,
// causing pages to appear logged out and redirect to /auth/login.
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return
    // Force Supabase to validate the stored token and silently refresh it
    // if expired. This must complete before any page-level auth checks run.
    await supabase.auth.getSession()
    // Reconnect realtime websocket which Chrome may have killed while hidden.
    supabase.realtime.connect()
    // Broadcast a custom event so every page component can re-run its auth
    // check and data fetch knowing the session token is now fresh.
    window.dispatchEvent(new Event('rotmarket:tab-visible'))
  })
}

// ─── AUTH HELPERS ────────────────────────────────────────────────

// getUser — makes a live network call to verify the token with Supabase.
// Use only when you need server-verified identity (e.g. writing data).
export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) return null
  return user
}

// getSessionUser — reads the session from localStorage instantly, no network call.
// Use for auth-gating UI (redirect to login if not signed in). Much more reliable
// after tab idle/backgrounding because it never races with token refresh.
export async function getSessionUser() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

export async function signUp(email, password, username) {
  // Check username isn't already taken before creating account
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (existing) throw new Error('That username is already taken.')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username } // stored in auth metadata, trigger reads this on confirmation
    }
  })
  if (error) throw error

  // Only upsert profile immediately if the user session is active right now.
  // When email confirmation is ON, data.session is null — the trigger on
  // auth.users handles profile creation when the user confirms their email.
  // Upserting here in that case causes a FK violation (auth.users row not
  // fully committed yet) which produces "Database error finding user".
  if (data.user && data.session) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: data.user.id, username })
      .select()
    // Non-fatal — trigger will handle it if upsert fails
    if (profileError) console.warn('Profile upsert warning:', profileError.message)
  }

  return data
}

export async function signIn(emailOrUsername, password) {
  let email = emailOrUsername

  // If no @ sign treat it as a username and look up the email
  if (!emailOrUsername.includes('@')) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', emailOrUsername)
      .single()
    if (error || !data) throw new Error('No account found with that username.')

    // Get email from auth.users via a lookup function
    const { data: userData, error: userError } = await supabase
      .rpc('get_email_by_user_id', { user_id: data.id })
    if (userError || !userData) throw new Error('Could not find account.')
    email = userData
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ─── PROFILE HELPERS ─────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, username, avatar_url, bio, badge, badges,
      trade_count, rating, review_count, banned, ban_reason,
      epic_username, roblox_username, profile_url,
      paypal_email, cashapp_handle, venmo_handle
    `)
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

export async function getProfileByUsername(username) {
  const { data, error } = await supabase
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
  if (error) return null
  return data
}

export async function updateProfile(userId, updates) {
  // If username is changing, check it's not already taken by someone else
  if (updates.username) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', updates.username)
      .neq('id', userId)
      .maybeSingle()
    if (existing) throw new Error('That username is already taken.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── LISTING HELPERS ─────────────────────────────────────────────

export async function getListings({ game, type, status, search, limit = 24, offset = 0 } = {}) {
  // Helper to apply shared filters to any query
  const applyFilters = (q) => {
    q = q.neq('status', 'deleted').neq('status', 'expired')
    if (game) q = q.eq('game', game)
    if (type) q = q.eq('type', type)
    if (status) q = q.eq('status', status)
    if (search) q = q.ilike('title', `%${search.trim().slice(0, 100)}%`)
    return q
  }

  // Data query — no description (not shown on cards, saves bandwidth)
  let dataQuery = applyFilters(
    supabase.from('listings').select(`
      id, created_at, expires_at, user_id,
      title, game, rarity, price, type, accepts,
      status, promoted, views, images, quantity,
      profiles (
        id, username, trade_count, rating, review_count, badge, badges, avatar_url
      )
    `)
    .order('promoted', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  )

  // Lightweight parallel count — much faster than count:exact on the full join
  let countQuery = applyFilters(
    supabase.from('listings').select('id', { count: 'exact', head: true })
  )

  const [{ data, error }, { count }] = await Promise.all([dataQuery, countQuery])
  if (error) throw error
  return { data: data || [], total: count || 0 }
}

export async function getListing(id) {
  if (!id || id === 'undefined') throw new Error('Invalid listing ID')

  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      profiles (
        id, username, epic_username, roblox_username,
        paypal_email, cashapp_handle, venmo_handle,
        trade_count, rating, review_count, badge, badges, avatar_url, bio
      )
    `)
    .eq('id', id)
    .neq('status', 'deleted')
    .single()
  if (error) throw error

  // Increment view count via RPC
  await supabase.rpc('increment_view_count', { listing_id: id })

  return data
}

export async function createListing(listing) {
  const { data, error } = await supabase
    .from('listings')
    .insert(listing)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateListing(id, updates, userId = null) {
  let query = supabase.from('listings').update(updates).eq('id', id)
  // Only scope to user_id when provided — admin updates don't need this filter
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query.select().single()
  if (error) throw error
  return data
}

export async function deleteListing(id) {
  // Use RPC to bypass RLS for soft delete
  const { error } = await supabase.rpc('soft_delete_listing', { listing_id: id })
  if (error) throw error
}

export async function getUserListings(userId) {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      id, created_at, expires_at, user_id,
      title, game, rarity, price, description,
      type, accepts, status, promoted, views, images, quantity,
      profiles (
        id, username, trade_count, rating, review_count, badge, badges, avatar_url
      )
    `)
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ─── REVIEW HELPERS ──────────────────────────────────────────────

export async function getReviews(sellerId) {
  if (!sellerId) return []
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      reviewer:profiles!reviews_reviewer_id_fkey (username, avatar_url)
    `)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })

  // If the FK join fails, fall back to fetching without the join
  if (error || !data) {
    const { data: fallback } = await supabase
      .from('reviews')
      .select('id, created_at, seller_id, reviewer_id, listing_id, rating, comment')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
    return fallback || []
  }
  return data
}

export async function createReview({ reviewerId, sellerId, listingId, rating, comment }) {
  // Use maybeSingle() — single() throws when 0 rows (PGRST116), maybeSingle() returns null
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('reviewer_id', reviewerId)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (existing) throw new Error('You already left a review for this listing.')

  const { data, error } = await supabase
    .from('reviews')
    .insert({ reviewer_id: reviewerId, seller_id: sellerId, listing_id: listingId, rating, comment })
    .select()
    .single()
  if (error) throw error

  // Rating recalculation is now handled by the DB trigger recalculate_seller_rating
  // No client-side update needed

  return data
}

// ─── MESSAGE HELPERS ─────────────────────────────────────────────

export async function getConversations(userId) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      archived_by,
      listings!left (id, title, images, status),
      sender:profiles!messages_sender_id_fkey (id, username, avatar_url),
      receiver:profiles!messages_receiver_id_fkey (id, username, avatar_url)
    `)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error

  // Group by conversation (listing + other user), most recent first
  // Skip conversations this user has archived
  const seen = new Set()
  const conversations = []
  for (const msg of data || []) {
    const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id
    const key = `${msg.listing_id}-${otherId}`
    if (!seen.has(key)) {
      seen.add(key)
      // Hide if this user archived the conversation
      if (msg.archived_by?.includes(userId)) continue
      conversations.push(msg)
    }
  }
  return conversations
}

export async function getMessages(userId, otherUserId, listingId) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey (id, username, avatar_url)
    `)
    .eq('listing_id', listingId)
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: true })

  if (error) throw error

  // Mark as read
  await supabase.from('messages')
    .update({ read: true })
    .eq('receiver_id', userId)
    .eq('listing_id', listingId)
    .eq('sender_id', otherUserId)

  return data
}

export async function sendMessage({ senderId, receiverId, listingId, content }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, listing_id: listingId, content })
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey (id, username, avatar_url)
    `)
    .single()
  if (error) throw error
  return data
}

export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('read', false)
  if (error) return 0
  return count
}

// ─── IMAGE UPLOAD HELPER ─────────────────────────────────────────

export async function uploadListingImage(file, listingId, index) {
  const ext = file.name.split('.').pop()
  const path = `listings/${listingId}/${index}.${ext}`

  const { error } = await supabase.storage
    .from('listing-images')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('listing-images')
    .getPublicUrl(path)

  return publicUrl
}
