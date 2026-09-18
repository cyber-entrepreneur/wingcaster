import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

const templates = vi.hoisted(() => ({
  listAgencyMessageTemplates: vi.fn(),
  getAgencyMessageTemplate: vi.fn(),
  createAgencyMessageTemplate: vi.fn(),
  publishAgencyMessageTemplate: vi.fn(),
}))

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
}))

vi.mock('../../tenant-authorization.js', () => tenantAuth)
vi.mock('../../db.js', () => db)
vi.mock('./agency-message-templates.js', () => templates)

let registerAgencyMessageTemplateRoutes

async function createApp(userId = 'usr_owner') {
  const app = express()
  app.use(express.json())
  registerAgencyMessageTemplateRoutes(app, {
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
  templates.listAgencyMessageTemplates.mockReset()
  templates.getAgencyMessageTemplate.mockReset()
  templates.createAgencyMessageTemplate.mockReset()
  templates.publishAgencyMessageTemplate.mockReset()
  db.findOne.mockReset()

  tenantAuth.listUserAgencyMemberships.mockImplementation(async (userId) => {
    if (userId === 'usr_owner') {
      return [{ agency_id: 'agc_1', tenant_id: 'agency:agc_1', role: 'owner', affiliation_mode: 'exclusive' }]
    }
    return [{ agency_id: 'agc_1', tenant_id: 'agency:agc_1', role: 'member', affiliation_mode: 'exclusive' }]
  })
  db.findOne.mockResolvedValue({ id: 'agc_1', name: 'Test Agency' })
  templates.listAgencyMessageTemplates.mockResolvedValue([])
  templates.createAgencyMessageTemplate.mockResolvedValue({ id: 'tpl_1', name: 'Welcome' })
  templates.publishAgencyMessageTemplate.mockResolvedValue({ id: 'tpl_1', approval_status: 'approved' })

  ;({ registerAgencyMessageTemplateRoutes } = await import('./agency-message-templates-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('agency message template routes', () => {
  it('lists templates for agency admins', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/templates')
    expect(res.status).toBe(200)
    expect(templates.listAgencyMessageTemplates).toHaveBeenCalledWith('agc_1', {})
  })

  it('rejects non-admin members', async () => {
    const app = await createApp('usr_member')
    const res = await request(app).get('/api/agency/templates')
    expect(res.status).toBe(403)
  })

  it('validates create payload', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/agency/templates').send({ name: '' })
    expect(res.status).toBe(400)
    expect(templates.createAgencyMessageTemplate).not.toHaveBeenCalled()
  })

  it('creates a template', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/agency/templates').send({
      name: 'Follow-up',
      channel: 'whatsapp',
      body: 'Hi {{client_name}}',
    })
    expect(res.status).toBe(201)
    expect(templates.createAgencyMessageTemplate).toHaveBeenCalled()
  })

  it('publishes a template', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/agency/templates/tpl_1/publish')
    expect(res.status).toBe(200)
    expect(templates.publishAgencyMessageTemplate).toHaveBeenCalledWith('agc_1', 'tpl_1')
  })
})
