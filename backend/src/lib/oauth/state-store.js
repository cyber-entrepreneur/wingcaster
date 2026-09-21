/**
 * Typed oauth_states persistence — create, atomic consumeOnce, GC.
 */
import { randomUUID } from 'node:crypto'
import { encryptSecret, decryptSecret } from '../credentials.js'
import { insert, transaction } from '../../persistence/index.js'
import { withMarketplaceTenant } from '../social/marketplace-tenant.js'

const GROWTH_OS_ROLE = 'growth_os_app_role'

const DEFAULT_TTL_MS = 10 * 60 * 1000

export class OAuthStateError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.name = 'OAuthStateError'
  }
}

/**
 * @param {{
 *   agentId: string,
 *   agencyId?: string|null,
 *   platform: string,
 *   codeVerifier?: string|null,
 *   redirectUri: string,
 *   returnTo?: string|null,
 *   elevated?: boolean,
 *   ttlMs?: number,
 * }} params
 */
export async function create({
  agentId,
  agencyId = null,
  platform,
  codeVerifier = null,
  redirectUri,
  returnTo = null,
  elevated = false,
  ttlMs = DEFAULT_TTL_MS,
}) {
  if (!agencyId) {
    throw Object.assign(new Error('agency_id is required for oauth state'), { code: 'TENANT_REQUIRED' })
  }

  const id = randomUUID()
  const nonce = randomUUID()
  const expiresAt = new Date(Date.now() + ttlMs).toISOString()

  await withMarketplaceTenant(agencyId, agentId, async () => {
    await insert('oauth_states', {
      id,
      agent_id: agentId,
      agency_id: agencyId,
      platform,
      code_verifier_encrypted: codeVerifier ? encryptSecret(codeVerifier) : null,
      redirect_uri: redirectUri,
      return_to: returnTo,
      elevated: Boolean(elevated),
      nonce,
      expires_at: expiresAt,
    })
  })

  return { id, nonce, expiresAt }
}

/**
 * Atomically consume a state row (single-use).
 *
 * @param {string} stateId
 * @param {{ platform: string, agencyId?: string|null }} expected
 */
export async function consumeOnce(stateId, { platform, agencyId = null }) {
  return transaction(async (client) => {
    // Capability read (state id is the auth token); lock row before tenant-scoped update.
    const { rows } = await client.query(
      'SELECT * FROM public.oauth_states WHERE id = $1 FOR UPDATE',
      [stateId],
    )
    const row = rows[0]
    if (!row) {
      throw new OAuthStateError('missing', 'Invalid or expired state')
    }
    if (row.platform !== platform) {
      throw new OAuthStateError('platform_mismatch', 'Invalid or expired state')
    }
    if (row.consumed_at) {
      throw new OAuthStateError('consumed', 'State already used')
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      throw new OAuthStateError('expired', 'State expired — restart the connect flow')
    }
    if (agencyId != null && row.agency_id != null && row.agency_id !== agencyId) {
      throw new OAuthStateError('agency_mismatch', 'Invalid or expired state')
    }
    if (!row.agency_id && !row.agent_id) {
      throw new OAuthStateError('missing', 'Invalid or expired state')
    }

    await client.query(`SET LOCAL ROLE ${GROWTH_OS_ROLE}`)
    if (row.agency_id) {
      await client.query('SELECT set_config($1, $2, true)', ['app.agency_id', String(row.agency_id)])
    }
    if (row.agent_id) {
      await client.query('SELECT set_config($1, $2, true)', ['app.agent_id', String(row.agent_id)])
    }

    await client.query(
      `UPDATE public.oauth_states
          SET consumed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [stateId],
    )

    let codeVerifier = null
    if (row.code_verifier_encrypted) {
      codeVerifier = decryptSecret(row.code_verifier_encrypted)
    }

    return {
      id: row.id,
      agent_id: row.agent_id,
      agency_id: row.agency_id,
      platform: row.platform,
      code_verifier: codeVerifier,
      redirect_uri: row.redirect_uri,
      return_to: row.return_to,
      elevated: row.elevated,
      nonce: row.nonce,
      expires_at: row.expires_at,
    }
  })
}

/**
 * Delete expired oauth_states rows.
 * @returns {Promise<number>} rows removed
 */
export async function gcExpired() {
  return transaction(async (client) => {
    const { rowCount } = await client.query(
      `DELETE FROM public.oauth_states
        WHERE expires_at < CURRENT_TIMESTAMP
           OR consumed_at IS NOT NULL`,
    )
    return rowCount || 0
  })
}
