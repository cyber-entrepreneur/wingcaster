/**
 * Unit tests for draft progress bus + field snapshot synthesis (BE-BLOCKER-13).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createProgressBus } from '../infrastructure/progress-bus.js'
import {
  DRAFT_FIELD_KEYS,
  buildFieldSnapshot,
  createProgressReporter,
  extractFieldValues,
  getProgressCapability,
  normalizeProgressMode,
  synthesizeEventsFromSnapshot,
} from '../application/draft-progress.js'
import { SessionState, DraftStatus } from '../domain/types.js'

describe('normalizeProgressMode', () => {
  it('defaults to sse', () => {
    expect(normalizeProgressMode()).toBe('sse')
    expect(normalizeProgressMode('')).toBe('sse')
    expect(normalizeProgressMode('SSE')).toBe('sse')
  })

  it('accepts poll aliases', () => {
    expect(normalizeProgressMode('poll')).toBe('poll')
    expect(normalizeProgressMode('polling')).toBe('poll')
  })
})

describe('getProgressCapability', () => {
  it('reports sse preferred with poll always available', () => {
    const cap = getProgressCapability({ draftProgressMode: 'sse', draftProgressPollIntervalMs: 3000 })
    expect(cap).toMatchObject({
      mode: 'sse',
      sse: true,
      poll: true,
      poll_interval_ms: 3000,
    })
    expect(cap.endpoints.progress).toContain('/progress')
    expect(cap.endpoints.state).toContain('/state')
  })

  it('reports poll-only when flagged', () => {
    const cap = getProgressCapability({ draftProgressMode: 'poll' })
    expect(cap.mode).toBe('poll')
    expect(cap.sse).toBe(false)
    expect(cap.poll).toBe(true)
  })
})

describe('extractFieldValues / buildFieldSnapshot', () => {
  const property = {
    address: '42 Marina Walk',
    city: 'Dubai',
    bedrooms: 2,
    bathrooms: 2,
    price: 450000,
    price_unit: 'USD',
    area: 120,
    area_unit: 'sqm',
    description: 'Bright apartment with marina views.',
  }

  it('maps property fields onto LiveDraftCanvas keys', () => {
    const values = extractFieldValues(property, {
      media: [{ publicUrl: 'https://cdn.example/a.jpg', mimeType: 'image/jpeg' }],
    })
    expect(values.address).toBe('42 Marina Walk')
    expect(values.bedrooms).toBe(2)
    expect(values.bathrooms).toBe(2)
    expect(values.price).toBe('450000 USD')
    expect(values.area_sqft).toBe(Math.round(120 * 10.7639))
    expect(values.description).toContain('marina')
    expect(values.photos).toEqual(['https://cdn.example/a.jpg'])
  })

  it('builds idle snapshot before extraction', () => {
    const snap = buildFieldSnapshot({
      id: 'sess-1',
      state: SessionState.COLLECTING,
      extracted_property: null,
    })
    expect(snap.draft_ready).toBe(false)
    expect(snap.fields).toHaveLength(DRAFT_FIELD_KEYS.length)
    expect(snap.fields.every((f) => f.state === 'idle')).toBe(true)
  })

  it('marks fields thinking while extracting', () => {
    const snap = buildFieldSnapshot({
      id: 'sess-1',
      state: SessionState.EXTRACTING,
      extracted_property: null,
    })
    expect(snap.fields.every((f) => f.state === 'thinking')).toBe(true)
  })

  it('marks completed fields + draft_ready after approval state', () => {
    const snap = buildFieldSnapshot(
      {
        id: 'sess-1',
        state: SessionState.AWAITING_APPROVAL,
        draft_id: 'draft-1',
        extracted_property: property,
        media: [{ publicUrl: 'https://cdn.example/a.jpg', mimeType: 'image/jpeg' }],
      },
      { id: 'draft-1', status: DraftStatus.AWAITING_APPROVAL, extracted_property: property },
    )
    expect(snap.draft_ready).toBe(true)
    expect(snap.completed_fields).toBe(DRAFT_FIELD_KEYS.length)
    expect(snap.fields.find((f) => f.key === 'address').value).toBe('42 Marina Walk')
  })
})

describe('progress bus + reporter emission', () => {
  /** @type {ReturnType<typeof createProgressBus>} */
  let bus

  beforeEach(() => {
    bus = createProgressBus({ bufferSize: 32 })
  })

  it('emits and buffers events for subscribers', () => {
    const received = []
    const unsub = bus.subscribe('s1', (e) => received.push(e))
    bus.emit('s1', { type: 'field_start', field: 'address' })
    bus.emit('s1', { type: 'field_complete', field: 'address', value: 'Hamra' })
    expect(received).toHaveLength(2)
    expect(received[0].type).toBe('field_start')
    expect(received[1].value).toBe('Hamra')
    expect(bus.getBuffered('s1')).toHaveLength(2)
    unsub()
    bus.emit('s1', { type: 'draft_ready', draft_id: 'd1' })
    expect(received).toHaveLength(2)
    expect(bus.getBuffered('s1').at(-1).type).toBe('draft_ready')
  })

  it('reporter emits staged field_start → complete → draft_ready', async () => {
    const reporter = createProgressReporter({ bus })
    const events = []
    bus.subscribe('s2', (e) => events.push(e))

    await reporter.beginExtraction('s2')
    expect(events.filter((e) => e.type === 'field_start')).toHaveLength(DRAFT_FIELD_KEYS.length)

    await reporter.reportExtractedFields(
      's2',
      {
        address: 'Hamra',
        bedrooms: 2,
        bathrooms: 1,
        price: 200000,
        price_unit: 'USD',
        area: 90,
        area_unit: 'sqm',
        description: 'Nice place near the Corniche with balcony.',
      },
      { media: [] },
    )

    expect(events.some((e) => e.type === 'field_stream' && e.field === 'description')).toBe(true)
    expect(events.some((e) => e.type === 'field_complete' && e.field === 'bedrooms' && e.value === 2)).toBe(true)
    expect(events.some((e) => e.type === 'field_complete' && e.field === 'description')).toBe(true)

    await reporter.reportPhotos('s2', {
      extracted_property: {},
      media: [{ publicUrl: 'https://cdn.example/p.jpg', mimeType: 'image/jpeg' }],
    })
    expect(events.some((e) => e.type === 'field_complete' && e.field === 'photos')).toBe(true)

    await reporter.reportDraftReady('s2', { id: 'draft-99' })
    expect(events.at(-1)).toMatchObject({ type: 'draft_ready', draft_id: 'draft-99' })
  })

  it('reporter emits error events', async () => {
    const reporter = createProgressReporter({ bus })
    const events = []
    bus.subscribe('s3', (e) => events.push(e))
    await reporter.reportError('s3', 'boom')
    expect(events).toEqual([
      expect.objectContaining({ type: 'error', message: 'boom', session_id: 's3' }),
    ])
  })
})

describe('synthesizeEventsFromSnapshot', () => {
  it('replays field_start/complete and draft_ready for catch-up', () => {
    const snap = buildFieldSnapshot(
      {
        id: 'sess-x',
        state: SessionState.AWAITING_APPROVAL,
        draft_id: 'd1',
        extracted_property: {
          address: 'A',
          bedrooms: 1,
          bathrooms: 1,
          price: 1,
          price_unit: 'USD',
          area: 50,
          area_unit: 'sqft',
          description: 'Short desc',
        },
        media: [],
      },
      { id: 'd1', status: DraftStatus.AWAITING_APPROVAL },
    )
    const events = synthesizeEventsFromSnapshot(snap, { streamDescription: false })
    expect(events[0].type).toBe('field_start')
    expect(events.some((e) => e.type === 'field_complete' && e.field === 'address')).toBe(true)
    expect(events.at(-1)).toMatchObject({ type: 'draft_ready', draft_id: 'd1' })
  })
})
