/**
 * AGT-CMP-004 campaign stats route tests.
 *
 * Boots only the campaign-stats module against a bare Express app with mocked
 * db + authz. Covers: ownership gating (leak-safe 404), the delivery funnel +
 * enrollment lifecycle aggregation, per-channel / per-step breakdowns, truthful
 * reply + conversion signals, and the empty-campaign shape.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  query: vi.fn(),
  transaction: vi.fn(),
}))

const authz = vi.hoisted(() => ({
  assertOwnsCampaign: vi.fn(),
  NotFoundError: class NotFoundError extends Error {
    constructor() {
      super('not found')
      this.name = 'NotFoundError'
      this.status = 404
    }
  },
}))

vi.mock('../db.js', () => db)
vi.mock('../lib/authz.js', () => authz)

let registerRoutes

/** Fixture-backed db: dispatch findOne/findAll on collection name. */
function seed(store) {
  db.findOne.mockImplementation(async (collection, fn) => (store[collection] || []).find(fn) ?? null)
  db.findAll.mockImplementation(async (collection, fn) =>
    (store[collection] || []).filter(fn || (() => true)),
  )
}

async function createApp(userId = 'agent-1') {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(db)) fn.mockReset?.()
  authz.assertOwnsCampaign.mockReset()
  authz.assertOwnsCampaign.mockResolvedValue({ id: 'camp-1', agent_id: 'agent-1' })
  ;({ registerRoutes } = await import('./campaign-stats-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/campaigns/:id/stats', () => {
  it('returns 404 (not 403) when the caller does not own the campaign', async () => {
    authz.assertOwnsCampaign.mockRejectedValue(new authz.NotFoundError())
    seed({})
    const app = await createApp()
    const res = await request(app).get('/api/campaigns/camp-x/stats')
    expect(res.status).toBe(404)
    expect(db.findOne).not.toHaveBeenCalled()
  })

  it('404s when the campaign row is missing even though ownership passed', async () => {
    seed({ campaigns: [] })
    const app = await createApp()
    const res = await request(app).get('/api/campaigns/ghost/stats')
    expect(res.status).toBe(404)
  })

  it('returns zeroed totals for a campaign with no enrollments or messages', async () => {
    seed({
      campaigns: [{ id: 'camp-1', name: 'Empty', target_channel: 'email', steps: [] }],
      campaign_enrollments: [],
      campaign_messages: [],
    })
    const app = await createApp()
    const res = await request(app).get('/api/campaigns/camp-1/stats')
    expect(res.status).toBe(200)
    expect(res.body.totals).toMatchObject({
      enrolled: 0,
      sent: 0,
      failed: 0,
      replied: 0,
      converted: 0,
    })
    expect(res.body.channels).toEqual([])
    expect(res.body.steps).toEqual([])
    expect(res.body.enrollments).toEqual([])
  })

  it('aggregates the delivery funnel, lifecycle, channels, steps and enrollment rows', async () => {
    seed({
      campaigns: [
        {
          id: 'camp-1',
          name: 'Nurture',
          target_channel: 'email',
          steps: [
            { step_index: 0, channel: 'email', delay_hours: 0 },
            { step_index: 1, channel: 'whatsapp', delay_hours: 24 },
          ],
        },
      ],
      campaign_enrollments: [
        { id: 'e1', campaign_id: 'camp-1', contact_id: 'c1', status: 'active', current_step_index: 1, started_at: '2026-01-01T00:00:00Z' },
        { id: 'e2', campaign_id: 'camp-1', contact_id: 'c2', status: 'completed', current_step_index: 2, started_at: '2026-01-02T00:00:00Z', completed_at: '2026-01-05T00:00:00Z' },
        { id: 'e3', campaign_id: 'camp-1', contact_id: 'c3', status: 'cancelled', current_step_index: 0, started_at: '2026-01-03T00:00:00Z' },
      ],
      campaign_messages: [
        { id: 'm1', campaign_id: 'camp-1', contact_id: 'c1', step_index: 0, channel: 'email', status: 'sent' },
        { id: 'm2', campaign_id: 'camp-1', contact_id: 'c2', step_index: 0, channel: 'email', status: 'sent' },
        { id: 'm3', campaign_id: 'camp-1', contact_id: 'c2', step_index: 1, channel: 'whatsapp', status: 'failed' },
        { id: 'm4', campaign_id: 'camp-1', contact_id: 'c3', step_index: 0, channel: 'email', status: 'skipped' },
      ],
      contacts: [
        { id: 'c1', name: 'Alice' },
        { id: 'c2', name: 'Bob' },
        { id: 'c3', email: 'carol@example.com' },
      ],
      conversations: [{ id: 'conv1', contact_id: 'c1' }],
      conversation_messages: [
        { id: 'im1', conversation_id: 'conv1', direction: 'inbound', sent_at: '2026-01-04T00:00:00Z' },
      ],
      opportunities: [
        { id: 'o1', contact_id: 'c2', stage: 'closed_won', closed_at: '2026-01-06T00:00:00Z' },
      ],
    })
    const app = await createApp()
    const res = await request(app).get('/api/campaigns/camp-1/stats')
    expect(res.status).toBe(200)

    expect(res.body.totals).toMatchObject({
      enrolled: 3,
      active: 1,
      completed: 1,
      cancelled: 1,
      messages_total: 4,
      sent: 2,
      failed: 1,
      skipped: 1,
      replied: 1,
      converted: 1,
    })

    const email = res.body.channels.find((c) => c.channel === 'email')
    expect(email).toMatchObject({ total: 3, sent: 2, skipped: 1 })
    const whatsapp = res.body.channels.find((c) => c.channel === 'whatsapp')
    expect(whatsapp).toMatchObject({ total: 1, failed: 1 })

    expect(res.body.steps).toHaveLength(2)
    expect(res.body.steps[0]).toMatchObject({ step_index: 0, delay_hours: 0, total: 3 })
    expect(res.body.steps[1]).toMatchObject({ step_index: 1, delay_hours: 24, failed: 1 })

    // Enrollment rows sorted newest-first, contact names resolved.
    expect(res.body.enrollments.map((e) => e.contact_name)).toEqual(['carol@example.com', 'Bob', 'Alice'])
  })

  it('excludes replies dated before the enrollment start', async () => {
    seed({
      campaigns: [{ id: 'camp-1', name: 'C', target_channel: 'email', steps: [] }],
      campaign_enrollments: [
        { id: 'e1', campaign_id: 'camp-1', contact_id: 'c1', status: 'active', started_at: '2026-02-01T00:00:00Z' },
      ],
      campaign_messages: [],
      contacts: [{ id: 'c1', name: 'Old Replier' }],
      conversations: [{ id: 'conv1', contact_id: 'c1' }],
      conversation_messages: [
        { id: 'im1', conversation_id: 'conv1', direction: 'inbound', sent_at: '2026-01-01T00:00:00Z' },
      ],
      opportunities: [],
    })
    const app = await createApp()
    const res = await request(app).get('/api/campaigns/camp-1/stats')
    expect(res.status).toBe(200)
    expect(res.body.totals.replied).toBe(0)
  })
})
