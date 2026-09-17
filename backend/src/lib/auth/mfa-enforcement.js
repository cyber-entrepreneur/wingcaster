/**
 * Runtime enforcement of the agency MFA policy (issue #190).
 *
 * The sign-in handler is where we DECIDE that a user is past grace, but a
 * decision made once at sign-in is not enough — a determined caller could
 * bypass the frontend and hit any endpoint with their session token. This
 * gate re-checks on every authenticated non-safe request and blocks it with
 * `403 MFA_ENROLLMENT_REQUIRED` when the user still owes enrollment.
 *
 * Chained inside `authMiddleware` (auth.js) after successful auth, so it runs
 * once per authenticated request and has access to `req.user`.
 *
 * Whitelist:
 *   - GET / HEAD / OPTIONS — never blocked (users need to READ their data
 *     to know why they can't act, and the frontend needs `/api/auth/me`).
 *   - Enrollment / step-up / logout paths — otherwise a blocked user cannot
 *     ever escape the block.
 */

import { evaluateMfaPolicyForSignIn } from '../agencies/mfa-policy-routes.js'
import { findUserById } from '../../identity.js'
import logger from '../logger.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Paths that MUST work while a user is past grace so they can enroll.
 * Anchored at start with `startsWith` — extend cautiously.
 */
const WHITELIST_PREFIXES = Object.freeze([
  '/api/auth/2fa/', // TOTP setup / verify / disable / backup-codes/regenerate
  '/api/auth/step-up', // step-up challenge (some enrollment paths need it)
  '/api/auth/logout',
  '/api/auth/me',
  '/api/settings/index', // settings shell lookup so the enrollment page can render
])

function isWhitelisted(pathname) {
  return WHITELIST_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Called from `authMiddleware` right before `next()`. `req.user.id` is
 * guaranteed populated by the caller — if it is not, we treat that as an
 * upstream bug and pass through (auth already failed / this is not our job).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function mfaEnforcementGate(req, res, next) {
  try {
    if (SAFE_METHODS.has(req.method)) return next()
    if (!req.user?.id) return next()
    if (isWhitelisted(req.path)) return next()

    // Reload the user from DB — a stale JWT could carry pre-enrollment
    // state after the user enrolled in a separate tab.
    const user = await findUserById(req.user.id)
    if (!user) return next()
    if (user.totp_enabled) return next()

    const decision = await evaluateMfaPolicyForSignIn(user)
    if (decision.block) {
      return res.status(403).json({
        error: 'MFA_ENROLLMENT_REQUIRED',
        message:
          'Your agency requires two-factor authentication and the grace period has expired. Enroll before continuing.',
        agency_id: decision.agency_id,
        grace_expired_at: decision.deadline_at,
      })
    }
    return next()
  } catch (err) {
    // A middleware failure here MUST NOT lock users out — log and continue.
    // A separate alarm / metric on this branch is preferable to a hard-fail.
    logger.error({ err }, 'mfa-enforcement evaluation failed')
    return next()
  }
}

// Exported for tests.
export const __testables = { SAFE_METHODS, WHITELIST_PREFIXES, isWhitelisted }
