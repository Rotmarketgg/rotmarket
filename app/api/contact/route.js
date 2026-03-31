import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'davari101@gmail.com'
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'RotMarket <onboarding@resend.dev>'

// Distributed rate limiting via Upstash REST (if configured), with in-memory fallback.
// This keeps protection durable across serverless instances.
const submissions = new Map()
const RATE_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const MAX_PER_WINDOW = 3

function normalizeIp(rawIp) {
  return String(rawIp || 'unknown').trim().slice(0, 128)
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeHeader(value = '') {
  return String(value).replace(/[\r\n]+/g, ' ').trim()
}

function isValidEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function checkContactRateLimit(ip) {
  const key = normalizeIp(ip)
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (upstashUrl && upstashToken) {
    try {
      const redisKey = `contact:rl:${key}`
      const res = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['PEXPIRE', redisKey, RATE_WINDOW_MS, 'NX'],
        ]),
      })
      if (res.ok) {
        const data = await res.json()
        const count = Number(data?.[0]?.result ?? 0)
        return count <= MAX_PER_WINDOW
      }
    } catch (_) {
      // Fall back to in-memory limiter if Upstash is unreachable.
    }
  }

  // Fallback for local dev / missing Redis config.
  const now = Date.now()
  const history = (submissions.get(key) || []).filter(t => now - t < RATE_WINDOW_MS)
  if (history.length >= MAX_PER_WINDOW) return false
  history.push(now)
  submissions.set(key, history)

  if (submissions.size > 1000) {
    for (const [k, v] of submissions.entries()) {
      if (v.every(t => now - t > RATE_WINDOW_MS)) submissions.delete(k)
    }
  }
  return true
}

const TOPIC_LABELS = {
  scam: '🚨 Scam Report',
  bug: '🐛 Bug Report',
  listing: '🗑️ Listing Report',
  account: '🔐 Account Issue',
  badge: '✓ Badge Request',
  other: '💬 General Question',
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown'
    if (!(await checkContactRateLimit(ip))) {
      return Response.json({ error: 'Too many requests. Please wait 10 minutes.' }, { status: 429 })
    }

    const { topic, email, username, message } = await request.json()

    if (!topic || !email || !message) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Basic input validation
    if (message.length > 2000) {
      return Response.json({ error: 'Message too long.' }, { status: 400 })
    }
    const cleanEmail = String(email || '').trim().toLowerCase()
    if (!isValidEmail(cleanEmail) || cleanEmail.length > 200) {
      return Response.json({ error: 'Invalid email.' }, { status: 400 })
    }

    if (!Object.keys(TOPIC_LABELS).includes(topic)) {
      return Response.json({ error: 'Invalid topic.' }, { status: 400 })
    }

    const topicLabel = TOPIC_LABELS[topic] || topic
    const cleanUsername = String(username || '').trim().slice(0, 60)
    const subject = sanitizeHeader(
      `[RotMarket] ${topicLabel}${cleanUsername ? ` from ${cleanUsername}` : ''}`
    )
    const safeTopicLabel = escapeHtml(topicLabel)
    const safeEmail = escapeHtml(cleanEmail)
    const safeUsername = escapeHtml(cleanUsername)
    const safeMessage = escapeHtml(String(message || '').trim())

    const { error: sendError } = await resend.emails.send({
      from: CONTACT_FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: cleanEmail,
      subject,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #111118; color: #f9fafb; padding: 32px; border-radius: 12px;">
          <h2 style="color: #4ade80; margin: 0 0 24px; font-size: 20px;">
            ${safeTopicLabel}
          </h2>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 13px; width: 120px;">Topic</td>
              <td style="padding: 8px 0; color: #f9fafb; font-size: 13px;">${safeTopicLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">From Email</td>
              <td style="padding: 8px 0; color: #f9fafb; font-size: 13px;">${safeEmail}</td>
            </tr>
            ${cleanUsername ? `
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">Username</td>
              <td style="padding: 8px 0; color: #f9fafb; font-size: 13px;">${safeUsername}</td>
            </tr>
            ` : ''}
          </table>

          <div style="background: #1a1a2e; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <div style="color: #9ca3af; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Message</div>
            <div style="color: #f9fafb; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${safeMessage}</div>
          </div>

          <div style="border-top: 1px solid #2d2d3f; padding-top: 16px; color: #6b7280; font-size: 12px;">
            Reply to this email to respond directly to ${safeEmail}
          </div>
        </div>
      `,
    })
    if (sendError) {
      throw new Error(sendError.message || 'Failed to send email')
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return Response.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
