/**
 * Growth-OS Wave 0 — events access layer.
 * ingestEvent implements docs/event-taxonomy-catalog.md §2–§4.
 */

import { createHash, randomUUID } from 'node:crypto'
import { findAll, findOne, query } from '../../persistence/index.js'

const EVENT_CATEGORIES = new Set(['business', 'delivery', 'engagement', 'system'])

/** Launch [L] / starred vocabulary from event-taxonomy-catalog.md §4. */
const EVENT_NAME_CATEGORIES = {
  'lead.created': 'business',
  'lead.qualified': 'business',
  'viewing.booked': 'business',
  'viewing.completed': 'business',
  'offer.made': 'business',
  'reservation.created': 'business',
  'transaction.closed': 'business',
  'commission.earned': 'business',
  'message.sent': 'delivery',
  'message.delivered': 'delivery',
  'message.failed': 'delivery',
  'post.published': 'delivery',
  'post.failed': 'delivery',
  'portal.submitted': 'delivery',
  'email.opened': 'engagement',
  'email.clicked': 'engagement',
  'message.read': 'engagement',
  'message.replied': 'engagement',
  'post.impression': 'engagement',
  'post.engaged': 'engagement',
  'link.clicked': 'engagement',
  'unsubscribe.requested': 'engagement',
  'execution.created': 'system',
  'consent.granted': 'system',
  'consent.withdrawn': 'system',
  'journey.entered': 'system',
  'journey.node.suppressed': 'system',
}

const EVENT_NAMES = new Set(Object.keys(EVENT_NAME_CATEGORIES))

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

function assertCategory(category) {
  if (!EVENT_CATEGORIES.has(category)) {
    throw Object.assign(new Error(`Invalid event.event_category: ${category}`), {
      code: 'INVALID_EVENT_CATEGORY',
    })
  }
}

function assertEventName(eventName) {
  if (!EVENT_NAMES.has(eventName)) {
    throw Object.assign(new Error(`Unknown event_name: ${eventName}`), {
      code: 'UNKNOWN_EVENT_NAME',
    })
  }
}

function resolveEventCategory(eventName, eventCategory) {
  assertEventName(eventName)
  const expected = EVENT_NAME_CATEGORIES[eventName]
  if (eventCategory == null) return expected
  if (eventCategory !== expected) {
    throw Object.assign(
      new Error(`event_category ${eventCategory} does not match catalog for ${eventName} (${expected})`),
      { code: 'EVENT_CATEGORY_MISMATCH' },
    )
  }
  return expected
}

/**
 * §2 internal idempotency key: "<source>:<object_ref>:<event_name>:<occurred_at-or-seq>".
 */
export function buildProviderEventId({
  providerEventId = null,
  source = null,
  objectRef = null,
  eventName = null,
  occurredAt = null,
  seq = null,
} = {}) {
  if (providerEventId) return providerEventId
  if (!source || !objectRef || !eventName) {
    throw Object.assign(new Error('providerEventId or source+objectRef+eventName is required'), {
      code: 'MISSING_PROVIDER_EVENT_ID',
    })
  }
  const suffix = seq != null ? String(seq) : (occurredAt || new Date().toISOString())
  const raw = `${source}:${objectRef}:${eventName}:${suffix}`
  if (raw.length <= 512) return raw
  const digest = createHash('sha256').update(raw).digest('hex')
  return `${source}:${objectRef}:${eventName}:${digest}`
}

/**
 * Ingest an event. Duplicate provider_event_id yields the existing row (idempotent).
 * Returns { event, inserted }.
 */
export async function ingestEvent({
  eventName,
  eventCategory = null,
  schemaVersion = '1',
  source = null,
  actor = null,
  objectRef = null,
  context = {},
  occurredAt = null,
  contactId = null,
  executionId = null,
  campaignId = null,
  channelConnectionId = null,
  valueMicros = null,
  currency = null,
  providerEventId = null,
  correlationId = null,
  causationEventId = null,
  agencyId = null,
  agentId = null,
  id = null,
  data = {},
  seq = null,
} = {}) {
  if (!eventName) {
    throw Object.assign(new Error('eventName is required'), { code: 'MISSING_EVENT_NAME' })
  }

  const resolvedCategory = resolveEventCategory(eventName, eventCategory)
  assertCategory(resolvedCategory)

  const occurred = occurredAt || new Date().toISOString()
  const idempotencyKey = buildProviderEventId({
    providerEventId,
    source,
    objectRef,
    eventName,
    occurredAt: occurred,
    seq,
  })

  const existing = await findOne(
    'events',
    (row) => row.provider_event_id === idempotencyKey,
  )
  if (existing) return { event: existing, inserted: false }

  const eventId = id || prefixedId('evt_')
  const ingested = new Date().toISOString()
  const params = [
    eventId,
    eventName,
    resolvedCategory,
    schemaVersion,
    source,
    actor,
    objectRef,
    JSON.stringify(context ?? {}),
    occurred,
    ingested,
    contactId,
    executionId,
    campaignId,
    channelConnectionId,
    valueMicros,
    currency,
    idempotencyKey,
    correlationId,
    causationEventId,
    agencyId,
    agentId,
    JSON.stringify(data ?? {}),
  ]

  const insertSql = `INSERT INTO public.events (
       id, event_name, event_category, schema_version, source, actor, object_ref,
       context, occurred_at, ingested_at, contact_id, execution_id, campaign_id,
       channel_connection_id, value_micros, currency, provider_event_id,
       correlation_id, causation_event_id, agency_id, agent_id, data
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,
       $8::jsonb,$9,$10,$11,$12,$13,
       $14,$15,$16,$17,
       $18,$19,$20,$21,$22::jsonb
     )
     ON CONFLICT (provider_event_id) WHERE (provider_event_id IS NOT NULL)
     DO NOTHING
     RETURNING *`

  let result
  try {
    result = await query(insertSql, params)
  } catch (err) {
    if (err?.code === '23505' || /unique|duplicate/i.test(String(err?.message || ''))) {
      const dup = await findOne(
        'events',
        (row) => row.provider_event_id === idempotencyKey,
      )
      if (dup) return { event: dup, inserted: false }
    }
    throw err
  }

  const insertedRow = Array.isArray(result) ? result[0] : result?.rows?.[0]
  if (insertedRow) {
    return { event: mapEventRow(insertedRow), inserted: true }
  }

  const afterConflict = await findOne(
    'events',
    (row) => row.provider_event_id === idempotencyKey,
  )
  if (afterConflict) return { event: afterConflict, inserted: false }

  throw Object.assign(new Error('Failed to ingest event'), { code: 'EVENT_INGEST_FAILED' })
}

function mapEventRow(row) {
  return {
    id: row.id,
    event_name: row.event_name,
    event_category: row.event_category,
    schema_version: row.schema_version,
    source: row.source,
    actor: row.actor,
    object_ref: row.object_ref,
    context: row.context,
    occurred_at: row.occurred_at,
    ingested_at: row.ingested_at,
    contact_id: row.contact_id,
    execution_id: row.execution_id,
    campaign_id: row.campaign_id,
    channel_connection_id: row.channel_connection_id,
    value_micros: row.value_micros != null ? Number(row.value_micros) : null,
    currency: row.currency,
    provider_event_id: row.provider_event_id,
    correlation_id: row.correlation_id,
    causation_event_id: row.causation_event_id,
    agency_id: row.agency_id,
    agent_id: row.agent_id,
    data: row.data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Idempotent ingest that catches unique violations on provider_event_id.
 */
export async function ingestEventSafe(payload) {
  try {
    return await ingestEvent(payload)
  } catch (err) {
    if (err?.code === '23505' && payload?.providerEventId) {
      const existing = await findOne(
        'events',
        (row) => row.provider_event_id === payload.providerEventId,
      )
      if (existing) return { event: existing, inserted: false }
    }
    throw err
  }
}

export async function getEvent(id) {
  if (!id) return null
  return findOne('events', (row) => row.id === id)
}

export async function listEvents({
  agencyId = null,
  agentId = null,
  contactId = null,
  executionId = null,
  eventName = null,
  eventCategory = null,
  correlationId = null,
} = {}) {
  return findAll('events', (row) => {
    if (agencyId != null && row.agency_id !== agencyId) return false
    if (agentId != null && row.agent_id !== agentId) return false
    if (contactId != null && row.contact_id !== contactId) return false
    if (executionId != null && row.execution_id !== executionId) return false
    if (eventName != null && row.event_name !== eventName) return false
    if (eventCategory != null && row.event_category !== eventCategory) return false
    if (correlationId != null && row.correlation_id !== correlationId) return false
    return true
  })
}

export {
  EVENT_CATEGORIES,
  EVENT_NAMES,
  EVENT_NAME_CATEGORIES,
}
