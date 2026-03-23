import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

// ─── CUSTOM LOCK IMPLEMENTATION ──────────────────────────────────
// Supabase's gotrue-js v2.64+ uses navigator.locks (Web Locks API) to
// serialize session reads/writes. When a browser tab is suspended in the
// background, held locks are never released. On tab return, Supabase tries
// to re-acquire the lock, times out after 5000ms, and throws:
//   DOMException: The lock request is aborted
// This makes getSession() return null even with a valid token in localStorage.
// Fix: no-op lock. We are a single-tab SPA with sequential auth operations.
const noopLock = async (name, acquireOptions, fn) => fn()

function makeClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'rotmarket-auth',
      lock: noopLock,
    },
  })
}

// Export a mutable ref so all imports always use the current instance.
// When the client is recreated on tab return, every caller (getListings,
// getProfile, etc.) automatically uses the new healthy instance because
// they all go through this exported object.
export let supabase = makeClient()

// ─── TAB VISIBILITY RECOVERY ─────────────────────────────────────
// When the Supabase client gets permanently stuck after tab suspension
// (broken fetch connections, corrupted internal state), the only reliable
// fix is to recreate the client entirely — exactly what a hard refresh does.
//
// Detection: after tab return, attempt getSession() with a 3s timeout.
// If it fails or returns nothing, the client is stuck → recreate it.
// This mirrors exactly what a hard refresh achieves, without a page reload.
if (typeof window !== 'undefined') {
  let tabVisibleTimer = null

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return

    // Debounce — Firefox fires visibilitychange 2-3x per tab return
    if (tabVisibleTimer) clearTimeout(tabVisibleTimer)

    tabVisibleTimer = setTimeout(async () => {
      tabVisibleTimer = null

      // Test if the current client is healthy with a hard 3s timeout.
      // A healthy client resolves getSession() in <200ms.
      // A stuck client hangs indefinitely — we kill it at 3s.
      const healthy = await Promise.race([
        supabase.auth.getSession().then(() => true).catch(() => false),
        new Promise(resolve => setTimeout(() => resolve(false), 3000)),
      ])

      if (!healthy) {
        // Client is permanently stuck. Recreate it from scratch.
        // This is equivalent to what a hard refresh does to the JS module,
        // but without losing the page state (scroll position, form data, etc.)
        console.log('[RotMarket] Supabase client stuck — recreating')
        try {
          // Clean up the broken instance's subscriptions and connections
          await supabase.removeAllChannels()
          supabase.realtime.disconnect()
        } catch (_) {}

        // Replace the exported client. All subsequent calls to supabase.from(),
        // supabase.auth, etc. will use this new healthy instance.
        supabase = makeClient()
      }

      // Reconnect realtime on the (possibly new) client
      supabase.realtime.connect()

      // Signal pages that the client is healthy and ready for fetches
      window.dispatchEvent(new Event('rotmarket:tab-visible'))
    }, 300)
  })
}

// ─── AUTH HELPERS ────────────────────────────────────────────────

// getUser — live network call to verify token. Use when writing data.
export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) return null
  return user
}

// getSessionUser — reads session from localStorage. Fast, no network call.
// Safe to call immediately after rotmarket:tab-visible because the client
// has already been verified (or recreated) healthy by that point.
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
      data: { username }
    }
  })
  if (error) throw error

  if (data.user && data.session) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: data.user.id, username })
      .select()
    if (profileError) console.warn('Profile upsert warning:', profileError.message)
  }

  return data
}

export async function signIn(emailOrUsername, password) {
  let email = emailOrUsername

  if (!emailOrUsername.includes('@')) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', emailOrUsername)
      .single()
    if (error || !data) throw new Error('No account found with that username.')

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
  const applyFilters = (q) => {
    q = q.neq('status', 'deleted').neq('status', 'expired')
    if (game) q = q.eq('game', game)
    if (type) q = q.eq('type', type)
    if (status) q = q.eq('status', status)
    if (search) q = q.ilike('title', `%${search.trim().slice(0, 100)}%`)
    return q
  }

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
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query.select().single()
  if (error) throw error
  return data
}

export async function deleteListing(id) {
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

  const seen = new Set()
  const conversations = []
  for (const msg of data || []) {
    const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id
    const key = `${msg.listing_id}-${otherId}`
    if (!seen.has(key)) {
      seen.add(key)
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
