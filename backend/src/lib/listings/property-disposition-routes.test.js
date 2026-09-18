import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  properties: [],
  property_disposition_cases: [],
  tenant_memberships: [],
  tenants: [],
  agency_members: [],
  agents: [],
}))

vi.mock('../../db.js', () => ({
  findAll: vi.fn(async (collection, predicate) => store[collection].filter(predicate)),
  findOne: vi.fn(async (collection, predicate) => store[collection].find(predicate) ?? null),
  update: vi.fn(async (collection, predicate, updater) => {
    store[collection] = store[collection].map((row) => (predicate(row) ? updater(row) : row))
    return true
  }),
}))

import { registerRoutes } from './property-disposition-routes.js'

function authMiddleware(req, res, next) {
  const id = req.get('x-user-id')
  if (!id) return res.status(401).json({ error: 'Unauthorized' })
  req.user = { id }
  return next()
}

function createApp() {
  const app = express()
  app.use(express.json())
  registerRoutes(app, { authMiddleware })
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }))
  return app
}

function seed() {
  store.properties = [{
    id: 'prop-1',
    title: 'Marina apartment',
    reference: 'WC-100',
    status: 'active',
    price: 850000,
    price_unit: 'USD',
    city: 'Dubai',
    neighborhood: 'Marina',
    agent_id: 'agent-1',
    agent_name: 'Rania Agent',
    agency_id: 'agency-1',
    agency_name: 'Compass Realty',
    source_user_id: 'user-agent',
    tenant_id: 'tenant-agency',
    custody_tenant_id: 'tenant-agency',
    ownership_type: 'agency',
    exit_disposition: 'case_review',
    photos: ['https://cdn.example/property.jpg'],
  }]
  store.property_disposition_cases = [{
    id: 'case-1',
    property_id: 'prop-1',
    membership_id: 'membership-agent',
    agency_tenant_id: 'tenant-agency',
    personal_tenant_id: 'tenant-personal',
    proposed_disposition: 'agency_retains',
    agency_decision: null,
    agent_decision: null,
    agency_proposed_disposition: null,
    agent_proposed_disposition: null,
    agency_notes: null,
    agent_notes: null,
    status: 'pending',
    initiated_by: 'user-admin',
    created_at: '2026-09-18T10:00:00.000Z',
    updated_at: '2026-09-18T10:00:00.000Z',
  }]
  store.tenant_memberships = [
    {
      id: 'membership-agent',
      tenant_id: 'tenant-agency',
      user_id: 'user-agent',
      role: 'member',
      status: 'ended',
    },
    {
      id: 'membership-admin',
      tenant_id: 'tenant-agency',
      user_id: 'user-admin',
      role: 'admin',
      status: 'active',
    },
  ]
  store.tenants = [
    { id: 'tenant-agency', agency_id: 'agency-1', name: 'Compass Realty' },
    { id: 'tenant-personal', personal_owner_user_id: 'user-agent', name: 'Rania workspace' },
  ]
  store.agency_members = []
  store.agents = [{ id: 'agent-1', user_id: 'user-agent', name: 'Rania Agent' }]
}

describe('property disposition routes', () => {
  beforeEach(seed)

  it('returns the case to the departing agent', async () => {
    const response = await request(createApp())
      .get('/api/properties/prop-1/disposition-case')
      .set('x-user-id', 'user-agent')

    expect(response.status).toBe(200)
    expect(response.body.viewer_role).toBe('agent')
    expect(response.body.parties).toEqual({ agency: 'Compass Realty', agent: 'Rania Agent' })
    expect(response.body.property.reference).toBe('WC-100')
  })

  it('returns the case to an agency admin', async () => {
    const response = await request(createApp())
      .get('/api/properties/prop-1/disposition-case')
      .set('x-user-id', 'user-admin')

    expect(response.status).toBe(200)
    expect(response.body.viewer_role).toBe('agency')
  })

  it('returns a leak-safe 404 to an unrelated user', async () => {
    const response = await request(createApp())
      .get('/api/properties/prop-1/disposition-case')
      .set('x-user-id', 'outsider')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Disposition case not found' })
  })

  it('strictly validates a decision body', async () => {
    const response = await request(createApp())
      .patch('/api/properties/prop-1/disposition-case/decision')
      .set('x-user-id', 'user-agent')
      .send({ disposition: 'agent_retains', unexpected: true })

    expect(response.status).toBe(400)
    expect(store.property_disposition_cases[0].agent_proposed_disposition).toBeNull()
  })

  it('keeps a one-sided recommendation pending', async () => {
    const response = await request(createApp())
      .patch('/api/properties/prop-1/disposition-case/decision')
      .set('x-user-id', 'user-agent')
      .send({ disposition: 'agent_retains', notes: 'I brought this mandate.' })

    expect(response.status).toBe(200)
    expect(response.body.case.status).toBe('pending')
    expect(response.body.case.agent_proposed_disposition).toBe('agent_retains')
    expect(response.body.case.agent_notes).toBe('I brought this mandate.')
  })

  it('marks conflicting recommendations disputed', async () => {
    store.property_disposition_cases[0].agent_proposed_disposition = 'agent_retains'
    const response = await request(createApp())
      .patch('/api/properties/prop-1/disposition-case/decision')
      .set('x-user-id', 'user-admin')
      .send({ disposition: 'agency_retains' })

    expect(response.status).toBe(200)
    expect(response.body.case.status).toBe('disputed')
    expect(response.body.can_resolve).toBe(false)
  })

  it('resolves matching recommendations and transfers custody', async () => {
    store.property_disposition_cases[0].agent_proposed_disposition = 'agent_retains'
    const agreed = await request(createApp())
      .patch('/api/properties/prop-1/disposition-case/decision')
      .set('x-user-id', 'user-admin')
      .send({ disposition: 'agent_retains', notes: null })

    expect(agreed.status).toBe(200)
    expect(agreed.body.case.status).toBe('agreed')
    expect(agreed.body.can_resolve).toBe(true)

    const resolved = await request(createApp())
      .post('/api/properties/prop-1/disposition-case/resolve')
      .set('x-user-id', 'user-agent')
      .send({})

    expect(resolved.status).toBe(200)
    expect(resolved.body.case.status).toBe('completed')
    expect(store.properties[0]).toMatchObject({
      tenant_id: 'tenant-personal',
      custody_tenant_id: 'tenant-personal',
      ownership_type: 'personal',
      agency_id: null,
      exit_disposition: 'agent_retains',
    })
  })

  it('refuses resolution before both parties agree', async () => {
    const response = await request(createApp())
      .post('/api/properties/prop-1/disposition-case/resolve')
      .set('x-user-id', 'user-agent')
      .send({})

    expect(response.status).toBe(409)
    expect(response.body.code).toBe('NOT_AGREED')
    expect(store.property_disposition_cases[0].status).toBe('pending')
  })
})
