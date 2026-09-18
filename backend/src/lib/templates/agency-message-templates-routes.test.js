import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tenantAuth = vi.hoisted(() => ({
  listUserAgencyMemberships: vi.fn(),
}))

const templates = vi.hoisted(() => ({
  getAgencyMessageTemplate: vi.fn(),
  createAgencyMessageTemplate: vi.fn(),
  updateAgencyMessageTemplate: vi.fn(),
  deleteAgencyMessageTemplate: vi.fn(),
  publishAgencyMessageTemplate: vi.fn(),
  renderAgencyMessageTemplate: vi.fn(),
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
  Object.values(templates).forEach((fn) => fn.mockReset())
  db.findOne.mockReset()

  tenantAuth.listUserAgencyMemberships.mockImplementation(async (userId) => {
    if (userId === 'usr_owner') {
      return [{ agency_id: 'agc_1', tenant_id: 'agency:agc_1', role: 'owner', affiliation_mode: 'exclusive' }]
    }
    return [{ agency_id: 'agc_1', tenant_id: 'agency:agc_1', role: 'member', affiliation_mode: 'exclusive' }]
  })
  db.findOne.mockResolvedValue({ id: 'agc_1', name: 'Elite Realty' })
  templates.getAgencyMessageTemplate.mockResolvedValue({ id: 'tpl_1', name: 'Welcome' })
  templates.updateAgencyMessageTemplate.mockResolvedValue({ id: 'tpl_1', name: 'Updated' })
  templates.renderAgencyMessageTemplate.mockResolvedValue({ body: 'Hi Sara', subject: null, missing_variables: [] })

  ;({ registerAgencyMessageTemplateRoutes } = await import('./agency-message-templates-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('agency message template editor routes', () => {
  it('loads a template for agency admins', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/agency/templates/tpl_1')
    expect(res.status).toBe(200)
    expect(templates.getAgencyMessageTemplate).toHaveBeenCalledWith('agc_1', 'tpl_1')
  })

  it('rejects non-admin members', async () => {
    const app = await createApp('usr_member')
    const res = await request(app).get('/api/agency/templates/tpl_1')
    expect(res.status).toBe(403)
  })

  it('updates a template', async () => {
    const app = await createApp()
    const res = await request(app).put('/api/agency/templates/tpl_1').send({ name: 'Updated' })
    expect(res.status).toBe(200)
    expect(templates.updateAgencyMessageTemplate).toHaveBeenCalled()
  })

  it('renders a test preview', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/agency/templates/tpl_1/render').send({
      variables: { client_name: 'Sara' },
    })
    expect(res.status).toBe(200)
    expect(templates.renderAgencyMessageTemplate).toHaveBeenCalledWith('agc_1', 'tpl_1', { client_name: 'Sara' })
  })
})
