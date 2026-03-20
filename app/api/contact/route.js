import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Your admin email — change this to your real email
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@rotmarket.gg'

// Simple in-memory rate limit — 1 submission per IP per 10 minutes
// For production scale use Redis/Upstash, but this handles abuse at launch
const submissions = new Map()
const RATE_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const MAX_PER_WINDOW = 3

function checkContactRateLimit(ip) {
  const now = Date.now()
  const key = ip || 'unknown'
  const history = (submissions.get(key) || []).filter(t => now - t < RATE_WINDOW_MS)
  if (history.length >= MAX_PER_WINDOW) return false
  history.push(now)
  submissions.set(key, history)
  // Clean old entries periodically
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
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown'
    if (!checkContactRateLimit(ip)) {
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
    if (!email.includes('@') || email.length > 200) {
      return Response.json({ error: 'Invalid email.' }, { status: 400 })
    }
    // Only allow known topics
    if (!Object.keys(TOPIC_LABELS).includes(topic)) {
      return Response.json({ error: 'Invalid topic.' }, { status: 400 })
    }

    const topicLabel = TOPIC_LABELS[topic] || topic
    const subject = `[RotMarket] ${topicLabel}${username ? ` from ${username}` : ''}`

    await resend.emails.send({
      from: 'RotMarket <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      replyTo: email,
      subject,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #111118; color: #f9fafb; padding: 32px; border-radius: 12px;">
          <h2 style="color: #4ade80; margin: 0 0 24px; font-size: 20px;">
            ${topicLabel}
          </h2>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 13px; width: 120px;">Topic</td>
              <td style="padding: 8px 0; color: #f9fafb; font-size: 13px;">${topicLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">From Email</td>
              <td style="padding: 8px 0; color: #f9fafb; font-size: 13px;">${email}</td>
            </tr>
            ${username ? `
            <tr>
              <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">Username</td>
              <td style="padding: 8px 0; color: #f9fafb; font-size: 13px;">${username}</td>
            </tr>
            ` : ''}
          </table>

          <div style="background: #1a1a2e; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <div style="color: #9ca3af; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Message</div>
            <div style="color: #f9fafb; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${message}</div>
          </div>

          <div style="border-top: 1px solid #2d2d3f; padding-top: 16px; color: #6b7280; font-size: 12px;">
            Reply to this email to respond directly to ${email}
          </div>
        </div>
      `,
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return Response.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
