/**
 * Wave 2C — Conversion materialiser.
 * Business/engagement funnel Events → Conversion (idempotent on source_event_id).
 */

import { randomUUID } from 'node:crypto'
import { findAll, findOne, insert } from '../../persistence/index.js'
import { listEvents, withTenant } from '../../lib/growth-os/index.js'
import { CONVERSION_EVENT_MAP } from './constants.js'
import { resolveAttestedValueFromEvent } from './finance-attest.js'

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

function mapConversionRow(row) {
  if (!row) return null
  return {
    id: row.id,
    contact_id: row.contact_id,
    from_stage: row.from_stage,
    to_stage: row.to_stage,
    occurred_at: row.occurred_at,
    value_micros: row.value_micros != null ? Number(row.value_micros) : null,
    currency: row.currency,
    source_event_id: row.source_event_id,
    agency_id: row.agency_id,
    agent_id: row.agent_id,
    data: row.data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function isConversionEvent(eventName) {
  return Object.prototype.hasOwnProperty.call(CONVERSION_EVENT_MAP, eventName)
}

/**
 * Materialise one Conversion from an Event. Idempotent: same source_event_id
 * returns the existing row without mutation.
 */
export async function materialiseConversionFromEvent(event, {
  agencyId = null,
  agentId = null,
} = {}) {
  if (!event?.id || !event?.event_name) {
    throw Object.assign(new Error('event with id and event_name required'), {
      code: 'INVALID_EVENT',
    })
  }
  const mapping = CONVERSION_EVENT_MAP[event.event_name]
  if (!mapping) {
    return { conversion: null, inserted: false, skipped: true, reason: 'NOT_FUNNEL_EVENT' }
  }

  const tenantAgencyId = agencyId ?? event.agency_id ?? null
  const tenantAgentId = agentId ?? event.agent_id ?? null

  // Finance ledger read runs outside withTenant: closed_transactions is not
  // on growth_os_app_role; it is SQL-scoped by tenant inside the reader.
  let valueMicros = event.value_micros != null ? Number(event.value_micros) : null
  let currency = event.currency || null
  if (
    event.event_name === 'transaction.closed' ||
    event.event_name === 'commission.earned'
  ) {
    const attested = await resolveAttestedValueFromEvent(event, {
      agencyId: tenantAgencyId,
      agentId: tenantAgentId,
    })
    if (attested?.value_micros != null) {
      valueMicros = Number(attested.value_micros)
      currency = attested.currency || currency
    }
  }

  return withTenant(tenantAgencyId, tenantAgentId, async () => {
    const existing = await findOne(
      'conversions',
      (row) => row.source_event_id === event.id,
    )
    if (existing) {
      return { conversion: mapConversionRow(existing), inserted: false, skipped: false }
    }

    const row = await insert('conversions', {
      id: prefixedId('cnv_'),
      contact_id: event.contact_id || null,
      from_stage: mapping.from_stage,
      to_stage: mapping.to_stage,
      occurred_at: event.occurred_at || new Date().toISOString(),
      value_micros: valueMicros,
      currency,
      source_event_id: event.id,
      agency_id: tenantAgencyId,
      agent_id: tenantAgentId,
      data: {
        event_name: event.event_name,
        correlation_id: event.correlation_id || null,
        execution_id: event.execution_id || null,
        campaign_id: event.campaign_id || null,
      },
    })

    return { conversion: mapConversionRow(row), inserted: true, skipped: false }
  })
}

/**
 * Scan tenant business/engagement events and materialise missing Conversions.
 */
export async function materialiseConversionsForTenant({
  agencyId = null,
  agentId = null,
  contactId = null,
  correlationId = null,
} = {}) {
  if ((agencyId == null || agencyId === '') && (agentId == null || agentId === '')) {
    throw Object.assign(new Error('agencyId or agentId required'), {
      code: 'TENANT_SCOPE_REQUIRED',
    })
  }

  const events = await listEvents({
    agencyId,
    agentId,
    contactId,
    correlationId,
  })

  const results = []
  for (const event of events) {
    if (!isConversionEvent(event.event_name)) continue
    const result = await materialiseConversionFromEvent(event, { agencyId, agentId })
    results.push(result)
  }
  return results
}

export async function getConversion(id, { agencyId = null, agentId = null } = {}) {
  if (!id) return null
  return withTenant(agencyId, agentId, async () => {
    const row = await findOne('conversions', (r) => r.id === id)
    return mapConversionRow(row)
  })
}

export async function listConversions({
  agencyId = null,
  agentId = null,
  contactId = null,
  toStage = null,
  fromStage = null,
} = {}) {
  if ((agencyId == null || agencyId === '') && (agentId == null || agentId === '')) {
    throw Object.assign(new Error('agencyId or agentId required'), {
      code: 'TENANT_SCOPE_REQUIRED',
    })
  }
  return withTenant(agencyId, agentId, async () => {
    const rows = await findAll('conversions', (row) => {
      if (agencyId != null && row.agency_id !== agencyId) return false
      if (agentId != null && row.agent_id !== agentId) return false
      if (contactId != null && row.contact_id !== contactId) return false
      if (toStage != null && row.to_stage !== toStage) return false
      if (fromStage != null && row.from_stage !== fromStage) return false
      return true
    })
    return rows.map(mapConversionRow)
  })
}

export { mapConversionRow }
