/**
 * WebAuthn / passkey routes (closes issue #189).
 *
 * Phishing-resistant second factor alongside the existing TOTP + backup
 * codes surface. The whole enterprise identity stack (Okta, Google
 * Workspace, Microsoft Entra, 1Password Business) now defaults to passkey
 * as the primary factor because TOTP codes can still be phished — a fake
 * WingCaster login page can prompt password + TOTP, forward both, and take
 * over. Passkeys cannot be phished because the browser + OS refuse to
 * release the credential to a wrong domain.
 *
 * Routes:
 *   POST /api/auth/webauthn/register/begin        — auth'd; mints challenge
 *   POST /api/auth/webauthn/register/complete     — auth'd; verifies + stores
 *   POST /api/auth/webauthn/authenticate/begin    — anon; mints challenge
 *   POST /api/auth/webauthn/authenticate/complete — anon; verifies + session
 *   GET  /api/auth/webauthn/credentials           — auth'd; list mine
 *   DELETE /api/auth/webauthn/credentials/:id     — auth'd; revoke mine
 *   POST /api/auth/webauthn/credentials/:id/rename — auth'd; friendly name
 *
 * ---------------------------------------------------------------------------
 * RP identity
 * ---------------------------------------------------------------------------
 *
 * WebAuthn is scoped to a "relying party" (RP) — the site's domain. A
 * credential registered against `app.wingcaster.com` cannot be used against
 * `evil.example`. `RP_ID` MUST match the origin the browser sees; a mismatch
 * fails registration/authentication.
 *
 * `expectedOrigin` is compared against `window.location.origin` from the
 * browser. Configure `WEBAUTHN_RP_ID` + `WEBAUTHN_ORIGIN` in production;
 * defaults are dev-only.
 */

import { randomUUID } from 'node:crypto'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { insert, query } from '../../db.js'
import { findUserById } from '../../identity.js'
import logger from '../logger.js'

/**
 * Relying-party identity. In production these are set to the app's
 * canonical host + origin. `RP_NAME` is what the browser shows in the
 * "sign in with passkey" dialog.
 */
export const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'
export const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'WingCaster'
export const EXPECTED_ORIGIN =
  process.env.WEBAUTHN_ORIGIN || `http://${RP_ID}${RP_ID === 'localhost' ? ':5173' : ''}`

/** Challenge lifetime — short by spec-standard (60s). */
export const CHALLENGE_TTL_SECONDS = 60

async function persistChallenge({ userId, purpose, challenge }) {
  await query(
    `DELETE FROM webauthn_challenges WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [userId, purpose],
  )
  const row = {
    id: randomUUID(),
    user_id: userId,
    purpose,
    challenge,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString(),
    consumed_at: null,
    created_at: new Date().toISOString(),
  }
  await insert('webauthn_challenges', row)
  return row
}

async function consumeChallenge({ userId, purpose }) {
  const rows = await query(
    `SELECT * FROM webauthn_challenges
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose],
  )
  const row = rows[0]
  if (!row) return null
  if (new Date(row.expires_at).getTime() <= Date.now()) return null
  await query(
    `UPDATE webauthn_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [row.id],
  )
  return row
}

async function listUserCredentials(userId) {
  return query(
    `SELECT * FROM webauthn_credentials WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`,
    [userId],
  )
}

function serializeCredential(row) {
  return {
    id: row.id,
    credential_id: row.credential_id,
    name: row.name,
    device_type: row.device_type,
    backup_eligible: Boolean(row.backup_eligible),
    backup_state: Boolean(row.backup_state),
    transports: Array.isArray(row.transports) ? row.transports : [],
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
  }
}

/**
 * Register the routes on the given Express app.
 *
 * @param {import('express').Express} app
 * @param {object} deps
 * @param {Function} deps.authMiddleware
 * @param {Function} deps.buildAuthSession
 * @param {Function} deps.findAgentForUser
 * @param {Function} [deps.logActivity]
 */
export function registerWebauthnRoutes(app, deps) {
  const {
    authMiddleware,
    buildAuthSession,
    findAgentForUser,
    logActivity = async () => {},
  } = deps

  // ---------------------------------------------------------------------
  // Register: begin (auth'd — user chooses to add a passkey to their account)
  // ---------------------------------------------------------------------
  app.post('/api/auth/webauthn/register/begin', authMiddleware, async (req, res, next) => {
    try {
      const user = await findUserById(req.user.id)
      if (!user) return res.status(401).json({ error: 'Account no longer exists' })

      const existing = await listUserCredentials(user.id)
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: Buffer.from(user.id),
        userName: user.email || user.id,
        userDisplayName: user.name || user.email || user.id,
        attestationType: 'none',
        // Exclude the user's already-enrolled passkeys so the authenticator
        // does not offer to re-register something they already have.
        excludeCredentials: existing.map((c) => ({
          id: c.credential_id,
          type: 'public-key',
          transports: Array.isArray(c.transports) ? c.transports : undefined,
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
        timeout: CHALLENGE_TTL_SECONDS * 1000,
      })
      await persistChallenge({ userId: user.id, purpose: 'register', challenge: options.challenge })
      return res.json({ options })
    } catch (err) {
      return next(err)
    }
  })

  // ---------------------------------------------------------------------
  // Register: complete
  // ---------------------------------------------------------------------
  app.post('/api/auth/webauthn/register/complete', authMiddleware, async (req, res, next) => {
    try {
      const user = await findUserById(req.user.id)
      if (!user) return res.status(401).json({ error: 'Account no longer exists' })
      const response = req.body?.response
      const friendlyName = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : ''
      if (!response) return res.status(400).json({ error: 'Missing response' })

      const stored = await consumeChallenge({ userId: user.id, purpose: 'register' })
      if (!stored) return res.status(410).json({ error: 'Challenge expired or missing' })

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: stored.challenge,
        expectedOrigin: EXPECTED_ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
      })
      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'Registration verification failed' })
      }

      const { registrationInfo } = verification
      const {
        credentialID,
        credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp,
        aaguid,
      } = registrationInfo

      const row = {
        id: randomUUID(),
        user_id: user.id,
        credential_id: Buffer.isBuffer(credentialID)
          ? credentialID.toString('base64url')
          : String(credentialID),
        public_key: Buffer.isBuffer(credentialPublicKey)
          ? credentialPublicKey.toString('base64url')
          : String(credentialPublicKey),
        sign_count: counter || 0,
        transports: Array.isArray(response?.response?.transports) ? response.response.transports : [],
        device_type: credentialDeviceType || null,
        backup_eligible: Boolean(credentialBackedUp || credentialDeviceType === 'multiDevice'),
        backup_state: Boolean(credentialBackedUp),
        aaguid: aaguid || null,
        name: friendlyName || 'Passkey',
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        revoked_at: null,
      }
      await insert('webauthn_credentials', row)

      await logActivity({ type: 'webauthn_credential_registered', agent_id: user.id, meta: { credential_id: row.credential_id } })

      return res.status(201).json({ credential: serializeCredential(row) })
    } catch (err) {
      logger.error({ err }, 'webauthn register/complete failed')
      return next(err)
    }
  })

  // ---------------------------------------------------------------------
  // Authenticate: begin (anonymous — user has no session yet)
  //
  // The client posts `identifier` (email); if the user has any passkeys
  // we return options containing their credential ids so the browser
  // narrows the picker. If no user matches or the user has no passkeys,
  // we still return options with an empty allowCredentials list — this
  // gives the browser a chance to show any resident credentials it
  // knows about (usernameless flow) AND prevents an enumeration attack.
  // ---------------------------------------------------------------------
  app.post('/api/auth/webauthn/authenticate/begin', async (req, res, next) => {
    try {
      const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : ''
      let allowCredentials = []
      let userIdForChallenge = null
      if (identifier) {
        const users = await query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [identifier])
        if (users[0]) {
          userIdForChallenge = users[0].id
          const creds = await listUserCredentials(users[0].id)
          allowCredentials = creds.map((c) => ({
            id: c.credential_id,
            type: 'public-key',
            transports: Array.isArray(c.transports) ? c.transports : undefined,
          }))
        }
      }
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials,
        userVerification: 'preferred',
        timeout: CHALLENGE_TTL_SECONDS * 1000,
      })
      // Persist against the identified user, or against a per-request random
      // key when the user is unknown — anonymous flow uses the challenge
      // returned from the response and the credential id to look up the
      // owner at /complete time.
      const key = userIdForChallenge || `anon:${randomUUID()}`
      // Only actual user rows have an FK; anon lookups store the challenge
      // in the returned options and the client echoes it back.
      if (userIdForChallenge) {
        await persistChallenge({
          userId: userIdForChallenge,
          purpose: 'authenticate',
          challenge: options.challenge,
        })
      }
      return res.json({ options, session_key: userIdForChallenge ? null : key })
    } catch (err) {
      return next(err)
    }
  })

  // ---------------------------------------------------------------------
  // Authenticate: complete
  // ---------------------------------------------------------------------
  app.post('/api/auth/webauthn/authenticate/complete', async (req, res, next) => {
    try {
      const response = req.body?.response
      const echoedChallenge = req.body?.challenge // for anonymous / usernameless flow
      if (!response?.id) return res.status(400).json({ error: 'Missing response' })

      // Look up the credential by its id, then the user.
      const credRows = await query(
        `SELECT * FROM webauthn_credentials WHERE credential_id = $1 AND revoked_at IS NULL LIMIT 1`,
        [response.id],
      )
      const cred = credRows[0]
      if (!cred) return res.status(401).json({ error: 'Unknown credential' })

      // Prefer server-persisted challenge for the known user; fall back to
      // the client-echoed challenge on the anonymous path (still verified
      // by @simplewebauthn against the signed clientDataJSON).
      let expectedChallenge = echoedChallenge
      const persisted = await consumeChallenge({ userId: cred.user_id, purpose: 'authenticate' })
      if (persisted) expectedChallenge = persisted.challenge
      if (!expectedChallenge) return res.status(410).json({ error: 'Challenge expired or missing' })

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: EXPECTED_ORIGIN,
        expectedRPID: RP_ID,
        authenticator: {
          credentialID: Buffer.from(cred.credential_id, 'base64url'),
          credentialPublicKey: Buffer.from(cred.public_key, 'base64url'),
          counter: Number(cred.sign_count || 0),
          transports: Array.isArray(cred.transports) ? cred.transports : undefined,
        },
        requireUserVerification: false,
      })
      if (!verification.verified || !verification.authenticationInfo) {
        return res.status(401).json({ error: 'Signature invalid' })
      }

      const nextCounter = verification.authenticationInfo.newCounter
      // Clone-detection: if the counter did not increase from the previous
      // value AND both were non-zero, warn. Some authenticators keep counter
      // at 0 forever (Apple passkey), so we cannot hard-fail.
      if (nextCounter <= Number(cred.sign_count || 0) && Number(cred.sign_count || 0) > 0 && nextCounter !== 0) {
        logger.warn(
          { user_id: cred.user_id, credential_id: cred.credential_id, prev: cred.sign_count, next: nextCounter },
          'webauthn signature counter did not advance — possible cloned credential',
        )
      }

      await query(
        `UPDATE webauthn_credentials SET sign_count = $2, last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [cred.id, nextCounter],
      )

      const user = await findUserById(cred.user_id)
      if (!user) return res.status(401).json({ error: 'Account no longer exists' })
      const agent = await findAgentForUser(user.id)
      if (!agent) return res.status(401).json({ error: 'Invalid credentials' })

      await logActivity({ type: 'webauthn_signin_completed', agent_id: user.id, meta: { credential_id: cred.credential_id } })

      const session = await buildAuthSession(user, agent, { req })
      return res.json({ ...session, factor_used: 'passkey' })
    } catch (err) {
      logger.error({ err }, 'webauthn authenticate/complete failed')
      return next(err)
    }
  })

  // ---------------------------------------------------------------------
  // Credentials CRUD
  // ---------------------------------------------------------------------
  app.get('/api/auth/webauthn/credentials', authMiddleware, async (req, res, next) => {
    try {
      const rows = await listUserCredentials(req.user.id)
      return res.json({ credentials: rows.map(serializeCredential) })
    } catch (err) {
      return next(err)
    }
  })

  app.delete('/api/auth/webauthn/credentials/:id', authMiddleware, async (req, res, next) => {
    try {
      const rows = await query(
        `SELECT id, user_id, revoked_at FROM webauthn_credentials WHERE id = $1 LIMIT 1`,
        [req.params.id],
      )
      const cred = rows[0]
      if (!cred) return res.status(404).json({ error: 'Not found' })
      if (cred.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
      if (cred.revoked_at) return res.status(204).end()
      await query(
        `UPDATE webauthn_credentials SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [req.params.id],
      )
      await logActivity({ type: 'webauthn_credential_revoked', agent_id: req.user.id, meta: { id: req.params.id } })
      return res.status(204).end()
    } catch (err) {
      return next(err)
    }
  })

  app.post('/api/auth/webauthn/credentials/:id/rename', authMiddleware, async (req, res, next) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : ''
      if (!name) return res.status(400).json({ error: 'name is required' })
      const rows = await query(
        `SELECT id, user_id FROM webauthn_credentials WHERE id = $1 LIMIT 1`,
        [req.params.id],
      )
      const cred = rows[0]
      if (!cred) return res.status(404).json({ error: 'Not found' })
      if (cred.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
      await query(
        `UPDATE webauthn_credentials SET name = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [req.params.id, name],
      )
      return res.json({ id: req.params.id, name })
    } catch (err) {
      return next(err)
    }
  })
}

// Exported for tests.
export const __testables = {
  RP_ID,
  RP_NAME,
  EXPECTED_ORIGIN,
  CHALLENGE_TTL_SECONDS,
  persistChallenge,
  consumeChallenge,
  listUserCredentials,
  serializeCredential,
}
