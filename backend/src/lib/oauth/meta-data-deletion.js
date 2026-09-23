/**
 * Meta (Facebook / Instagram / WhatsApp) data-deletion + deauthorize callbacks.
 *
 * Meta requires apps that access user data to expose:
 *   - a Data Deletion Request callback (returns a status URL + confirmation code), and
 *   - a Deauthorize callback (fired when a user removes the app).
 * Both are POSTed with a `signed_request` (`<base64url-sig>.<base64url-payload>`,
 * HMAC-SHA256 over the payload with the app secret — distinct from the
 * X-Hub-Signature-256 webhook-event scheme).
 *
 * Deletion scrubs the Meta-connected tenant connections for the app-scoped user id:
 * status -> disconnected, health -> data_deleted, credentials wiped. This spans
 * tenants (a Meta user id is not tenant-scoped), so it uses plain DAL calls, which
 * run as the privileged default role and bypass PR6 RLS — the same cross-tenant
 * pattern used by the token-refresh sweep. It never runs under withTenant.
 */
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { findAll, findOne, insert, update } from '../../persistence/index.js'

/** Meta-backed platforms whose per-tenant connections store a Meta user id. */
export const META_DELETION_PLATFORMS = ['facebook', 'instagram', 'whatsapp']

function base64UrlDecode(input) {
  const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64')
}

/**
 * Verify + decode a Meta `signed_request`.
 * @param {string} signedRequest
 * @param {string} appSecret
 * @returns {{ user_id?: string, algorithm?: string, issued_at?: number }}
 */
export function parseSignedRequest(signedRequest, appSecret) {
  if (!appSecret) {
    throw Object.assign(new Error('Meta app secret is not configured'), { code: 'APP_SECRET_MISSING' })
  }
  if (typeof signedRequest !== 'string' || !signedRequest.includes('.')) {
    throw Object.assign(new Error('Malformed signed_request'), { code: 'BAD_SIGNED_REQUEST' })
  }
  const [encodedSig, encodedPayload] = signedRequest.split('.', 2)
  if (!encodedSig || !encodedPayload) {
    throw Object.assign(new Error('Malformed signed_request'), { code: 'BAD_SIGNED_REQUEST' })
  }

  const expected = createHmac('sha256', appSecret).update(encodedPayload).digest()
  const provided = base64UrlDecode(encodedSig)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw Object.assign(new Error('signed_request signature mismatch'), { code: 'BAD_SIGNATURE' })
  }

  let payload
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'))
  } catch {
    throw Object.assign(new Error('signed_request payload is not valid JSON'), { code: 'BAD_PAYLOAD' })
  }
  if (payload?.algorithm && String(payload.algorithm).toUpperCase() !== 'HMAC-SHA256') {
    throw Object.assign(
      new Error(`Unsupported signed_request algorithm: ${payload.algorithm}`),
      { code: 'BAD_ALGORITHM' },
    )
  }
  return payload
}

export function generateConfirmationCode() {
  return `del_${randomBytes(16).toString('hex')}`
}

function connectionMetaUserId(connection) {
  return connection?.settings?.credentials?.user_id ?? null
}

/**
 * Disconnect + wipe tokens for every Meta connection tied to `providerUserId`.
 * Cross-tenant plain DAL (bypasses RLS); never runs under withTenant.
 *
 * @param {string|number|null|undefined} providerUserId
 * @returns {Promise<{ scrubbed: number, connectionIds: string[] }>}
 */
export async function scrubMetaUserConnections(providerUserId) {
  if (providerUserId == null || providerUserId === '') {
    return { scrubbed: 0, connectionIds: [] }
  }
  const target = String(providerUserId)
  const all = await findAll('marketplace_connections')
  const matches = all.filter(
    (c) => META_DELETION_PLATFORMS.includes(c.platform)
      && connectionMetaUserId(c) != null
      && String(connectionMetaUserId(c)) === target,
  )

  const connectionIds = []
  for (const conn of matches) {
    await update('marketplace_connections', (c) => c.id === conn.id, (c) => ({
      ...c,
      status: 'disconnected',
      health: 'data_deleted',
      settings: {
        ...(c.settings || {}),
        credentials: {},
        data_deleted_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }))
    connectionIds.push(conn.id)
  }
  return { scrubbed: connectionIds.length, connectionIds }
}

/**
 * Persist the deletion request so the status URL can report on it later.
 */
export async function recordDeletionRequest({
  provider = 'meta',
  providerUserId = null,
  confirmationCode,
  scrubbed = 0,
  status = 'completed',
}) {
  const id = `oddr_${randomBytes(12).toString('hex')}`
  const now = new Date().toISOString()
  await insert('oauth_data_deletion_requests', {
    id,
    provider,
    provider_user_id: providerUserId != null ? String(providerUserId) : null,
    confirmation_code: confirmationCode,
    status,
    connections_scrubbed: scrubbed,
    requested_at: now,
    completed_at: status === 'completed' ? now : null,
  })
  return id
}

export async function getDeletionStatus(confirmationCode) {
  if (!confirmationCode) return null
  return findOne('oauth_data_deletion_requests', (r) => r.confirmation_code === confirmationCode)
}

/**
 * Full Data Deletion Request handler: verify → scrub → record → build response.
 * @returns {Promise<{ url: string, confirmation_code: string, scrubbed: number }>}
 */
export async function handleMetaDataDeletion({ signedRequest, appSecret, statusBaseUrl }) {
  const payload = parseSignedRequest(signedRequest, appSecret)
  const providerUserId = payload?.user_id ?? null
  const confirmationCode = generateConfirmationCode()
  const { scrubbed } = await scrubMetaUserConnections(providerUserId)
  await recordDeletionRequest({ providerUserId, confirmationCode, scrubbed, status: 'completed' })
  // Normalize the base: tolerate a trailing slash and an already-present /api segment
  // so the status path is appended exactly once regardless of caller.
  const base = String(statusBaseUrl || '').replace(/\/api\/?$/, '').replace(/\/+$/, '')
  const url = `${base}/api/oauth/meta/data-deletion/status?code=${encodeURIComponent(confirmationCode)}`
  return { url, confirmation_code: confirmationCode, scrubbed }
}

/**
 * Deauthorize callback handler: verify → scrub (no status URL required by Meta).
 */
export async function handleMetaDeauthorize({ signedRequest, appSecret }) {
  const payload = parseSignedRequest(signedRequest, appSecret)
  const providerUserId = payload?.user_id ?? null
  const { scrubbed, connectionIds } = await scrubMetaUserConnections(providerUserId)
  return {
    scrubbed,
    connectionIds,
    provider_user_id: providerUserId != null ? String(providerUserId) : null,
  }
}
