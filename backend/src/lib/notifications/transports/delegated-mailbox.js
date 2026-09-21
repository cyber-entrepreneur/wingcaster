/**
 * Per-tenant delegated mailbox transport (Gmail API + Graph /me/sendMail).
 *
 * Separate from transports/graph.js, which uses app-only client credentials for
 * platform OTP. This path sends as the connected tenant mailbox via OAuth tokens.
 */
import { getFreshAccessToken } from '../../oauth/token-store.js'

function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function toRecipient(email) {
  return { emailAddress: { address: email } }
}

function buildRfc2822({ from, to, subject, body, html, replyTo }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject || ''}`,
    'MIME-Version: 1.0',
  ]
  if (replyTo) lines.push(`Reply-To: ${replyTo}`)
  if (html) {
    lines.push('Content-Type: text/html; charset=utf-8')
    lines.push('')
    lines.push(html)
  } else {
    lines.push('Content-Type: text/plain; charset=utf-8')
    lines.push('')
    lines.push(body || '')
  }
  return lines.join('\r\n')
}

function encodeGmailRaw(message) {
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function resolveMailboxFrom(connection) {
  const settings = connection?.settings || {}
  return normaliseEmail(
    settings.mailbox_email
    || settings.handle
    || connection.account_name
    || '',
  )
}

async function sendViaGmail(accessToken, connection, { to, subject, body, html, replyTo }, fetchFn) {
  const from = resolveMailboxFrom(connection)
  if (!from) {
    const err = new Error('Connected Gmail mailbox has no sender address')
    err.code = 'MAILBOX_MISCONFIGURED'
    throw err
  }

  const raw = encodeGmailRaw(buildRfc2822({ from, to, subject, body, html, replyTo }))
  const res = await fetchFn('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })

  const parsed = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = parsed?.error?.message || `Gmail send failed (HTTP ${res.status})`
    const err = new Error(message)
    err.code = 'GMAIL_SEND_FAILED'
    err.status = res.status
    err.details = parsed
    throw err
  }

  return {
    ok: true,
    provider: 'gmail',
    provider_message_id: parsed?.id || null,
    to,
    subject: subject || '',
    status: 'accepted',
    from,
  }
}

async function sendViaMicrosoftDelegated(accessToken, { to, subject, body, html, replyTo }, fetchFn) {
  const message = {
    subject: subject || '',
    toRecipients: [toRecipient(to)],
    body: html
      ? { contentType: 'HTML', content: html }
      : { contentType: 'Text', content: body || '' },
  }
  if (replyTo) {
    message.replyTo = [toRecipient(replyTo)]
  }

  const res = await fetchFn('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  })

  if (res.status === 202) {
    return {
      ok: true,
      provider: 'microsoft',
      provider_message_id: null,
      to,
      subject: subject || '',
      status: 'accepted',
    }
  }

  const text = await res.text().catch(() => '')
  let parsed = null
  try { parsed = JSON.parse(text) } catch { /* not JSON */ }
  const graphError = parsed?.error?.code || parsed?.error?.message || text.slice(0, 200)
  const err = new Error(`Microsoft Graph delegated sendMail failed (${res.status}): ${graphError || 'unknown error'}`)
  err.code = 'GRAPH_DELEGATED_SEND_FAILED'
  err.status = res.status
  err.details = parsed || text
  throw err
}

/**
 * Send email via a tenant's connected delegated mailbox.
 *
 * @param {object} connection marketplace_connections row (platform google|microsoft)
 * @param {{ to: string, subject?: string, body?: string, html?: string, replyTo?: string }} message
 * @param {{ env?: Record<string, string|undefined>, region?: string|null, fetch?: typeof fetch }} [options]
 */
export async function sendViaDelegatedMailbox(connection, message, options = {}) {
  const {
    env = process.env,
    region = null,
    fetch: fetchFn = fetch,
  } = options

  const recipient = normaliseEmail(message.to)
  if (!recipient) {
    const err = new Error('Recipient email is required')
    err.code = 'MISSING_RECIPIENT'
    throw err
  }
  if (!message.body?.trim() && !message.html?.trim()) {
    const err = new Error('Message body or html is required')
    err.code = 'MISSING_BODY'
    throw err
  }

  const accessToken = await getFreshAccessToken(connection, { env, region, fetch: fetchFn })
  const payload = { ...message, to: recipient }

  if (connection.platform === 'google') {
    return sendViaGmail(accessToken, connection, payload, fetchFn)
  }
  if (connection.platform === 'microsoft') {
    return sendViaMicrosoftDelegated(accessToken, payload, fetchFn)
  }

  const err = new Error(`Unsupported delegated mailbox platform: ${connection.platform}`)
  err.code = 'MAILBOX_UNSUPPORTED'
  throw err
}
