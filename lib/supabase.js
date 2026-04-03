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

// getVerifiedUser — returns the user only if their email is confirmed.
// Use this for any write action (create listing, send offer, message, review, report).
// Returns: { user } on success, { redirect: '/auth/login' } if not logged in,
//          { unverified: true } if logged in but email not confirmed.
export async function getVerifiedUser() {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) return { redirect: '/auth/login' }
  if (!user.email_confirmed_at) return { unverified: true, user }
  return { user }
}

export async function signUp(email, password, username, referralCode = null) {
  // Case-insensitive check — prevents Alice/alice duplicate accounts
  // (login uses ilike so both would resolve to the same user)
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
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

    // Process referral code if provided
    if (referralCode) {
      const code = referralCode.trim().toUpperCase()
      const { error: refError } = await supabase.rpc('complete_referral', {
        p_referral_code: code,
        p_referee_id: data.user.id,
      })
      if (refError) console.warn('Referral processing warning:', refError.message)
    }
  }

  return data
}

export async function signIn(emailOrUsername, password) {
  let email = emailOrUsername
  const input = emailOrUsername.trim()

  if (!input.includes('@')) {
    // Could be a username or a UUID (user ID)
    // Strategy: look up by username (case-insensitive via ilike) OR by id if it looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)

    let profile = null
    if (isUUID) {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', input)
        .maybeSingle()
      profile = data
    } else {
      // Case-insensitive username lookup using ilike
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', input)
        .maybeSingle()
      profile = data
    }

    if (!profile) {
      throw new Error('No account found with that username or user ID. Try logging in with your email address instead.')
    }

    const { data: rpcEmail, error: rpcError } = await supabase
      .rpc('get_email_by_user_id', { user_id: profile.id })

    let resolvedEmail = null
    if (!rpcError && rpcEmail) {
      resolvedEmail = rpcEmail
    }

    // Fallback path: server-side resolver using service role key
    if (!resolvedEmail) {
      try {
        const res = await fetch('/api/auth/resolve-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: profile.id,
            username: isUUID ? null : input,
          }),
        })
        if (res.ok) {
          const payload = await res.json()
          if (payload?.email) resolvedEmail = payload.email
        }
      } catch (_) {}
    }

    if (!resolvedEmail) {
      throw new Error('Username login is temporarily unavailable. Please log in with your email address.')
    }

    email = resolvedEmail
  } else {
    // Email login — normalize to lowercase so it's case-insensitive
    email = input.toLowerCase()
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) {
    // Translate Supabase's generic auth errors into user-friendly messages
    if (error.message?.toLowerCase().includes('invalid login')) {
      throw new Error('Incorrect password. Please try again.')
    }
    throw error
  }
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
      paypal_email, cashapp_handle, venmo_handle,
      referral_code, referral_count, vip_expires_at
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
      created_at
    `)
    .ilike('username', username)
    .single()
  if (error) return null
  return data
}

export async function updateProfile(userId, updates) {
  if (updates.username) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', updates.username)
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

function getBadgeArray(profile) {
  if (!profile) return []
  if (Array.isArray(profile.badges) && profile.badges.length) return profile.badges
  if (typeof profile.badge === 'string' && profile.badge.trim()) return [profile.badge.trim()]
  return []
}

// Promotions are only valid for paid VIP tiers.
function normalizePromotion(listing) {
  if (!listing) return listing
  const badges = getBadgeArray(listing.profiles)
  const eligible = badges.includes('VIP') || badges.includes('VIP Plus') || badges.includes('VIP Max')
  if (listing.promoted && !eligible) return { ...listing, promoted: false }
  return listing
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
      profiles!inner (
        id, username, trade_count, rating, review_count, badge, badges, avatar_url, banned
      )
    `)
    .eq('profiles.banned', false)
    .order('promoted', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  )

  let countQuery = applyFilters(
    supabase.from('listings')
      .select('id, profiles!inner(banned)', { count: 'exact', head: true })
      .eq('profiles.banned', false)
  )

  const [{ data, error }, { count }] = await Promise.all([dataQuery, countQuery])
  if (error) throw error
  return { data: (data || []).map(normalizePromotion), total: count || 0 }
}

export async function getListing(id) {
  if (!id || id === 'undefined') throw new Error('Invalid listing ID')

  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      profiles (
        id, username, epic_username, roblox_username,
        trade_count, rating, review_count, badge, badges, avatar_url, bio
      )
    `)
    .eq('id', id)
    .neq('status', 'deleted')
    .single()
  if (error) throw error

  if (data.user_id !== (await getSessionUser())?.id) {
    // Server-side increment path is more reliable than client-side RPC across RLS/function signature differences.
    // Fire-and-forget: view counting should never block listing rendering.
    fetch(`/api/listing/${id}/view`, { method: 'POST' }).catch(() => {})
  }

  return normalizePromotion(data)
}

export async function createListing(listing) {
  const { data, error } = await supabase
    .from('listings')
    .insert(listing)
    .select()
    .single()
  if (error) throw error
  return (data || []).map(normalizePromotion)
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
  // Preferred: use a server-side RPC that runs DISTINCT ON (listing_id, other_user)
  // so we always get one row per thread regardless of message volume.
  //
  // Create this function in Supabase SQL editor:
  //
  //   create or replace function get_conversations(p_user_id uuid)
  //   returns table (
  //     id uuid, created_at timestamptz, listing_id uuid, content text,
  //     sender_id uuid, receiver_id uuid, read boolean, archived_by uuid[],
  //     sender json, receiver json, listings json
  //   ) language sql security definer as $$
  //     select distinct on (
  //       least(sender_id, receiver_id),
  //       greatest(sender_id, receiver_id),
  //       listing_id
  //     )
  //       m.id, m.created_at, m.listing_id, m.content,
  //       m.sender_id, m.receiver_id, m.read, m.archived_by,
  //       row_to_json(s.*) as sender,
  //       row_to_json(r.*) as receiver,
  //       row_to_json(l.*) as listings
  //     from messages m
  //     left join profiles s on s.id = m.sender_id
  //     left join profiles r on r.id = m.receiver_id
  //     left join listings l on l.id = m.listing_id
  //     where m.sender_id = p_user_id or m.receiver_id = p_user_id
  //     order by
  //       least(sender_id, receiver_id),
  //       greatest(sender_id, receiver_id),
  //       listing_id,
  //       m.created_at desc
  //   $$;
  //
  // Until that RPC exists, the JS fallback below runs with a safe 200-message
  // window (up from the old 100) so active users lose fewer threads.

  // Try the efficient RPC first
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_conversations', { p_user_id: userId })

  if (!rpcError && rpcData) {
    // RPC returns one row per conversation — already deduped server-side
    return rpcData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  // Fallback: JS dedup with a larger window (200 messages covers ~95% of users)
  // Log so you know when to prioritise adding the RPC
  console.warn('[RotMarket] get_conversations RPC unavailable, using JS fallback:', rpcError?.message)

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
    .limit(200)

  if (error) throw error

  // Deduplicate: one row per (listing_id + other_user) pair
  const seen = new Set()
  const conversations = []
  for (const msg of data || []) {
    const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id
    const key = `${msg.listing_id ?? 'null'}-${otherId}`
    if (!seen.has(key)) {
      seen.add(key)
      conversations.push(msg)
    }
  }
  return conversations
}

// getMessages removed — use getMessagesPaginated directly.

// Paginated message loader — loads messages in reverse chronological batches.
// Pass cursor = null for the first page (most recent messages).
// Pass cursor = oldest message id from previous page to load earlier messages.
// Returns { messages, hasMore } so the UI can show a "Load earlier messages" button.
export async function getMessagesPaginated(userId, otherUserId, listingId, cursor = null, limit = 50) {
  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey (id, username, avatar_url)
    `)
    .eq('listing_id', listingId)
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: false })
    .limit(limit + 1) // fetch one extra to detect hasMore

  if (cursor) {
    // cursor is a created_at timestamp — fetch messages older than this
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) throw error

  const hasMore = (data?.length || 0) > limit
  const messages = (hasMore ? data.slice(0, limit) : data || []).reverse()

  // Mark received messages as read
  await supabase.from('messages')
    .update({ read: true })
    .eq('receiver_id', userId)
    .eq('listing_id', listingId)
    .eq('sender_id', otherUserId)

  return { messages, hasMore, nextCursor: messages[0]?.created_at ?? null }
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
  // Validate on the client before uploading. Supabase storage policies should
  // also enforce this server-side, but this gives instant UX feedback.
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  const ALLOWED_EXTS  = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type "${file.type}". Only JPEG, PNG, WebP, and GIF images are allowed.`)
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 10 MB.`)
  }

  // Use MIME type to derive the extension — never trust file.name which can be spoofed
  const mimeToExt = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
  const ext = mimeToExt[file.type]
  if (!ext || !ALLOWED_EXTS.includes(ext)) {
    throw new Error('Unsupported image format.')
  }

  const path = `listings/${listingId}/${index}.${ext}`

  const { error } = await supabase.storage
    .from('listing-images')
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '31536000' })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('listing-images')
    .getPublicUrl(path)

  return publicUrl
}
