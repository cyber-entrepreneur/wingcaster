/**
 * Entitlement service for the WhatsApp Listing module.
 *
 * Thin wrapper around the platform entitlements resolver, plus the
 * whatsapp-listings monthly draft quota check.
 */
import {
  WHATSAPP_LISTINGS_FEATURE,
  EntitlementScope,
  defaultEntitlementConfig,
} from '../domain/types.js'
import { Collections, findAllModule } from '../infrastructure/db.js'
import { createEntitlementService as createPlatformEntitlementService } from '../../../lib/credits/entitlements.js'

export function createEntitlementService({ adapter } = {}) {
  const inner = createPlatformEntitlementService({
    defaultFeature: WHATSAPP_LISTINGS_FEATURE,
    defaultConfig: defaultEntitlementConfig,
  })

  async function checkMonthlyQuota({ agentId }) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const drafts = await findAllModule(Collections.DRAFTS, (d) =>
      d.agent_id === agentId &&
      d.status !== 'discarded' &&
      d.created_at >= startOfMonth,
    )
    const count = drafts.length
    const entitlement = await inner.resolveEntitlement({ agentId })
    const max = entitlement?.config?.max_drafts_per_month ?? defaultEntitlementConfig().max_drafts_per_month
    return { allowed: count < max, used: count, max }
  }

  return {
    ...inner,
    checkMonthlyQuota,
    adapter,
    EntitlementScope,
  }
}

export { EntitlementScope, defaultEntitlementConfig, WHATSAPP_LISTINGS_FEATURE }
