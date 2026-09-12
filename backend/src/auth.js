import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { findAgentForUser, findUserById } from './identity.js'
import {
  clientIp,
  createUserSession,
  findActiveSession,
  isSessionActive,
  scheduleTouchLastActive,
  sessionIdFromToken,
} from './lib/auth/user-sessions.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../../.env') })

function getJwtSecret() {
  const configuredSecret = process.env.JWT_SECRET
  if (configuredSecret) return configuredSecret

  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production')
    process.exit(1)
  }

  const fallbackSecret = 'dev-jwt-secret-change-me'
  console.warn('JWT_SECRET not set; using a development fallback secret')
  return fallbackSecret
}

const JWT_SECRET = getJwtSecret()

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

/**
 * Mint a session JWT and persist a `user_sessions` row.
 *
 * `reuseSessionId` is for re-issues that must not spawn a second device row
 * (tenant switch, env switch, 2FA disable / password change that keep THIS
 * browser signed in). A missing or already-revoked id falls through to a
 * fresh insert.
 */
export async function issueAuthToken(user, extraClaims = {}, { req = null, reuseSessionId = null } = {}) {
  let sessionId = reuseSessionId || null
  if (sessionId) {
    const existing = await findActiveSession(sessionId, user.id)
    if (!existing) sessionId = null
  }
  if (!sessionId) {
    const row = await createUserSession({
      userId: user.id,
      userAgent: req?.get?.('user-agent') || req?.headers?.['user-agent'] || null,
      ip: clientIp(req),
    })
    sessionId = row.id
  }
  const { verified_at: verifiedOverride, ...rest } = extraClaims
  return signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    token_version: Number(user.token_version ?? 0),
    verified_at: verifiedOverride ?? isoTimestamp(user.verified_at),
    ...rest,
    session_id: sessionId,
    jti: sessionId,
  })
}

/** Default lifetime of an elevation token, in seconds. */
export const ELEVATION_TTL_SECONDS = 15 * 60

/** Header carrying the elevation token, alongside the normal Bearer session. */
export const ELEVATION_HEADER = 'x-elevated-token'

/**
 * Mint a step-up (elevation) token.
 *
 * This is deliberately a SECOND token rather than a re-issued session JWT. The
 * client keeps its normal 7-day Bearer token untouched and sends this one in
 * an additional header only for sensitive calls. Re-issuing the session
 * instead would mean every step-up rotates the user's login credential, which
 * strands any other open browser tab on a stale token — and a 15-minute
 * session JWT (the literal reading of the original design note) would log the
 * user out a quarter of an hour after every sensitive action.
 *
 * The token is bound to the user id AND their current `token_version`, so
 * anything that bumps the version (password change, 2FA disable) invalidates
 * outstanding elevations along with outstanding sessions.
 */
export function signElevatedToken({ userId, tokenVersion, ttlSeconds = ELEVATION_TTL_SECONDS }) {
  return jwt.sign(
    { id: userId, token_version: Number(tokenVersion ?? 0), elevated: true },
    JWT_SECRET,
    { expiresIn: ttlSeconds },
  )
}

/**
 * Gate a route on a recent step-up. Mount AFTER `authMiddleware` — it reads
 * `req.user` to bind the elevation to the authenticated session.
 *
 * Always responds 401 with `code: 'step_up_required'` when elevation is
 * missing, stale, or mismatched. The frontend keys the step-up modal off that
 * code and retries the original request once elevation is obtained (7f/3), so
 * the code must stay stable across all failure modes here.
 *
 * @param {{maxAgeSeconds?: number}} [options]
 */
export function requireElevated({ maxAgeSeconds = ELEVATION_TTL_SECONDS } = {}) {
  return function requireElevatedMiddleware(req, res, next) {
    const stepUpRequired = (message) => res.status(401).json({
      error: message,
      code: 'step_up_required',
      max_age_seconds: maxAgeSeconds,
    })

    if (!req.user?.id) return stepUpRequired('Authentication required')

    const header = req.headers[ELEVATION_HEADER]
    if (!header) return stepUpRequired('This action requires re-authentication')

    const raw = String(header).startsWith('Bearer ') ? String(header).slice(7) : String(header)
    const decoded = verifyToken(raw)
    if (!decoded || decoded.elevated !== true) {
      return stepUpRequired('This action requires re-authentication')
    }

    // An elevation minted for one account must never authorise another, even
    // though both tokens are signed with the same secret.
    if (decoded.id !== req.user.id) {
      return stepUpRequired('This action requires re-authentication')
    }

    const elevationVersion = Number(decoded.token_version ?? 0)
    const sessionVersion = Number(req.user.token_version ?? 0)
    if (elevationVersion !== sessionVersion) {
      return stepUpRequired('This action requires re-authentication')
    }

    // `expiresIn` already caps the token at ELEVATION_TTL_SECONDS; this second
    // check lets an individual route demand something tighter than the default
    // without minting a differently-scoped token.
    const issuedAt = Number(decoded.iat ?? 0) * 1000
    if (!issuedAt || Date.now() - issuedAt > maxAgeSeconds * 1000) {
      return stepUpRequired('Re-authentication has expired')
    }

    req.elevation = { issued_at: new Date(issuedAt).toISOString(), age_seconds: Math.floor((Date.now() - issuedAt) / 1000) }
    next()
  }
}

/**
 * Normalise a timestamp for comparison against a JWT claim.
 *
 * `node-postgres` hydrates `timestamptz` columns into JS Date objects, while
 * the claim inside the token is always an ISO string — JSON has no date type.
 * Comparing the two directly with `!==` is therefore ALWAYS true, which
 * rejected every authenticated request with "Session verification required".
 * It went unnoticed because there are no live tenants and the gated tests that
 * would have caught it had never run in CI.
 */
function isoTimestamp(value) {
  if (value instanceof Date) return value.toISOString()
  return value
}

async function attachAuthenticatedUser(req, decoded) {
  if (!decoded.verified_at) {
    return { status: 401, error: 'Session verification required' }
  }

  let user
  let agent
  try {
    user = await findUserById(decoded.id)
    agent = user ? await findAgentForUser(user.id) : null
  } catch (err) {
    return { error: err }
  }
  if (!user || !agent) {
    return { status: 401, error: 'Account no longer exists' }
  }
  if (!user.verified || !user.verified_at || decoded.verified_at !== isoTimestamp(user.verified_at)) {
    return { status: 401, error: 'Session verification required' }
  }

  const tokenVersion = Number(decoded.token_version ?? 0)
  const userTokenVersion = Number(user.token_version ?? 0)
  if (tokenVersion !== userTokenVersion) {
    return { status: 401, error: 'Session expired. Please sign in again.' }
  }

  // Legacy JWTs (issued before user_sessions) have no session_id/jti and
  // remain valid until they expire or token_version bumps. New tokens always
  // carry session_id; a revoked row kills that JWT without touching others.
  const sessionId = sessionIdFromToken(decoded)
  if (sessionId) {
    let active
    try {
      active = await isSessionActive(sessionId, user.id)
    } catch (err) {
      return { error: err }
    }
    if (!active) {
      return { status: 401, error: 'Session expired. Please sign in again.', code: 'SESSION_REVOKED' }
    }
    scheduleTouchLastActive(sessionId)
  }

  const sessionEnv = (() => {
    const claim = decoded.env || decoded.fin_environment || user.env || user.fin_environment
    if (claim === 'TEST' || claim === 'test') return 'test'
    return 'live'
  })()

  req.user = {
    ...decoded,
    id: user.id,
    agent_id: agent.id,
    email: user.email,
    name: user.name,
    role: user.role || 'agent',
    platform_role: user.platform_role || null,
    active_tenant_id: decoded.active_tenant_id || user.active_tenant_id || null,
    preferred_locale: user.preferred_locale || 'en',
    session_id: sessionId,
    token_version: userTokenVersion,
    // PA-NAV-001 / fin admin session env (LIVE|TEST). Session claim wins;
    // account-recovery env scoping reads fin_environment / environment.
    env: sessionEnv,
    fin_environment: sessionEnv === 'test' ? 'TEST' : 'LIVE',
    environment: sessionEnv === 'test' ? 'TEST' : 'LIVE',
  }
  req.sessionEnv = sessionEnv
  req.agent = agent
  return null
}

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.slice(7)
  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const failure = await attachAuthenticatedUser(req, decoded)
  if (failure?.error && !failure.status) return next(failure.error)
  if (failure) {
    return res.status(failure.status).json({
      error: failure.error,
      ...(failure.code ? { code: failure.code } : {}),
    })
  }
  next()
}

/**
 * Auth when a Bearer token is present; otherwise continue unauthenticated.
 * Used by AGN-MEM-005 guest signup-on-apply (guest_signup body when anonymous).
 */
export async function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next()
  }
  const token = authHeader.slice(7)
  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const failure = await attachAuthenticatedUser(req, decoded)
  if (failure?.error && !failure.status) return next(failure.error)
  if (failure) return res.status(failure.status).json({ error: 'Invalid token' })
  next()
}
