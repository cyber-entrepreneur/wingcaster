/**
 * Stage 13e — usage-event reads from fin_public.usage_events (DL-222).
 * Projects the commercial.usage_events column set from the 261 view
 * (fin.usage_events + DL-175 dimensions). Revert this file to restore
 * the commercial.* findAll path.
 */
import { query } from '../db.js'

const LIST_SQL = `
  SELECT
    COALESCE(ue.source_event_id, ue.id::text) AS id,
    COALESCE(ue.dimensions->>'public_tenant_id', t.public_tenant_id::text) AS tenant_id,
    ue.dimensions->>'subscription_id' AS subscription_id,
    ue.event_type AS action_key,
    ue.quantity_units AS quantity,
    ue.dimensions->>'channel' AS channel,
    ue.dimensions->>'destination_country' AS destination_country,
    ue.dimensions->>'whatsapp_category' AS whatsapp_category,
    CASE WHEN ue.subject_type = 'LISTING' THEN ue.subject_id
         ELSE ue.dimensions->>'listing_id' END AS listing_id,
    CASE WHEN ue.subject_type = 'CONVERSATION' THEN ue.subject_id
         ELSE ue.dimensions->>'conversation_id' END AS conversation_id,
    ue.dimensions->>'distribution_id' AS distribution_id,
    COALESCE((ue.dimensions->>'casts_charged')::numeric, 0) AS casts_charged,
    COALESCE((ue.dimensions->>'price_minor')::numeric, 0) AS price_minor,
    COALESCE((ue.dimensions->>'cogs_estimate_minor')::numeric, 0) AS cogs_estimate_minor,
    ue.dimensions->>'rate_card_version' AS rate_card_version,
    (ue.dimensions->>'cast_value_minor')::numeric AS cast_value_minor,
    COALESCE(NULLIF(ue.residency_key, '__platform__'), ue.dimensions->>'territory_id') AS territory_id,
    ue.dimensions->>'zone_id' AS zone_id,
    COALESCE(ue.dimensions, '{}'::jsonb) AS metadata,
    COALESCE(
      ue.dimensions->>'quota_billing_period',
      to_char(ue.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM')
    ) AS billing_period,
    ue.occurred_at,
    ue.created_at
  FROM fin_public.usage_events ue
  LEFT JOIN fin.tenants t ON t.id = ue.tenant_id
`

function mapRow(row) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    subscription_id: row.subscription_id || null,
    action_key: row.action_key,
    quantity: Number(row.quantity) || 0,
    channel: row.channel || null,
    destination_country: row.destination_country || null,
    whatsapp_category: row.whatsapp_category || null,
    listing_id: row.listing_id || null,
    conversation_id: row.conversation_id || null,
    distribution_id: row.distribution_id || null,
    casts_charged: Number(row.casts_charged) || 0,
    price_minor: Number(row.price_minor) || 0,
    cogs_estimate_minor: Number(row.cogs_estimate_minor) || 0,
    rate_card_version: row.rate_card_version || null,
    cast_value_minor: row.cast_value_minor != null ? Number(row.cast_value_minor) : null,
    territory_id: row.territory_id || null,
    zone_id: row.zone_id || null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    billing_period: row.billing_period,
    occurred_at: row.occurred_at,
    created_at: row.created_at,
  }
}

export async function listUsageEvents({
  tenantId = null,
  billingPeriod = null,
  limit = 500,
} = {}) {
  const params = []
  const where = []
  if (tenantId) {
    params.push(tenantId)
    where.push(`COALESCE(ue.dimensions->>'public_tenant_id', t.public_tenant_id::text) = $${params.length}`)
  }
  if (billingPeriod) {
    params.push(billingPeriod)
    where.push(`COALESCE(ue.dimensions->>'quota_billing_period', to_char(ue.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM')) = $${params.length}`)
  }
  const cap = Math.min(5000, Math.max(1, Number(limit) || 500))
  params.push(cap)
  const sql = `${LIST_SQL}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ue.occurred_at DESC
    LIMIT $${params.length}`
  const rows = await query(sql, params)
  return rows.map(mapRow)
}
