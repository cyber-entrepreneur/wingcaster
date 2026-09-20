/**
 * Wave 2C — finance read/attest boundary for deal GTV + commission.
 *
 * Canonical open Q#3: marketing does NOT recompute commission rates.
 * Source of truth is the property-deal ledger `closed_transactions`
 * (expanded with gtv_micros / commission_micros). SaaS `fin.*` billing
 * is unrelated and must not be read here.
 *
 * Attestation = emit/ensure `transaction.closed` / `commission.earned`
 * Events whose value_micros copy the ledger figures. Conversion
 * materialisation then copies those Event values unchanged.
 */

import { findAll, findOne, query } from '../../persistence/index.js'
import { ingestEvent } from '../../lib/growth-os/index.js'

function requireTenantScope({ agencyId, agentId }) {
  if ((agencyId == null || agencyId === '') && (agentId == null || agentId === '')) {
    throw Object.assign(new Error('agencyId or agentId required for finance ledger read'), {
      code: 'TENANT_SCOPE_REQUIRED',
    })
  }
}

/**
 * Convert major currency units (NUMERIC final_sold_price) → micros.
 */
export function majorToMicros(major) {
  if (major == null || major === '') return null
  const n = Number(major)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 1_000_000)
}

/**
 * Read attested deal economics from closed_transactions (SQL-scoped by tenant).
 */
export async function readDealEconomics({
  closedTransactionId,
  agencyId = null,
  agentId = null,
} = {}) {
  requireTenantScope({ agencyId, agentId })
  if (!closedTransactionId) {
    throw Object.assign(new Error('closedTransactionId is required'), {
      code: 'MISSING_CLOSED_TRANSACTION_ID',
    })
  }

  const rows = await query(
    `SELECT id, agency_id, agent_id, contact_id, listing_id,
            final_sold_price, currency, gtv_micros, commission_micros, closed_at
       FROM public.closed_transactions
      WHERE id = $1
        AND (
          ($2::text IS NOT NULL AND agency_id = $2)
          OR ($3::text IS NOT NULL AND agent_id = $3)
        )
      LIMIT 1`,
    [closedTransactionId, agencyId || null, agentId || null],
  )
  const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0]
  if (!row) return null

  const gtvMicros =
    row.gtv_micros != null ? Number(row.gtv_micros) : majorToMicros(row.final_sold_price)
  const commissionMicros =
    row.commission_micros != null ? Number(row.commission_micros) : null

  return {
    id: row.id,
    agency_id: row.agency_id,
    agent_id: row.agent_id,
    contact_id: row.contact_id,
    listing_id: row.listing_id,
    currency: row.currency || 'USD',
    gtv_micros: gtvMicros,
    commission_micros: commissionMicros,
    closed_at: row.closed_at,
    source: 'closed_transactions',
  }
}

/**
 * List deal economics for a tenant (SQL-scoped; never unbounded).
 */
export async function listDealEconomics({
  agencyId = null,
  agentId = null,
  contactId = null,
  listingId = null,
  limit = 200,
} = {}) {
  requireTenantScope({ agencyId, agentId })
  const caps = Math.min(Math.max(Number(limit) || 200, 1), 1000)
  const rows = await query(
    `SELECT id, agency_id, agent_id, contact_id, listing_id,
            final_sold_price, currency, gtv_micros, commission_micros, closed_at
       FROM public.closed_transactions
      WHERE (
          ($1::text IS NOT NULL AND agency_id = $1)
          OR ($2::text IS NOT NULL AND agent_id = $2)
        )
        AND ($3::text IS NULL OR contact_id = $3)
        AND ($4::text IS NULL OR listing_id = $4)
      ORDER BY closed_at DESC NULLS LAST
      LIMIT $5`,
    [agencyId || null, agentId || null, contactId || null, listingId || null, caps],
  )
  const list = Array.isArray(rows) ? rows : rows?.rows || []
  return list.map((row) => ({
    id: row.id,
    agency_id: row.agency_id,
    agent_id: row.agent_id,
    contact_id: row.contact_id,
    listing_id: row.listing_id,
    currency: row.currency || 'USD',
    gtv_micros:
      row.gtv_micros != null ? Number(row.gtv_micros) : majorToMicros(row.final_sold_price),
    commission_micros:
      row.commission_micros != null ? Number(row.commission_micros) : null,
    closed_at: row.closed_at,
    source: 'closed_transactions',
  }))
}

/**
 * Attest transaction.closed from ledger figures (idempotent via event key).
 */
export async function attestTransactionClosed({
  closedTransactionId,
  agencyId = null,
  agentId = null,
  contactId = null,
  executionId = null,
  campaignId = null,
  correlationId = null,
  occurredAt = null,
} = {}) {
  const deal = await readDealEconomics({ closedTransactionId, agencyId, agentId })
  if (!deal) {
    throw Object.assign(new Error(`closed_transaction not found: ${closedTransactionId}`), {
      code: 'CLOSED_TRANSACTION_NOT_FOUND',
    })
  }
  if (deal.gtv_micros == null) {
    throw Object.assign(new Error('closed_transaction missing GTV'), {
      code: 'MISSING_GTV',
    })
  }

  return ingestEvent({
    eventName: 'transaction.closed',
    source: 'finance:closed_transactions',
    agencyId: agencyId ?? deal.agency_id,
    agentId: agentId ?? deal.agent_id,
    contactId: contactId ?? deal.contact_id,
    executionId,
    campaignId,
    correlationId: correlationId || `deal:${deal.id}`,
    valueMicros: deal.gtv_micros,
    currency: deal.currency,
    occurredAt: occurredAt || deal.closed_at || new Date().toISOString(),
    objectType: 'lead',
    objectId: deal.listing_id || deal.id,
    actorType: 'system',
    actorId: 'finance',
    idempotencyKey: `finance:closed_transactions:${deal.id}:transaction.closed`,
    context: {
      closed_transaction_id: deal.id,
      listing_id: deal.listing_id,
      finance_source: 'closed_transactions',
    },
  })
}

/**
 * Attest commission.earned from ledger figures (idempotent).
 */
export async function attestCommissionEarned({
  closedTransactionId,
  agencyId = null,
  agentId = null,
  contactId = null,
  executionId = null,
  campaignId = null,
  correlationId = null,
  occurredAt = null,
} = {}) {
  const deal = await readDealEconomics({ closedTransactionId, agencyId, agentId })
  if (!deal) {
    throw Object.assign(new Error(`closed_transaction not found: ${closedTransactionId}`), {
      code: 'CLOSED_TRANSACTION_NOT_FOUND',
    })
  }
  if (deal.commission_micros == null) {
    throw Object.assign(new Error('closed_transaction missing commission_micros'), {
      code: 'MISSING_COMMISSION',
    })
  }

  return ingestEvent({
    eventName: 'commission.earned',
    source: 'finance:closed_transactions',
    agencyId: agencyId ?? deal.agency_id,
    agentId: agentId ?? deal.agent_id,
    contactId: contactId ?? deal.contact_id,
    executionId,
    campaignId,
    correlationId: correlationId || `deal:${deal.id}`,
    valueMicros: deal.commission_micros,
    currency: deal.currency,
    occurredAt: occurredAt || deal.closed_at || new Date().toISOString(),
    objectType: 'lead',
    objectId: deal.listing_id || deal.id,
    actorType: 'system',
    actorId: 'finance',
    idempotencyKey: `finance:closed_transactions:${deal.id}:commission.earned`,
    context: {
      closed_transaction_id: deal.id,
      listing_id: deal.listing_id,
      finance_source: 'closed_transactions',
    },
  })
}

/**
 * Lookup a conversion's attested value against ledger when the source event
 * carries a closed_transaction_id in context. Returns null when not applicable.
 */
export async function resolveAttestedValueFromEvent(event, { agencyId, agentId } = {}) {
  const closedId =
    event?.context?.closed_transaction_id ||
    event?.data?.closed_transaction_id ||
    null
  if (!closedId) return null
  const deal = await readDealEconomics({
    closedTransactionId: closedId,
    agencyId: agencyId ?? event.agency_id,
    agentId: agentId ?? event.agent_id,
  })
  if (!deal) return null
  if (event.event_name === 'transaction.closed') {
    return { value_micros: deal.gtv_micros, currency: deal.currency, deal }
  }
  if (event.event_name === 'commission.earned') {
    return { value_micros: deal.commission_micros, currency: deal.currency, deal }
  }
  return null
}

/** Test helper — unused in production paths. */
export async function findClosedTransactionRaw(id) {
  return findOne('closed_transactions', (row) => row.id === id)
}

export async function listClosedTransactionsRaw(filter) {
  return findAll('closed_transactions', filter)
}
