/**
 * Contact insight endpoints — pure builders + tenant-gated routes (AGT-CTC card).
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from '../authz.js'
import { registerRoutes, buildInterestedListings, buildEngagement } from './insights-routes.js'

const OLD = '2026-01-01T00:00:00.000Z'
const NEW = '2026-06-01T00:00:00.000Z'

describe('buildInterestedListings', () => {
  it('merges inquiries + viewings per property, newest first, with state', () => {
    const listings = buildInterestedListings({
      inquiries: [
        { property_id: 'p1', status: 'new', stage: 'qualification', created_at: OLD },
        { property_id: 'p2', status: 'new', created_at: NEW },
      ],
      viewings: [
        { property_id: 'p1', status: 'scheduled', outcome: null, scheduled_at: NEW },
      ],
      properties: [
        { id: 'p1', title: 'Marina flat', address_display: 'Dubai Marina', price: 1200000, currency: 'AED', status: 'live' },
      ],
    })
    expect(listings).toHaveLength(2)
    // p1 has the newer viewing → sorts first.
    expect(listings[0].property_id).toBe('p1')
    expect(listings[0]).toMatchObject({ title: 'Marina flat', inquiry_status: 'qualification', viewing_status: 'scheduled' })
    // p2 has no property row → nulls, but still listed from the inquiry.
    expect(listings[1]).toMatchObject({ property_id: 'p2', title: null, inquiry_status: 'new' })
  })
})

describe('buildEngagement', () => {
  it('computes last contact per channel and the latest deal', () => {
    const e = buildEngagement({
      conversations: [
        { source_channel: 'whatsapp', last_message_at: OLD },
        { source_channel: 'whatsapp', last_message_at: NEW },
        { source_channel: 'email', last_message_at: OLD },
      ],
      opportunities: [
        { id: 'd1', stage: 'new', created_at: OLD, updated_at: OLD },
        { id: 'd2', stage: 'negotiation', created_at: OLD, updated_at: NEW },
      ],
    })
    expect(e.last_by_channel.whatsapp).toBe(NEW)
    expect(e.last_by_channel.email).toBe(OLD)
    expect(e.last_contact_at).toBe(NEW)
    expect(e.last_deal).toMatchObject({ id: 'd2', stage: 'negotiation' })
    expect(e.channels.sort()).toEqual(['email', 'whatsapp'])
  })

  it('returns null deal when there are none', () => {
    expect(buildEngagement({ conversations: [], opportunities: [] }).last_deal).toBeNull()
  })
})

let contacts
let data

function createApp(userId) {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => { req.user = { id: userId }; next() },
    assertOwnsContact: async (agentId, id) => {
      const c = contacts.find((row) => row.id === id)
      if (!c || c.assigned_agent_id !== agentId) throw new NotFoundError()
      return c
    },
    findAll: async (coll, pred) => (data[coll] || []).filter(pred),
  })
  return app
}

beforeEach(() => {
  contacts = [
    { id: 'c-mine', assigned_agent_id: 'agent-1' },
    { id: 'c-theirs', assigned_agent_id: 'agent-2' },
  ]
  data = {
    inquiries: [{ id: 'i1', contact_id: 'c-mine', property_id: 'p1', status: 'new', created_at: NEW }],
    viewings: [{ id: 'v1', contact_id: 'c-mine', property_id: 'p1', status: 'scheduled', scheduled_at: NEW }],
    properties: [{ id: 'p1', title: 'Marina flat', price: 1200000, currency: 'AED', status: 'live' }],
    conversations: [{ id: 'cv1', contact_id: 'c-mine', source_channel: 'whatsapp', last_message_at: NEW }],
    opportunities: [{ id: 'd1', contact_id: 'c-mine', stage: 'offer', updated_at: NEW }],
  }
})
afterEach(() => vi.restoreAllMocks())

describe('GET /api/contacts/:id/interested-listings', () => {
  it('returns the owner\'s interested listings', async () => {
    const res = await request(createApp('agent-1')).get('/api/contacts/c-mine/interested-listings')
    expect(res.status).toBe(200)
    expect(res.body.listings).toHaveLength(1)
    expect(res.body.listings[0]).toMatchObject({ property_id: 'p1', title: 'Marina flat', viewing_status: 'scheduled' })
  })
  it('404s cross-tenant', async () => {
    const res = await request(createApp('agent-2')).get('/api/contacts/c-mine/interested-listings')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/contacts/:id/engagement', () => {
  it('returns engagement for the owner', async () => {
    const res = await request(createApp('agent-1')).get('/api/contacts/c-mine/engagement')
    expect(res.status).toBe(200)
    expect(res.body.last_by_channel.whatsapp).toBe(NEW)
    expect(res.body.last_deal).toMatchObject({ id: 'd1', stage: 'offer' })
  })
  it('404s cross-tenant', async () => {
    const res = await request(createApp('agent-2')).get('/api/contacts/c-mine/engagement')
    expect(res.status).toBe(404)
  })
})
