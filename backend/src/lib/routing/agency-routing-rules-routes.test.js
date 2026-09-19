import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

const rules = vi.hoisted(() => ({
  listAgencyRoutingRules: vi.fn(),
  getAgencyRoutingRule: vi.fn(),
  createAgencyRoutingRule: vi.fn(),
  updateAgencyRoutingRule: vi.fn(),
  deleteAgencyRoutingRule: vi.fn(),
}))

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
}))

vi.mock('../../tenant-authorization.js', () => tenantAuth)
vi.mock('../../db.js', () => db)
vi.mock('./agency-routing-rules.js', () => ({
  ...rules,
  ROUTING_TRIGGERS: ['inquiry', 'comment', 'whatsapp_message'],
  ROUTING_STRATEGIES: ['round_robin', 'first_response', 'least_loaded', 'weighted', 'manual'],
  CONDITION_FIELDS: ['source', 'area', 'property_type', 'language', 'time_of_day'],
  CONDITION_OPS: ['eq', 'contains', 'gte', 'lte'],
}))

let registerAgencyRoutingRuleRoutes

async function createApp(userId = 'usr_owner') {
  const app = express()
  app.use(express.json())
  registerAgencyRoutingRuleRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  tenantAuth.listUserAgencyMemberships.mockReset()
  rules.listAgencyRoutingRules.mockReset()
  rules.getAgencyRoutingRule.mockReset()
  rules.createAgencyRoutingRule.mockReset()
  rules.updateAgencyRoutingRule.mockReset()
  rules.deleteAgencyRoutingRule.mockReset()
  db.findOne.mockReset()

  tenantAuth.listUserAgencyMemberships.mockImplementation(async (userId) => {
    if (userId === 'usr_owner') {
      return [{ agency_id: 'agc_1', tenant_id: 'agency:agc_1', role: 'owner', affiliation_mode: 'exclusive' }]
    }
    return [{ agency_id: 'agc_1', tenant_id: 'agency:agc_1', role: 'agent', affiliation_mode: 'exclusive' }]
  })
  db.findOne.mockResolvedValue({ id: 'agc_1', name: 'Test Agency' })
  rules.listAgencyRoutingRules.mockResolvedValue([])
  rules.createAgencyRoutingRule.mockResolvedValue({ id: 'rule_1', name: 'Test rule' })

  ;({ registerAgencyRoutingRuleRoutes } = await import('./agency-routing-rules-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('agency routing rule routes', () => {
  it('lists rules for agency admins', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/routing/rules')
    expect(res.status).toBe(200)
    expect(rules.listAgencyRoutingRules).toHaveBeenCalledWith('agc_1')
  })

  it('rejects non-admin members', async () => {
    const app = await createApp('usr_agent')
    const res = await request(app).get('/api/agency/routing/rules')
    expect(res.status).toBe(403)
  })

  it('validates create payload', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/agency/routing/rules').send({ name: '' })
    expect(res.status).toBe(400)
    expect(rules.createAgencyRoutingRule).not.toHaveBeenCalled()
  })

  it('creates a rule', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/agency/routing/rules').send({
      name: 'Portal leads',
      trigger: 'inquiry',
      strategy: 'round_robin',
      filters: { conditions: [{ field: 'source', op: 'eq', value: 'bayut' }] },
    })
    expect(res.status).toBe(201)
    expect(rules.createAgencyRoutingRule).toHaveBeenCalled()
  })
})
