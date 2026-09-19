/**
 * AGT-CTC-004 merge route tests.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const orchestrator = vi.hoisted(() => ({
  mergeContacts: vi.fn(),
}))
const authz = vi.hoisted(() => ({
  assertOwnsContact: vi.fn(),
  NotFoundError: class NotFoundError extends Error {
    constructor() {
      super('nf')
      this.name = 'NotFoundError'
      this.status = 404
    }
  },
}))
const activity = vi.hoisted(() => ({
  logActivity: vi.fn(),
}))

vi.mock('../../conversations/orchestrator.js', () => orchestrator)
vi.mock('../authz.js', () => authz)
vi.mock('../activity-log.js', () => activity)

let registerRoutes

async function createApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: 'agent-1' }
    next()
  })
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => next(),
    logActivity: activity.logActivity,
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  orchestrator.mergeContacts.mockReset()
  authz.assertOwnsContact.mockReset()
  activity.logActivity.mockReset()
  authz.assertOwnsContact.mockImplementation(async (_userId, id) => ({ id, name: `Contact ${id}` }))
  orchestrator.mergeContacts.mockResolvedValue({ id: 'cnt_a', name: 'Merged' })
  ;({ registerRoutes } = await import('./merge-routes.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('POST /api/contacts/:id/merge', () => {
  it('merges with field selections (200)', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/contacts/cnt_a/merge')
      .send({
        target_contact_id: 'cnt_b',
        field_selections: { name: 'target', email: 'source' },
      })
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('cnt_a')
    expect(orchestrator.mergeContacts).toHaveBeenCalledWith('cnt_a', 'cnt_b', {
      name: 'target',
      email: 'source',
    })
    expect(activity.logActivity).toHaveBeenCalled()
  })

  it('rejects merge into self', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/contacts/cnt_a/merge')
      .send({ target_contact_id: 'cnt_a' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('SAME_CONTACT')
  })

  it('rejects unknown body fields (strict)', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/contacts/cnt_a/merge')
      .send({ target_contact_id: 'cnt_b', extra: true })
    expect(res.status).toBe(400)
  })

  it('returns 404 when target is not owned (leak-safe)', async () => {
    authz.assertOwnsContact.mockImplementation(async (_userId, id) => {
      if (id === 'cnt_missing') throw new authz.NotFoundError()
      return { id }
    })
    const app = await createApp()
    const res = await request(app)
      .post('/api/contacts/cnt_a/merge')
      .send({ target_contact_id: 'cnt_missing' })
    expect(res.status).toBe(404)
  })
})
