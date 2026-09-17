/**
 * Per-token scope enforcement (H2 — closes #195 follow-up).
 *
 * The bearer middleware in `auth.js` accepts a `wc_pat_...` PAT and populates
 * `req.user`. `req.user.api_token_id` marks the request as PAT-authenticated
 * (a JWT session leaves this undefined). This module reads the token row,
 * exposes the scopes on `req.api_token_scopes`, and provides a
 * `requireScope(scope)` middleware factory that route handlers can chain
 * after `authMiddleware` to refuse PAT calls that don't declare the scope.
 *
 * ---------------------------------------------------------------------------
 * Enforcement semantics
 * ---------------------------------------------------------------------------
 *
 * PAT with `scopes = []` — legacy / power-user token; passes any scope check
 * (matches GitHub classic PAT / Stripe unrestricted key). New tokens should
 * always declare scopes; the frontend already prompts for them.
 *
 * PAT with `scopes = ['listings:read']` — passes ONLY when the route's
 * required scope is exactly `listings:read` OR a broader match that satisfies
 * the write hierarchy (see `scopeSatisfies` below).
 *
 * JWT session (no `api_token_id`) — always passes. Sessions carry the user's
 * full permission set from the DB; scopes are purely a PAT concept.
 *
 * ---------------------------------------------------------------------------
 * Scope hierarchy
 * ---------------------------------------------------------------------------
 *
 *   *:write ⊃ *:read
 *
 * A token with `listings:write` can hit a `listings:read` route without a
 * separate `listings:read` scope entry. The reverse never holds.
 */

import { query } from '../../db.js'
import logger from '../logger.js'

/**
 * Attach the current PAT's scopes to the request once, so `requireScope`
 * chains do not re-query the DB per-scope. Called from `authMiddleware` after
 * `authenticateWithApiToken` succeeds — MUST be called explicitly by that
 * path so JWT sessions bypass the read (they always pass scope checks).
 *
 * `req.api_token_scopes` = string[] on success; the middleware then answers
 * "yes" for any scope in the list plus its `:read` sub-scope when the token
 * carries `:write`.
 */
export async function attachApiTokenScopes(req, apiTokenId) {
  if (!apiTokenId) return
  try {
    const rows = await query(`SELECT scopes FROM api_tokens WHERE id = $1 LIMIT 1`, [apiTokenId])
    const raw = rows[0]?.scopes
    req.api_token_scopes = Array.isArray(raw) ? raw : []
  } catch (err) {
    // A DB stumble here MUST NOT fail the authenticated request — the token
    // was already validated by the bearer middleware. Fall through with an
    // empty scope list, which `requireScope` then treats as "no explicit
    // scope; block explicit-scope routes." That's the safe default.
    logger.error({ err, apiTokenId }, 'attachApiTokenScopes read failed')
    req.api_token_scopes = []
  }
}

/**
 * Does `held` (a scope the token declares) satisfy `required` (a scope the
 * route demands)? Applies the `:write` ⊃ `:read` hierarchy plus exact match.
 */
export function scopeSatisfies(held, required) {
  if (held === required) return true
  const heldMatch = /^(.+):write$/.exec(held)
  const requiredMatch = /^(.+):read$/.exec(required)
  if (heldMatch && requiredMatch && heldMatch[1] === requiredMatch[1]) return true
  return false
}

/**
 * Route middleware factory.
 *
 * @param {string} requiredScope — e.g. `'listings:write'`. If the route is a
 *   safe read, pass the `:read` scope; the hierarchy allows any `:write`
 *   token through.
 * @returns Express middleware that:
 *   - passes if `req.user` is a JWT session (no `api_token_id`)
 *   - passes if the PAT declares no scopes (unrestricted token)
 *   - passes if any declared scope satisfies `requiredScope`
 *   - otherwise responds 403 `api_token_scope_missing` with the required
 *     scope in the payload so clients can log the exact scope to add
 */
export function requireApiTokenScope(requiredScope) {
  if (!requiredScope) {
    throw new Error('requireApiTokenScope: requiredScope is required')
  }
  return function apiTokenScopeMiddleware(req, res, next) {
    // JWT session — scopes are a PAT concept only.
    if (!req.user?.api_token_id) return next()
    const held = Array.isArray(req.api_token_scopes) ? req.api_token_scopes : []
    // Unrestricted / legacy token — full pass. Matches GitHub classic PAT.
    if (held.length === 0) return next()
    if (held.some((s) => scopeSatisfies(s, requiredScope))) return next()
    return res.status(403).json({
      error: 'api_token_scope_missing',
      required_scope: requiredScope,
      declared_scopes: held,
      message: `This API token is not permitted to call ${requiredScope}. Revoke the token and mint a new one with the required scope, or use a session credential instead.`,
    })
  }
}

// Exported for tests.
export const __testables = { scopeSatisfies }
