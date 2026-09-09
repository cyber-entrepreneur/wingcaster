/**
 * HTTP tests for draft progress SSE + polling endpoints (BE-BLOCKER-13).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createProgressBus } from '../infrastructure/progress-bus.js'
import { registerProgressRoutes } from '../interface/progress-routes.js'
import { Collections } from '../infrastructure/db.js'
import { SessionState, DraftStatus } from '../domain/types.js'

vi.mock('../../../auth.js', () => ({
  authMiddleware: (req, res, next) => {
    const header = req.headers.authorization || ''
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const token = header.slice(7)
    if (token === 'bad') {
      return res.status(401).json({ error: 'Invalid token' })
    }
    req.user = { id: 'agent-1', role: 'agent' }
    next()
  },
}))

const sessions = new Map()
const drafts = new Map()

vi.mock('../infrastructure/db.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    findOneModule: async (collection, predicate) => {
      if (collection === Collections.SESSIONS || collection === 'whatsapp_listing_sessions') {
        for (const row of sessions.values()) {
          if (predicate(row)) return row
        }
        return null
      }
      if (collection === Collections.DRAFTS || collection === 'whatsapp_listing_drafts') {
        for (const row of drafts.values()) {
          if (predicate(row)) return row
        }
        return null
      }
      return null
    },
  }
})

function seedSession(overrides = {}) {
  const session = {
    id: 'sess-1',
    agent_id: 'agent-1',
    state: SessionState.EXTRACTING,
    draft_id: null,
    extracted_property: null,
    media: [],
    messages: [],
    location_pins: [],
    last_error: null,
    ...overrides,
  }
  sessions.set(session.id, session)
  return session
}

function createApp({ mode = 'sse', bus } = {}) {
  const app = express()
  registerProgressRoutes(app, {
    config: {
      draftProgressMode: mode,
      draftProgressPollIntervalMs: 3000,
    },
    bus,
  })
  return app
}

describe('draft progress HTTP routes', () => {
  /** @type {ReturnType<typeof createProgressBus>} */
  let bus

  beforeEach(() => {
    sessions.clear()
    drafts.clear()
    bus = createProgressBus()
  })

  afterEach(() => {
    bus.reset()
  })

  it('capability probe returns mode metadata (GET + HEAD)', async () => {
    const app = createApp({ mode: 'sse', bus })
    const getRes = await request(app).get('/api/whatsapp-listings/drafts/progress-capability')
    expect(getRes.status).toBe(200)
    expect(getRes.body).toMatchObject({ mode: 'sse', sse: true, poll: true, poll_interval_ms: 3000 })
    expect(getRes.headers['x-draft-progress-mode']).toBe('sse')

    const headRes = await request(app).head('/api/whatsapp-listings/drafts/progress-capability')
    expect(headRes.status).toBe(204)
    expect(headRes.headers['x-draft-progress-mode']).toBe('sse')
  })

  it('capability probe reports poll mode when flagged', async () => {
    const app = createApp({ mode: 'poll', bus })
    const res = await request(app).get('/api/whatsapp-listings/drafts/progress-capability')
    expect(res.body.mode).toBe('poll')
    expect(res.body.sse).toBe(false)
  })

  it('HEAD progress returns text/event-stream when sse enabled', async () => {
    seedSession()
    const app = createApp({ mode: 'sse', bus })
    const res = await request(app)
      .head('/api/whatsapp-listings/drafts/sess-1/progress')
      .set('Authorization', 'Bearer good')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/)
    expect(res.headers['x-draft-progress-mode']).toBe('sse')
  })

  it('HEAD progress returns 404 when poll-only so clients can degrade', async () => {
    seedSession()
    const app = createApp({ mode: 'poll', bus })
    const res = await request(app)
      .head('/api/whatsapp-listings/drafts/sess-1/progress')
      .set('Authorization', 'Bearer good')
    expect(res.status).toBe(404)
    expect(res.headers['x-draft-progress-mode']).toBe('poll')
  })

  it('SSE GET streams event-stream with catch-up field events', async () => {
    seedSession({
      state: SessionState.AWAITING_APPROVAL,
      draft_id: 'draft-1',
      extracted_property: {
        address: 'Hamra',
        bedrooms: 2,
        bathrooms: 1,
        price: 250000,
        price_unit: 'USD',
        area: 100,
        area_unit: 'sqm',
        description: 'Cozy apartment',
      },
      media: [{ publicUrl: 'https://cdn.example/1.jpg', mimeType: 'image/jpeg' }],
    })
    drafts.set('draft-1', {
      id: 'draft-1',
      status: DraftStatus.AWAITING_APPROVAL,
      extracted_property: {
        address: 'Hamra',
        bedrooms: 2,
        bathrooms: 1,
        price: 250000,
        price_unit: 'USD',
        area: 100,
        area_unit: 'sqm',
        description: 'Cozy apartment',
      },
    })

    const app = createApp({ mode: 'sse', bus })
    const res = await request(app)
      .get('/api/whatsapp-listings/drafts/sess-1/progress')
      .set('Authorization', 'Bearer good')
      .buffer(true)
      .parse((response, callback) => {
        const chunks = []
        response.on('data', (c) => chunks.push(c))
        response.on('end', () => callback(null, Buffer.concat(chunks).toString('utf8')))
      })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/)
    const body = res.body
    expect(body).toContain('event: field_start')
    expect(body).toContain('event: field_complete')
    expect(body).toContain('event: draft_ready')
    expect(body).toContain('"field":"address"')
  })

  it('SSE accepts ?token= query auth for EventSource', async () => {
    seedSession({
      state: SessionState.AWAITING_APPROVAL,
      draft_id: 'draft-1',
      extracted_property: { address: 'X', bedrooms: 1, bathrooms: 1, price: 1, price_unit: 'USD', area: 10, area_unit: 'sqft', description: 'd' },
    })
    drafts.set('draft-1', { id: 'draft-1', status: DraftStatus.AWAITING_APPROVAL })

    const app = createApp({ mode: 'sse', bus })
    const res = await request(app)
      .get('/api/whatsapp-listings/drafts/sess-1/progress?token=good')
      .buffer(true)
      .parse((response, callback) => {
        const chunks = []
        response.on('data', (c) => chunks.push(c))
        response.on('end', () => callback(null, Buffer.concat(chunks).toString('utf8')))
      })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/)
  })

  it('polling state returns field snapshot + draft_ready', async () => {
    seedSession({
      state: SessionState.EXTRACTING,
      extracted_property: {
        address: 'Hamra',
        bedrooms: 2,
        bathrooms: null,
        price: 100,
        price_unit: 'USD',
        area: null,
        description: null,
      },
    })
    const app = createApp({ mode: 'sse', bus })
    const res = await request(app)
      .get('/api/whatsapp-listings/drafts/sess-1/state')
      .set('Authorization', 'Bearer good')
    expect(res.status).toBe(200)
    expect(res.body.session_id).toBe('sess-1')
    expect(res.body.draft_ready).toBe(false)
    expect(res.body.fields).toHaveLength(7)
    expect(res.body.fields.find((f) => f.key === 'address')).toMatchObject({
      state: 'complete',
      value: 'Hamra',
    })
    expect(res.body.fields.find((f) => f.key === 'bathrooms').state).toBe('thinking')
    expect(res.body.poll_interval_ms).toBe(3000)
  })

  it('agent-prefixed aliases work', async () => {
    seedSession({ state: SessionState.COLLECTING })
    const app = createApp({ mode: 'sse', bus })
    const res = await request(app)
      .get('/api/agent/whatsapp-listings/drafts/sess-1/state')
      .set('Authorization', 'Bearer good')
    expect(res.status).toBe(200)
    expect(res.body.session_id).toBe('sess-1')
  })

  it('rejects unauthorized and foreign sessions', async () => {
    seedSession({ agent_id: 'other-agent' })
    const app = createApp({ mode: 'sse', bus })
    expect(
      (await request(app).get('/api/whatsapp-listings/drafts/sess-1/state')).status,
    ).toBe(401)
    expect(
      (
        await request(app)
          .get('/api/whatsapp-listings/drafts/sess-1/state')
          .set('Authorization', 'Bearer good')
      ).status,
    ).toBe(403)
  })

  it('live SSE receives bus events until draft_ready', async () => {
    seedSession({ state: SessionState.EXTRACTING })
    const app = createApp({ mode: 'sse', bus })

    let resolveSubscribed
    const subscribed = new Promise((resolve) => {
      resolveSubscribed = resolve
    })
    const originalSubscribe = bus.subscribe.bind(bus)
    bus.subscribe = (sessionId, handler) => {
      const unsub = originalSubscribe(sessionId, handler)
      resolveSubscribed()
      return unsub
    }

    // Kick the request immediately (supertest is lazy until thenable).
    const pending = Promise.resolve(
      request(app)
        .get('/api/whatsapp-listings/drafts/sess-1/progress')
        .set('Authorization', 'Bearer good')
        .buffer(true)
        .parse((response, callback) => {
          const chunks = []
          response.on('data', (c) => chunks.push(c))
          response.on('end', () => callback(null, Buffer.concat(chunks).toString('utf8')))
        }),
    )

    await Promise.race([
      subscribed,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SSE subscribe timeout')), 2000)),
    ])

    bus.emit('sess-1', { type: 'field_complete', field: 'price', value: '100 USD' })
    bus.emit('sess-1', { type: 'draft_ready', draft_id: 'draft-live' })

    const res = await pending
    expect(res.status).toBe(200)
    expect(res.body).toContain('event: field_complete')
    expect(res.body).toContain('event: draft_ready')
    expect(res.body).toContain('draft-live')
  }, 10000)
})
