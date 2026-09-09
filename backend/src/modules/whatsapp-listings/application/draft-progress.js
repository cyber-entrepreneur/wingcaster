/**
 * Draft-field progress helpers for AGT-WLB-004 / BE-BLOCKER-13.
 *
 * Field keys match <LiveDraftCanvas>:
 *   address | bedrooms | bathrooms | price | area_sqft | description | photos
 *
 * Pipeline stages emit into the in-process bus. HTTP routes either stream those
 * events (SSE) or snapshot current field state (polling).
 */

import { DraftStatus, SessionState } from '../domain/types.js'
import { draftProgressBus } from '../infrastructure/progress-bus.js'
import { Collections, findOneModule } from '../infrastructure/db.js'

export const DRAFT_FIELD_KEYS = Object.freeze([
  'address',
  'bedrooms',
  'bathrooms',
  'price',
  'area_sqft',
  'description',
  'photos',
])

export const DRAFT_FIELD_LABELS = Object.freeze({
  address: 'Address',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  price: 'Price',
  area_sqft: 'Area (sqft)',
  description: 'Description',
  photos: 'Photos',
})

/** Chunk size for synthesized description streaming (chars). */
const DESCRIPTION_CHUNK = 24

/**
 * @param {object|null|undefined} property
 * @param {object|null|undefined} session
 */
export function extractFieldValues(property, session = null) {
  const p = property || {}
  const address =
    p.address ||
    p.address_display ||
    [p.neighborhood, p.city || p.location].filter(Boolean).join(', ') ||
    session?.address_description ||
    null

  let areaSqft = null
  if (typeof p.area === 'number') {
    const unit = String(p.area_unit || '').toLowerCase()
    if (unit === 'sqm' || unit === 'm2' || unit === 'm²') {
      areaSqft = Math.round(p.area * 10.7639)
    } else {
      areaSqft = p.area
    }
  }

  let priceValue = null
  if (typeof p.price === 'number') {
    const unit = p.price_unit || p.currency || ''
    priceValue = unit ? `${p.price} ${unit}`.trim() : p.price
  }

  const photoUrls = []
  const media = Array.isArray(session?.media) ? session.media : []
  for (const m of media) {
    if (m?.publicUrl && /^image\//.test(m.mimeType || 'image/jpeg')) {
      photoUrls.push(m.publicUrl)
    }
  }
  if (!photoUrls.length && session?.generated_thumbnails?.paths) {
    photoUrls.push(...Object.values(session.generated_thumbnails.paths).filter(Boolean))
  }

  return {
    address: address || null,
    bedrooms: typeof p.bedrooms === 'number' ? p.bedrooms : null,
    bathrooms: typeof p.bathrooms === 'number' ? p.bathrooms : null,
    price: priceValue,
    area_sqft: areaSqft,
    description: typeof p.description === 'string' && p.description.trim() ? p.description.trim() : null,
    photos: photoUrls.length ? photoUrls : null,
  }
}

/**
 * Build a LiveDraftCanvas-compatible field snapshot from session (+ optional draft).
 *
 * @param {object|null} session
 * @param {object|null} [draft]
 */
export function buildFieldSnapshot(session, draft = null) {
  const property = draft?.extracted_property || session?.extracted_property || null
  const values = extractFieldValues(property, session)
  const state = session?.state || null
  const draftReady = isDraftReady(session, draft)
  const errored = state === SessionState.ERROR || draft?.status === DraftStatus.ERROR
  const extracting =
    state === SessionState.EXTRACTING ||
    state === SessionState.READY_FOR_EXTRACTION ||
    (state === SessionState.COLLECTING && Boolean(session?.ready_for_extraction_at))

  const fields = DRAFT_FIELD_KEYS.map((key) => {
    const value = values[key]
    const hasValue = value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)
    let fieldState = 'idle'
    if (draftReady && hasValue) fieldState = 'complete'
    else if (draftReady && !hasValue) fieldState = 'complete' // finished pipeline; empty is final
    else if (errored) fieldState = hasValue ? 'complete' : 'idle'
    else if (hasValue) fieldState = 'complete'
    else if (extracting) fieldState = 'thinking'
    else fieldState = 'idle'

    return {
      key,
      label: DRAFT_FIELD_LABELS[key],
      state: fieldState,
      value: hasValue ? value : undefined,
      streamedText: key === 'description' && fieldState === 'complete' && hasValue ? value : undefined,
    }
  })

  const completed = fields.filter((f) => f.state === 'complete').length

  return {
    session_id: session?.id || null,
    draft_id: draft?.id || session?.draft_id || null,
    session_state: state,
    draft_status: draft?.status || null,
    draft_ready: draftReady,
    error: errored ? (session?.last_error || draft?.error || 'Draft failed') : null,
    fields,
    completed_fields: completed,
    total_fields: DRAFT_FIELD_KEYS.length,
  }
}

export function isDraftReady(session, draft = null) {
  if (draft?.status === DraftStatus.AWAITING_APPROVAL || draft?.status === DraftStatus.APPROVED || draft?.status === DraftStatus.PUBLISHED) {
    return true
  }
  if (!session) return false
  return (
    session.state === SessionState.AWAITING_APPROVAL ||
    session.state === SessionState.AWAITING_PRICE_ADJUSTMENT ||
    session.state === SessionState.PUBLISHING ||
    session.state === SessionState.COMPLETED ||
    Boolean(session.draft_id && session.extracted_property)
  )
}

/**
 * Synthesize ordered progress events from a completed (or partial) snapshot.
 * Used for SSE catch-up when the client connects after fields already exist.
 *
 * @param {ReturnType<typeof buildFieldSnapshot>} snapshot
 * @param {{ streamDescription?: boolean }} [opts]
 */
export function synthesizeEventsFromSnapshot(snapshot, { streamDescription = true } = {}) {
  const events = []
  const sessionId = snapshot.session_id
  if (!sessionId) return events

  if (snapshot.error && !snapshot.draft_ready) {
    events.push({
      type: 'error',
      session_id: sessionId,
      message: snapshot.error,
      draft_id: snapshot.draft_id,
    })
    return events
  }

  for (const field of snapshot.fields) {
    if (field.state === 'idle') continue
    events.push({ type: 'field_start', session_id: sessionId, field: field.key })

    if (field.state === 'thinking') continue

    if (field.key === 'description' && streamDescription && typeof field.value === 'string' && field.value.length) {
      for (const partial of chunkText(field.value, DESCRIPTION_CHUNK)) {
        events.push({
          type: 'field_stream',
          session_id: sessionId,
          field: 'description',
          partial_text: partial,
        })
      }
    }

    if (field.state === 'complete' || field.state === 'streaming') {
      events.push({
        type: 'field_complete',
        session_id: sessionId,
        field: field.key,
        value: field.value,
      })
    }
  }

  if (snapshot.draft_ready) {
    events.push({
      type: 'draft_ready',
      session_id: sessionId,
      draft_id: snapshot.draft_id,
    })
  }

  return events
}

function chunkText(text, size) {
  const out = []
  for (let i = size; i < text.length; i += size) {
    out.push(text.slice(0, i))
  }
  out.push(text)
  return out
}

/**
 * Pipeline reporter — emits staged events into the bus as extraction progresses.
 */
export function createProgressReporter({ bus = draftProgressBus, logger } = {}) {
  async function beginExtraction(sessionId) {
    for (const field of DRAFT_FIELD_KEYS) {
      bus.emit(sessionId, { type: 'field_start', field })
    }
  }

  /**
   * After AI extraction lands on the session, emit field_complete (+ description stream).
   */
  async function reportExtractedFields(sessionId, property, session) {
    const values = extractFieldValues(property, session)

    for (const key of DRAFT_FIELD_KEYS) {
      if (key === 'description') continue
      if (key === 'photos') continue // photos finalize after media/thumbnail stage
      const value = values[key]
      if (value === null || value === undefined) continue
      bus.emit(sessionId, { type: 'field_complete', field: key, value })
    }

    const description = values.description
    if (typeof description === 'string' && description.length) {
      for (const partial of chunkText(description, DESCRIPTION_CHUNK)) {
        bus.emit(sessionId, {
          type: 'field_stream',
          field: 'description',
          partial_text: partial,
        })
      }
      bus.emit(sessionId, { type: 'field_complete', field: 'description', value: description })
    }
  }

  async function reportPhotos(sessionId, session) {
    const values = extractFieldValues(session?.extracted_property, session)
    if (values.photos) {
      bus.emit(sessionId, { type: 'field_complete', field: 'photos', value: values.photos })
    } else {
      // Pipeline finished photo stage with none — still mark complete so UI unlocks.
      bus.emit(sessionId, { type: 'field_complete', field: 'photos', value: [] })
    }
  }

  async function reportDraftReady(sessionId, draft) {
    bus.emit(sessionId, {
      type: 'draft_ready',
      draft_id: draft?.id || null,
    })
  }

  async function reportError(sessionId, message) {
    bus.emit(sessionId, {
      type: 'error',
      message: message || 'Draft processing failed',
    })
    logger?.warn?.({ sessionId, message }, 'draft progress error emitted')
  }

  return {
    beginExtraction,
    reportExtractedFields,
    reportPhotos,
    reportDraftReady,
    reportError,
  }
}

/**
 * Load session + draft and return a polling-ready state payload.
 */
export async function loadDraftProgressState(sessionId) {
  const session = await findOneModule(Collections.SESSIONS, (s) => s.id === sessionId)
  if (!session) return null
  let draft = null
  if (session.draft_id) {
    draft = await findOneModule(Collections.DRAFTS, (d) => d.id === session.draft_id)
  }
  return buildFieldSnapshot(session, draft)
}

export function getProgressCapability(config) {
  const mode = normalizeProgressMode(config?.draftProgressMode)
  return {
    mode,
    sse: mode === 'sse',
    poll: true,
    poll_interval_ms: Number(config?.draftProgressPollIntervalMs) || 3000,
    endpoints: {
      progress: '/api/whatsapp-listings/drafts/:sessionId/progress',
      state: '/api/whatsapp-listings/drafts/:sessionId/state',
      capability: '/api/whatsapp-listings/drafts/progress-capability',
      agent_progress: '/api/agent/whatsapp-listings/drafts/:sessionId/progress',
      agent_state: '/api/agent/whatsapp-listings/drafts/:sessionId/state',
    },
  }
}

export function normalizeProgressMode(raw) {
  const mode = String(raw || 'sse').toLowerCase().trim()
  return mode === 'poll' || mode === 'polling' ? 'poll' : 'sse'
}
