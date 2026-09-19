/**
 * AGT-WLA-004 — WhatsApp intake settings route tests.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
  update: vi.fn(),
  findAll: vi.fn(),
}))
const moduleDb = vi.hoisted(() => ({
  findAllModule: vi.fn(),
  findOneModule: vi.fn(),
  updateModule: vi.fn(),
}))
const entitlements = vi.hoisted(() => ({
  getConfig: vi.fn(),
  checkMonthlyQuota: vi.fn(),
}))

vi.mock('../../../auth.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: 'agent-1' }
    next()
  },
}))
vi.mock('../../../db.js', () => db)
vi.mock('../infrastructure/db.js', () => ({
  Collections: { DRAFTS: 'wa_drafts', SESSIONS: 'wa_sessions' },
  findAllModule: moduleDb.findAllModule,
  findOneModule: moduleDb.findOneModule,
  updateModule: moduleDb.updateModule,
}))

let registerAgentRoutes

const baseAgent = {
  id: 'agent-1',
  agency_id: 'agency-1',
  whatsapp_intake_enabled: true,
  whatsapp_intake_notification_cadence: 'immediately',
  whatsapp_intake_auto_approve_high_confidence: false,
}

const entitlement = {
  auto_publish_social: false,
  ai_providers_allowed: ['gemini'],
  thumbnail_variants: ['modern'],
}

async function createApp() {
  const app = express()
  app.use(express.json())
  registerAgentRoutes(app, {
    entitlements,
    credits: {},
    pipeline: {},
    config: { aiProvider: 'gemini' },
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(db)) fn.mockReset?.()
  for (const fn of Object.values(moduleDb)) fn.mockReset?.()
  entitlements.getConfig.mockReset().mockResolvedValue(entitlement)
  db.findOne.mockReset()
  db.update.mockReset().mockImplementation(async (_col, _pred, fn) => fn({ ...baseAgent }))
  ;({ registerAgentRoutes } = await import('./agent-routes.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('GET /api/agent/whatsapp-listings/settings', () => {
  it('returns intake preferences with defaults', async () => {
    db.findOne.mockResolvedValue(baseAgent)
    const app = await createApp()
    const res = await request(app).get('/api/agent/whatsapp-listings/settings')
    expect(res.status).toBe(200)
    expect(res.body.intake_enabled).toBe(true)
    expect(res.body.notification_cadence).toBe('immediately')
    expect(res.body.auto_approve_high_confidence).toBe(false)
  })

  it('returns 404 when agent row is missing (leak-safe)', async () => {
    db.findOne.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app).get('/api/agent/whatsapp-listings/settings')
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/agent/whatsapp-listings/settings', () => {
  it('updates intake settings and returns serialized row', async () => {
    db.findOne
      .mockResolvedValueOnce(baseAgent)
      .mockResolvedValueOnce({
        ...baseAgent,
        whatsapp_intake_enabled: false,
        whatsapp_intake_notification_cadence: 'hourly',
        whatsapp_intake_auto_approve_high_confidence: true,
      })
    const app = await createApp()
    const res = await request(app)
      .patch('/api/agent/whatsapp-listings/settings')
      .send({
        whatsapp_intake_enabled: false,
        whatsapp_intake_notification_cadence: 'hourly',
        whatsapp_intake_auto_approve_high_confidence: true,
      })
    expect(res.status).toBe(200)
    expect(res.body.intake_enabled).toBe(false)
    expect(res.body.notification_cadence).toBe('hourly')
    expect(res.body.auto_approve_high_confidence).toBe(true)
    expect(db.update).toHaveBeenCalled()
  })

  it('rejects unknown fields via strict schema', async () => {
    db.findOne.mockResolvedValue(baseAgent)
    const app = await createApp()
    const res = await request(app)
      .patch('/api/agent/whatsapp-listings/settings')
      .send({ hacker_field: true })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed')
  })

  it('rejects invalid notification cadence', async () => {
    db.findOne.mockResolvedValue(baseAgent)
    const app = await createApp()
    const res = await request(app)
      .patch('/api/agent/whatsapp-listings/settings')
      .send({ whatsapp_intake_notification_cadence: 'weekly' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when agent row is missing', async () => {
    db.findOne.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app)
      .patch('/api/agent/whatsapp-listings/settings')
      .send({ whatsapp_intake_enabled: false })
    expect(res.status).toBe(404)
  })
})
