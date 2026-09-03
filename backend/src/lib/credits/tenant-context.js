/**
 * Derive the credit-engine tenant UUID from the authenticated principal.
 * JWT has no tenantId — never trust a client-supplied query param.
 */
import { syntheticTenantId } from './wallets.js'

export function creditTenantIdForScope(scope, scopeId) {
  const normalized = scope === 'agency' ? 'agency' : 'personal'
  return syntheticTenantId(normalized, String(scopeId))
}

export function resolveRequestCreditTenant(req) {
  const agencyId = req.agent?.agency_id || null
  if (agencyId) {
    return {
      creditTenantId: creditTenantIdForScope('agency', agencyId),
      scope: 'agency',
      scopeId: String(agencyId),
      publicTenantId: `agency:${agencyId}`,
    }
  }
  const userId = req.user?.id
  if (!userId) return null
  return {
    creditTenantId: creditTenantIdForScope('personal', userId),
    scope: 'personal',
    scopeId: String(userId),
    publicTenantId: `personal:${userId}`,
  }
}

export function creditContextFromRequest(req, extras = {}) {
  const resolved = resolveRequestCreditTenant(req)
  if (!resolved) return extras
  return {
    tenantId: resolved.creditTenantId,
    ...extras,
  }
}
