import { randomUUID } from 'node:crypto'
import { PACKAGE_ERROR, PackageError } from './errors.js'

export async function countActive(client, tenantId) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n
       FROM public.tenant_active_properties
      WHERE tenant_id = $1 AND deactivated_at IS NULL`,
    [tenantId],
  )
  return rows[0].n
}

async function loadCap(client, tenantId) {
  const { rows } = await client.query(
    `SELECT * FROM public.tenant_subscriptions
      WHERE tenant_id = $1
        AND status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END')
      FOR UPDATE`,
    [tenantId],
  )
  if (!rows[0]) {
    throw new PackageError(
      PACKAGE_ERROR.NO_ACTIVE_SUBSCRIPTION,
      'No active subscription for tenant',
      { tenantId },
    )
  }
  return rows[0]
}

export async function activateProperty(client, { tenantId, propertyId, now = new Date().toISOString() }) {
  const open = await client.query(
    `SELECT * FROM public.tenant_active_properties
      WHERE tenant_id = $1 AND property_id = $2 AND deactivated_at IS NULL`,
    [tenantId, propertyId],
  )
  if (open.rows[0]) return open.rows[0]

  const subscription = await loadCap(client, tenantId)
  const current = await countActive(client, tenantId)
  if (current >= Number(subscription.properties_committed)) {
    throw new PackageError(
      PACKAGE_ERROR.PROPERTY_LIMIT_EXCEEDED,
      'PROPERTY_LIMIT_EXCEEDED',
      {
        tenantId,
        propertyId,
        current,
        cap: Number(subscription.properties_committed),
      },
    )
  }

  const { rows } = await client.query(
    `INSERT INTO public.tenant_active_properties (
       id, tenant_id, property_id, activated_at, data
     ) VALUES ($1,$2,$3,$4::timestamptz,'{}'::jsonb)
     RETURNING *`,
    [randomUUID(), tenantId, propertyId, now],
  )
  return rows[0]
}

export async function deactivateProperty(client, { tenantId, propertyId, now = new Date().toISOString() }) {
  const { rows } = await client.query(
    `UPDATE public.tenant_active_properties
        SET deactivated_at = $3::timestamptz
      WHERE tenant_id = $1 AND property_id = $2 AND deactivated_at IS NULL
      RETURNING *`,
    [tenantId, propertyId, now],
  )
  return rows[0] || null
}
