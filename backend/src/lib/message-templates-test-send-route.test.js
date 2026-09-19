import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  message_templates: [],
}))

const emailMock = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ provider: 'graph', provider_message_id: 'msg-1' })),
}))

vi.mock('../db.js', () => ({
  findAll: vi.fn(async (collection, predicate) => store[collection].filter(predicate)),
  findOne: vi.fn(async (collection, predicate) => store[collection].find(predicate) ?? null),
  insert: vi.fn(async (_c, item) => item),
  update: vi.fn(async () => true),
  remove: vi.fn(async () => true),
}))

vi.mock('./notifications/email.js', () => emailMock)

import { validate } from './validation.js'
import { registerMessageTemplateTestSendRoute } from './message-templates-test-send-route.js'

function authMiddleware(req, res, next) {
  const id = req.get('x-user-id')
  const email = req.get('x-user-email')
  if (!id) return res.status(401).json({ error: 'Unauthorized' })
  req.user = { id, email: email || 'agent@example.test' }
  return next()
}

function buildApp() {
  const app = express()
  app.use(express.json())
  registerMessageTemplateTestSendRoute(app, { authMiddleware, validate, logActivity: vi.fn() })
  return app
}

describe('POST /api/message-templates/:id/test-send', () => {
  beforeEach(() => {
    store.message_templates = [{
      id: 'tpl-1',
      name: 'Welcome',
      channel: 'email',
      category: 'greeting',
      subject: 'Hello {{client_name}}',
      body: 'Hi {{client_name}}, welcome!',
      variables: ['client_name'],
      language: 'en',
      approval_status: 'draft',
      owner_type: 'agent',
      owner_id: 'user-1',
      is_default: false,
      usage_count: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }]
    emailMock.sendEmail.mockClear()
    emailMock.sendEmail.mockResolvedValue({ provider: 'graph', provider_message_id: 'msg-1' })
  })

  it('requires auth', async () => {
    const res = await request(buildApp()).post('/api/message-templates/tpl-1/test-send').send({ to: 'agent@example.test' })
    expect(res.status).toBe(401)
  })

  it('refuses sends to addresses other than the caller', async () => {
    const res = await request(buildApp())
      .post('/api/message-templates/tpl-1/test-send')
      .set('x-user-id', 'user-1')
      .set('x-user-email', 'agent@example.test')
      .send({ to: 'other@example.com', variables: {} })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('TEST_SEND_SELF_ONLY')
    expect(emailMock.sendEmail).not.toHaveBeenCalled()
  })

  it('sends email to the caller with a [TEST] subject prefix', async () => {
    const res = await request(buildApp())
      .post('/api/message-templates/tpl-1/test-send')
      .set('x-user-id', 'user-1')
      .set('x-user-email', 'agent@example.test')
      .send({ to: 'agent@example.test', variables: { client_name: 'Sam' } })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ sent: true, provider: 'graph', provider_message_id: 'msg-1' })
    expect(emailMock.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'agent@example.test',
      subject: '[TEST] Hello Sam',
      body: 'Hi Sam, welcome!',
    }))
  })

  it('rejects non-email channels', async () => {
    store.message_templates[0].channel = 'whatsapp'
    const res = await request(buildApp())
      .post('/api/message-templates/tpl-1/test-send')
      .set('x-user-id', 'user-1')
      .set('x-user-email', 'agent@example.test')
      .send({ to: 'agent@example.test', variables: {} })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('TEST_SEND_UNSUPPORTED_CHANNEL')
  })

  it('returns 404 for missing templates', async () => {
    const res = await request(buildApp())
      .post('/api/message-templates/missing/test-send')
      .set('x-user-id', 'user-1')
      .set('x-user-email', 'agent@example.test')
      .send({ to: 'agent@example.test', variables: {} })
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('TEMPLATE_NOT_FOUND')
  })
})
