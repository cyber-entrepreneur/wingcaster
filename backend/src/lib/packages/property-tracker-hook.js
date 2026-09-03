/**
 * Hook listing status into the property tracker without changing tracker internals.
 * Free-tier (properties_committed = 0) skips activation so listing CRUD stays
 * available; paid tenants hit PROPERTY_LIMIT_EXCEEDED when over cap.
 */
import { activateProperty, deactivateProperty } from './property-tracker.js'
import { PACKAGE_ERROR } from './errors.js'

const ACTIVE_STATUSES = new Set(['active', 'published', 'available'])

export async function syncListingPropertyTracker(client, {
  tenantId,
  propertyId,
  listingStatus,
  now = new Date().toISOString(),
} = {}) {
  if (!tenantId || !propertyId) return null
  if (!ACTIVE_STATUSES.has(String(listingStatus || '').toLowerCase())) {
    return deactivateProperty(client, { tenantId, propertyId, now })
  }
  const { rows } = await client.query(
    `SELECT properties_committed FROM public.tenant_subscriptions
      WHERE tenant_id = $1
        AND status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END')
      LIMIT 1`,
    [tenantId],
  )
  if (!rows[0] || Number(rows[0].properties_committed) <= 0) return null
  try {
    return await activateProperty(client, { tenantId, propertyId, now })
  } catch (error) {
    if (error?.code === PACKAGE_ERROR.NO_ACTIVE_SUBSCRIPTION) return null
    throw error
  }
}
