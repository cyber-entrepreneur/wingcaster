/**
 * T4 — Fine-grained per-resource token scope enforcement (H2 v2).
 *
 * H2 shipped action-scope enforcement (`listings:write`). T4 layers the
 * resource-scope check on top: a PAT can carry a list of
 * `{resource_type, resource_id}` records and only requests targeting
 * one of those specific resources pass.
 *
 * The middleware factory takes a `resolveResource(req)` function so each
 * route can extract its resource identifier from wherever it lives
 * (URL param, body field, query string). Missing resolver → the route
 * is treated as unconstrained by resource-scope, only action-scope
 * applies (backward compatible with H2).
 *
 * ---------------------------------------------------------------------------
 * Semantics
 * ---------------------------------------------------------------------------
 *
 * JWT session — always passes (resource scopes are a PAT concept).
 * PAT with `resource_scopes = []` — passes (unrestricted, matches H2 default).
 * PAT with entries — request MUST resolve to a resource whose type+id
 *   appears in the token's scope list. Otherwise 403 with a payload
 *   telling the caller which resource_id would have been accepted.
 */

import { query } from '../../db.js'
import logger from '../logger.js'

/**
 * Attach the token's resource_scopes to the request. Called from
 * `authMiddleware` alongside `attachApiTokenScopes` — one DB read covers
 * both (they read the same row) so a small refactor could combine them;
 * kept separate here for readability.
 */
export async function attachApiTokenResourceScopes(req, apiTokenId) {
  if (!apiTokenId) return
  try {
    const rows = await query(
      `SELECT resource_scopes FROM api_tokens WHERE id = $1 LIMIT 1`,
      [apiTokenId],
    )
    const raw = rows[0]?.resource_scopes
    req.api_token_resource_scopes = Array.isArray(raw) ? raw : []
  } catch (err) {
    logger.error({ err, apiTokenId }, 'attachApiTokenResourceScopes read failed')
    req.api_token_resource_scopes = []
  }
}

/**
 * Middleware factory.
 *
 * @param {object} spec
 * @param {string} spec.resourceType — e.g. `'agency'`, `'listing'`, `'contact'`
 * @param {(req) => string | null} spec.resolve — extract the target resource id from req
 */
export function requireApiTokenResource({ resourceType, resolve }) {
  if (!resourceType || typeof resolve !== 'function') {
    throw new Error('requireApiTokenResource: resourceType + resolve are required')
  }
  return function apiTokenResourceMiddleware(req, res, next) {
    if (!req.user?.api_token_id) return next() // JWT session — always pass
    const scopes = Array.isArray(req.api_token_resource_scopes)
      ? req.api_token_resource_scopes
      : []
    if (scopes.length === 0) return next() // unrestricted PAT

    const targetId = resolve(req)
    if (!targetId) {
      // Route asked us to check but couldn't identify a resource — this is
      // a route-authoring bug, not an auth failure. Refuse safely.
      return res.status(400).json({
        error: 'api_token_resource_not_resolved',
        resource_type: resourceType,
        message: `Route required per-resource scope enforcement but could not extract a ${resourceType} id from the request.`,
      })
    }

    const matches = scopes.some(
      (s) => s?.resource_type === resourceType && s?.resource_id === targetId,
    )
    if (matches) return next()

    return res.status(403).json({
      error: 'api_token_resource_scope_missing',
      resource_type: resourceType,
      resource_id: targetId,
      declared_resource_scopes: scopes,
      message: `This API token is not permitted to act on ${resourceType} ${targetId}. Mint a new token that includes this resource in its resource_scopes.`,
    })
  }
}

// Exported for tests.
export const __testables = {}
