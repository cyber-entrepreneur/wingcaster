/**
 * Free-tier onboarding. Consumes lifecycle.startSubscription — does not
 * modify lifecycle internals.
 *
 * Deviation: spec asked PENDING_START with billing_cycle_start = now.
 * startSubscription activates immediately when start <= now, which is the
 * public API. New tenants therefore land ACTIVE and can use the product
 * before the billing-cycle worker tick. Worker still grants on next_grant_at.
 */
import { CREDIT_ERROR, CreditEngineError } from '../credits/errors.js'
import { lookupFinTenantId, syntheticTenantId, ensureWallet } from '../credits/wallets.js'
import { startSubscription } from './lifecycle.js'
import { getFreeTierPackage } from './registry.js'

const OPEN_STATUSES = ['PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END']

export async function provisionFreeTier(client, {
  scope,
  scopeId,
  actorId = null,
  now = new Date().toISOString(),
} = {}) {
  if (!scope || !scopeId) {
    throw new CreditEngineError(CREDIT_ERROR.INVALID_AMOUNT, 'scope and scopeId are required for free-tier provisioning')
  }
  const free = await getFreeTierPackage(client)
  if (!free?.version_id) {
    throw new CreditEngineError(
      CREDIT_ERROR.FREE_TIER_PACKAGE_MISSING,
      'Free-tier package seed missing — restore from migration 304',
    )
  }
  const finTenantId = await lookupFinTenantId(client, scope, String(scopeId))
  const tenantId = finTenantId || syntheticTenantId(scope, String(scopeId))
  await ensureWallet(client, {
    tenantId,
    currency: 'USD',
    scope,
    scopeId: String(scopeId),
    finTenantId,
  })
  const existing = await client.query(
    `SELECT * FROM public.tenant_subscriptions
      WHERE tenant_id = $1 AND status = ANY($2::text[])
      LIMIT 1`,
    [tenantId, OPEN_STATUSES],
  )
  if (existing.rows[0]) {
    return { tenantId, subscription: existing.rows[0], reused: true }
  }
  const subscription = await startSubscription(client, {
    tenantId,
    packageVersionId: free.version_id,
    propertiesCommitted: 0,
    billingCycleStart: now,
    actorId,
    now,
  })
  return { tenantId, subscription, reused: false }
}
