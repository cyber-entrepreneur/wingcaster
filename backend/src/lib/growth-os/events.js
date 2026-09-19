/**
 * Growth-OS Wave 0 — events access layer.
 * ingestEvent implements docs/event-taxonomy-catalog.md v2 §2–§4.
 */

import { createHash, randomUUID } from 'node:crypto'
import { findAll, findOne, query } from '../../persistence/index.js'
import { withTenant } from './with-tenant.js'

const EVENT_CATEGORIES = new Set(['business', 'delivery', 'engagement', 'system'])

/** Launch [L] / starred vocabulary from event-taxonomy-catalog.md v2 §4. */
const EVENT_NAME_CATEGORIES = {
  'lead.created': 'business',
  'lead.qualified': 'business',
  'lead.assigned': 'business',
  'lead.contacted': 'business',
  'viewing.booked': 'business',
  'viewing.completed': 'business',
  'offer.made': 'business',
  'reservation.created': 'business',
  'transaction.closed': 'business',
  'commission.earned': 'business',
  'message.submitted': 'delivery',
  'message.delivered': 'delivery',
  'message.failed': 'delivery',
  'post.published': 'delivery',
  'post.failed': 'delivery',
  'portal.submitted': 'delivery',
  'email.opened': 'engagement',
  'email.clicked': 'engagement',
  'message.read': 'engagement',
  'message.replied': 'engagement',
  'link.clicked': 'engagement',
  'unsubscribe.requested': 'engagement',
  'execution.created': 'system',
  'consent.granted': 'system',
  'consent.withdrawn': 'system',
  'journey.entered': 'system',
  'journey.node.suppressed': 'system',
}

const EVENT_NAMES = new Set(Object.keys(EVENT_NAME_CATEGORIES))

const ACTOR_TYPES = new Set(['agent', 'contact', 'system', 'ai'])
const OBJECT_TYPES = new Set([
  'lead',
  'contact',
  'conversation',
  'message',
  'campaign',
  'post',
  'execution',
  'integration',
  'approval',
])

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

function parseTypedRef(ref) {
  if (ref == null) return { type: null, id: null }
  const str = String(ref)
  const idx = str.indexOf(':')
  if (idx <= 0) return { type: null, id: null }
  return {
    type: str.slice(0, idx),
    id: str.slice(idx + 1) || null,
  }
}

function resolveActor(actorType, actorId, actor) {
  if (actorType != null) {
    if (!ACTOR_TYPES.has(actorType)) {
      throw Object.assign(new Error(`Invalid actor_type: ${actorType}`), { code: 'INVALID_ACTOR_TYPE' })
    }
    return { actorType, actorId }
  }
  if (actor != null) {
    const parsed = parseTypedRef(actor)
    if (parsed.type && !ACTOR_TYPES.has(parsed.type)) {
      throw Object.assign(new Error(`Invalid actor_type: ${parsed.type}`), { code: 'INVALID_ACTOR_TYPE' })
    }
    return { actorType: parsed.type, actorId: parsed.id }
  }
  return { actorType: null, actorId: null }
}

function resolveObject(objectType, objectId, objectRef) {
  if (objectType != null) {
    if (!OBJECT_TYPES.has(objectType)) {
      throw Object.assign(new Error(`Invalid object_type: ${objectType}`), { code: 'INVALID_OBJECT_TYPE' })
    }
    return { objectType, objectId }
  }
  if (objectRef != null) {
    const parsed = parseTypedRef(objectRef)
    if (parsed.type && !OBJECT_TYPES.has(parsed.type)) {
      throw Object.assign(new Error(`Invalid object_type: ${parsed.type}`), { code: 'INVALID_OBJECT_TYPE' })
    }
    return { objectType: parsed.type, objectId: parsed.id }
  }
  return { objectType: null, objectId: null }
}

function normalizeIdentityRefs(value) {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('identityRefs must be a JSON object'), { code: 'INVALID_IDENTITY_REFS' })
  }
  return value
}

/**
 * §2 idempotency key for provider-sourced events: "<source>:<provider_event_id>".
 */
export function buildProviderIdempotencyKey(source, providerEventId) {
  if (!source || !providerEventId) {
    throw Object.assign(new Error('source and providerEventId are required'), {
      code: 'MISSING_PROVIDER_EVENT_ID',
    })
  }
  return `${source}:${providerEventId}`
}

/**
 * §2 idempotency key for internally-produced events:
 * "<source>:<object_type>:<object_id>:<event_name>:<occurred_at-or-seq>".
 */
export function buildIdempotencyKey({
  source = null,
  objectType = null,
  objectId = null,
  objectRef = null,
  eventName = null,
  occurredAt = null,
  seq = null,
} = {}) {
  const resolvedObject = resolveObject(objectType, objectId, objectRef)
  if (!source || !resolvedObject.objectType || !resolvedObject.objectId || !eventName) {
    throw Object.assign(new Error('source, objectType+objectId (or objectRef), and eventName are required'), {
      code: 'MISSING_IDEMPOTENCY_KEY',
    })
  }
  const suffix = seq != null ? String(seq) : (occurredAt || new Date().toISOString())
  const raw = `${source}:${resolvedObject.objectType}:${resolvedObject.objectId}:${eventName}:${suffix}`
  if (raw.length <= 512) return raw
  const digest = createHash('sha256').update(raw).digest('hex')
  return `${source}:${resolvedObject.objectType}:${resolvedObject.objectId}:${eventName}:${digest}`
}

/**
 * Resolve the dedup idempotency_key (catalog §2).
 * @deprecated Prefer buildIdempotencyKey / buildProviderIdempotencyKey.
 */
export function buildProviderEventId({
  idempotencyKey = null,
  providerEventId = null,
  providerMessageId = null,
  source = null,
  objectType = null,
  objectId = null,
  objectRef = null,
  eventName = null,
  occurredAt = null,
  seq = null,
} = {}) {
  if (idempotencyKey) return idempotencyKey
  if (providerEventId && source) return buildProviderIdempotencyKey(source, providerEventId)
  if (providerEventId) return providerEventId
  return buildIdempotencyKey({
    source,
    objectType,
    objectId,
    objectRef,
    eventName,
    occurredAt,
    seq,
  })
}

/**
 * Ingest an event. Duplicate idempotency_key yields the existing row (idempotent).
 * Returns { event, inserted }.
 */
export async function ingestEvent({
  eventName,
  eventCategory = null,
  schemaVersion = '1',
  source = null,
  actor = null,
  actorType = null,
  actorId = null,
  objectRef = null,
  objectType = null,
  objectId = null,
  context = {},
  occurredAt = null,
  contactId = null,
  executionId = null,
  campaignId = null,
  channelConnectionId = null,
  valueMicros = null,
  currency = null,
  idempotencyKey = null,
  providerEventId = null,
  providerMessageId = null,
  subjectIdentityId = null,
  identityRefs = {},
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
  const resolvedActor = resolveActor(actorType, actorId, actor)
  const resolvedObject = resolveObject(objectType, objectId, objectRef)

  const resolvedIdempotencyKey = buildProviderEventId({
    idempotencyKey,
    providerEventId,
    source,
    objectType: resolvedObject.objectType,
    objectId: resolvedObject.objectId,
    objectRef,
    eventName,
    occurredAt: occurred,
    seq,
  })

  return withTenant(agencyId, agentId, async () => {
  const existing = await findOne(
    'events',
    (row) => row.idempotency_key === resolvedIdempotencyKey,
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
    resolvedActor.actorType,
    resolvedActor.actorId,
    resolvedObject.objectType,
    resolvedObject.objectId,
    JSON.stringify(context ?? {}),
    occurred,
    ingested,
    contactId,
    executionId,
    campaignId,
    channelConnectionId,
    valueMicros,
    currency,
    resolvedIdempotencyKey,
    providerEventId,
    providerMessageId,
    subjectIdentityId,
    JSON.stringify(normalizeIdentityRefs(identityRefs)),
    correlationId,
    causationEventId,
    agencyId,
    agentId,
    JSON.stringify(data ?? {}),
  ]

  const insertSql = `INSERT INTO public.events (
       id, event_name, event_category, schema_version, source,
       actor_type, actor_id, object_type, object_id,
       context, occurred_at, ingested_at, contact_id, execution_id, campaign_id,
       channel_connection_id, value_micros, currency,
       idempotency_key, provider_event_id, provider_message_id,
       subject_identity_id, identity_refs,
       correlation_id, causation_event_id, agency_id, agent_id, data
     ) VALUES (
       $1,$2,$3,$4,$5,
       $6,$7,$8,$9,
       $10::jsonb,$11,$12,$13,$14,$15,
       $16,$17,$18,
       $19,$20,$21,
       $22,$23::jsonb,
       $24,$25,$26,$27,$28::jsonb
     )
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`

  let result
  try {
    result = await query(insertSql, params)
  } catch (err) {
    if (err?.code === '23505' || /unique|duplicate/i.test(String(err?.message || ''))) {
      const dup = await findOne(
        'events',
        (row) => row.idempotency_key === resolvedIdempotencyKey,
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
    (row) => row.idempotency_key === resolvedIdempotencyKey,
  )
  if (afterConflict) return { event: afterConflict, inserted: false }

  throw Object.assign(new Error('Failed to ingest event'), { code: 'EVENT_INGEST_FAILED' })
  })
}

function mapEventRow(row) {
  return {
    id: row.id,
    event_name: row.event_name,
    event_category: row.event_category,
    schema_version: row.schema_version,
    source: row.source,
    actor_type: row.actor_type,
    actor_id: row.actor_id,
    object_type: row.object_type,
    object_id: row.object_id,
    context: row.context,
    occurred_at: row.occurred_at,
    ingested_at: row.ingested_at,
    contact_id: row.contact_id,
    execution_id: row.execution_id,
    campaign_id: row.campaign_id,
    channel_connection_id: row.channel_connection_id,
    value_micros: row.value_micros != null ? Number(row.value_micros) : null,
    currency: row.currency,
    idempotency_key: row.idempotency_key,
    provider_event_id: row.provider_event_id,
    provider_message_id: row.provider_message_id,
    subject_identity_id: row.subject_identity_id,
    identity_refs: row.identity_refs,
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
 * Idempotent ingest that catches unique violations on idempotency_key.
 */
export async function ingestEventSafe(payload) {
  try {
    return await ingestEvent(payload)
  } catch (err) {
    if (err?.code === '23505' && payload) {
      const key = buildProviderEventId({
        idempotencyKey: payload.idempotencyKey,
        providerEventId: payload.providerEventId,
        source: payload.source,
        objectType: payload.objectType,
        objectId: payload.objectId,
        objectRef: payload.objectRef,
        eventName: payload.eventName,
        occurredAt: payload.occurredAt,
        seq: payload.seq,
      })
      const existing = await findOne(
        'events',
        (row) => row.idempotency_key === key,
      )
      if (existing) return { event: existing, inserted: false }
    }
    throw err
  }
}

export async function getEvent(id, { agencyId = null, agentId = null } = {}) {
  if (!id) return null
  return withTenant(agencyId, agentId, () =>
    findOne('events', (row) => row.id === id),
  )
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
  return withTenant(agencyId, agentId, () => findAll('events', (row) => {
    if (agencyId != null && row.agency_id !== agencyId) return false
    if (agentId != null && row.agent_id !== agentId) return false
    if (contactId != null && row.contact_id !== contactId) return false
    if (executionId != null && row.execution_id !== executionId) return false
    if (eventName != null && row.event_name !== eventName) return false
    if (eventCategory != null && row.event_category !== eventCategory) return false
    if (correlationId != null && row.correlation_id !== correlationId) return false
    return true
  }))
}

export {
  EVENT_CATEGORIES,
  EVENT_NAMES,
  EVENT_NAME_CATEGORIES,
  ACTOR_TYPES,
  OBJECT_TYPES,
}
