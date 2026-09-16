/**
 * Personal Access Tokens (closes issue #192a).
 *
 * Routes:
 *   POST   /api/settings/api-tokens         — create (returns raw exactly once)
 *   GET    /api/settings/api-tokens         — list caller's tokens (no secrets)
 *   DELETE /api/settings/api-tokens/:id     — revoke (soft delete)
 *
 * Bearer middleware:
 *   `authenticateWithApiToken(req)` — resolves `Authorization: Bearer wc_pat_...`
 *   into a `req.user` so downstream routes see the same shape as a JWT session.
 *   The token's UNIQUE hashed_secret is looked up under SELECT ... LIMIT 1, and
 *   the `last_used_at` update fires-and-forgets so token auth stays fast.
 *
 * Token format:
 *   `wc_pat_<48 URL-safe base64 chars>`
 *   - `wc_pat_` prefix is a clear scannable tag (secret scanning tools can
 *     detect leaked tokens in repos / logs).
 *   - 48 chars of base64url ≈ 288 bits of entropy — well above any brute-force
 *     concern under the standard sha256 hashing.
 *
 * We hash with plain sha256 (not bcrypt): unlike passwords, PATs have full
 * cryptographic entropy so key stretching adds latency without adding safety,
 * and we need every authenticated request to be able to look up by hash in a
 * single indexed query.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { insert, query } from '../../db.js'
import { findUserById } from '../../identity.js'
import logger from '../logger.js'

/** Prefix on every raw PAT — greppable / scannable. */
export const PAT_PREFIX = 'wc_pat_'
/** Bytes of random secret; base64url of 36 bytes → 48 chars. */
const PAT_RANDOM_BYTES = 36

/**
 * Scopes the surface understands today. Empty array on a token = "same
 * permissions as the owning user." Callers may pass any subset.
 * Extend cautiously — every new scope should map to a specific route
 * enforcement point.
 */
export const SUPPORTED_SCOPES = Object.freeze([
  'listings:read',
  'listings:write',
  'inquiries:read',
  'inquiries:write',
  'contacts:read',
  'contacts:write',
])

const SUPPORTED_SCOPE_SET = new Set(SUPPORTED_SCOPES)

/** Max tokens per user. Enterprise-tier admins can revoke old ones; keeps blast radius small. */
export const MAX_TOKENS_PER_USER = 25

function hashSecret(rawToken) {
  return createHash('sha256').update(String(rawToken)).digest('hex')
}

function generateRawToken() {
  const random = randomBytes(PAT_RANDOM_BYTES).toString('base64url')
  return `${PAT_PREFIX}${random}`
}

function isValidPatFormat(candidate) {
  if (typeof candidate !== 'string') return false
  if (!candidate.startsWith(PAT_PREFIX)) return false
  const suffix = candidate.slice(PAT_PREFIX.length)
  // base64url alphabet + minimum length (guards against garbage input hitting DB).
  return suffix.length >= 32 && /^[A-Za-z0-9_-]+$/.test(suffix)
}

/**
 * Serialize a token row for the LIST response — never includes the hash.
 */
function serializeToken(row) {
  return {
    id: row.id,
    name: row.name,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
    agency_id: row.agency_id,
  }
}

/**
 * Resolve `Authorization: Bearer wc_pat_...` into a `req.user` shape.
 * Returns `{ user, tokenRow }` on success, `null` on failure so the caller
 * can fall through to JWT auth or refuse.
 *
 * Callers MUST re-check `user.token_version` semantics themselves if they
 * depended on that JWT claim — PATs do not carry it and cannot be
 * invalidated by password change alone (they are separately revoke-able).
 */
export async function authenticateWithApiToken(rawToken) {
  if (!isValidPatFormat(rawToken)) return null
  const hash = hashSecret(rawToken)
  const rows = await query(
    `SELECT * FROM api_tokens WHERE hashed_secret = $1 LIMIT 1`,
    [hash],
  )
  const row = rows[0]
  if (!row) return null
  if (row.revoked_at) return null
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null

  const user = await findUserById(row.user_id)
  if (!user) return null

  // Fire-and-forget last_used_at bump. A DB stumble here MUST NOT fail the
  // authenticated request — token was valid, action should proceed.
  query(
    `UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [row.id],
  ).catch((err) => logger.error({ err, tokenId: row.id }, 'api_token last_used_at update failed'))

  return { user, tokenRow: row }
}

function validateCreateBody(body) {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Body must be an object' }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return { valid: false, error: 'name is required' }
  if (name.length > 120) return { valid: false, error: 'name must be under 120 characters' }
  let scopes = []
  if (body.scopes !== undefined) {
    if (!Array.isArray(body.scopes)) return { valid: false, error: 'scopes must be an array' }
    for (const s of body.scopes) {
      if (typeof s !== 'string' || !SUPPORTED_SCOPE_SET.has(s)) {
        return { valid: false, error: `Unsupported scope: ${JSON.stringify(s)}` }
      }
    }
    scopes = Array.from(new Set(body.scopes)).sort()
  }
  let expiresAt = null
  if (body.expires_at !== undefined && body.expires_at !== null) {
    const d = new Date(body.expires_at)
    if (Number.isNaN(d.getTime())) return { valid: false, error: 'expires_at must be a valid ISO date' }
    if (d.getTime() <= Date.now()) return { valid: false, error: 'expires_at must be in the future' }
    expiresAt = d.toISOString()
  }
  return { valid: true, name, scopes, expiresAt }
}

/**
 * Register the routes on the given Express app.
 *
 * @param {import('express').Express} app
 * @param {object} deps
 * @param {Function} deps.authMiddleware
 */
export function registerApiTokenRoutes(app, deps) {
  const auth = deps.authMiddleware

  app.post('/api/settings/api-tokens', auth, async (req, res, next) => {
    try {
      const validation = validateCreateBody(req.body)
      if (!validation.valid) return res.status(400).json({ error: validation.error })

      const existing = await query(
        `SELECT COUNT(*)::int AS n FROM api_tokens WHERE user_id = $1 AND revoked_at IS NULL`,
        [req.user.id],
      )
      if ((existing[0]?.n ?? 0) >= MAX_TOKENS_PER_USER) {
        return res.status(409).json({
          error: 'token_limit_reached',
          message: `You have reached the maximum of ${MAX_TOKENS_PER_USER} active tokens. Revoke one before creating a new token.`,
        })
      }

      // Loop-until-unique — vanishingly unlikely to collide but the UNIQUE
      // constraint makes the failure mode explicit if it ever does.
      let rawToken
      let hash
      for (let attempt = 0; attempt < 3; attempt += 1) {
        rawToken = generateRawToken()
        hash = hashSecret(rawToken)
        const collision = await query(
          `SELECT 1 FROM api_tokens WHERE hashed_secret = $1 LIMIT 1`,
          [hash],
        )
        if (!collision.length) break
        rawToken = null
      }
      if (!rawToken) {
        logger.error('api_tokens: exhausted 3 attempts to mint a unique secret')
        return res.status(500).json({ error: 'Could not mint token. Try again.' })
      }

      const row = {
        id: randomUUID(),
        user_id: req.user.id,
        agency_id: req.user.agency_id || null,
        name: validation.name,
        hashed_secret: hash,
        scopes: validation.scopes,
        last_used_at: null,
        expires_at: validation.expiresAt,
        revoked_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await insert('api_tokens', row)

      return res.status(201).json({
        // Shown to the user exactly once. There is no endpoint that returns
        // this again — matches the enrollment / backup-codes discipline.
        token: rawToken,
        record: serializeToken(row),
      })
    } catch (err) {
      return next(err)
    }
  })

  app.get('/api/settings/api-tokens', auth, async (req, res, next) => {
    try {
      const rows = await query(
        `SELECT * FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC`,
        [req.user.id],
      )
      return res.json({ tokens: rows.map(serializeToken) })
    } catch (err) {
      return next(err)
    }
  })

  app.delete('/api/settings/api-tokens/:id', auth, async (req, res, next) => {
    try {
      const rows = await query(
        `SELECT id, user_id, revoked_at FROM api_tokens WHERE id = $1 LIMIT 1`,
        [req.params.id],
      )
      const row = rows[0]
      if (!row) return res.status(404).json({ error: 'Not found' })
      // Enforce ownership — a user can only revoke their own tokens.
      if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
      if (row.revoked_at) return res.status(204).end()
      await query(
        `UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [req.params.id],
      )
      return res.status(204).end()
    } catch (err) {
      return next(err)
    }
  })
}

// Exported for tests.
export const __testables = {
  SUPPORTED_SCOPES,
  SUPPORTED_SCOPE_SET,
  MAX_TOKENS_PER_USER,
  PAT_PREFIX,
  hashSecret,
  generateRawToken,
  isValidPatFormat,
  validateCreateBody,
  serializeToken,
}
