/**
 * AGT-INB-004 assignable-agents route tests.
 *
 * Mocks the resolver + ownership guard: the happy path returns the resolved
 * teammates for an owned conversation; a conversation the caller does not own
 * returns a leak-safe 404 (and never calls the resolver).
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resolver = vi.hoisted(() => ({ getAssignableAgents: vi.fn() }))
const authz = vi.hoisted(() => ({
  assertOwnsConversation: vi.fn(),
  NotFoundError: class NotFoundError extends Error {
    constructor() {
      super('not found')
      this.name = 'NotFoundError'
      this.status = 404
    }
  },
}))

vi.mock('./assignable-agents.js', () => resolver)
vi.mock('../authz.js', () => authz)

let registerRoutes

function createApp(userId = 'agent-1') {
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
  resolver.getAssignableAgents.mockReset().mockResolvedValue([{ id: 'a-self', name: 'Me', is_self: true }])
  authz.assertOwnsConversation.mockReset().mockResolvedValue({ id: 'c1', assigned_agent_id: 'a-self' })
  ;({ registerRoutes } = await import('./assignable-agents-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('registerRoutes wiring', () => {
  it('throws without authMiddleware', () => {
    expect(() => registerRoutes(express(), {})).toThrow(/authMiddleware/)
  })
})

describe('GET /api/conversations/:id/assignable-agents', () => {
  it('returns the resolved teammates for an owned conversation', async () => {
    const app = createApp('agent-1')
    const res = await request(app).get('/api/conversations/c1/assignable-agents')
    expect(res.status).toBe(200)
    expect(res.body.agents).toEqual([{ id: 'a-self', name: 'Me', is_self: true }])
    expect(authz.assertOwnsConversation).toHaveBeenCalledWith('agent-1', 'c1')
    expect(resolver.getAssignableAgents).toHaveBeenCalledWith('agent-1', { id: 'c1', assigned_agent_id: 'a-self' })
  })

  it('404s (leak-safe) a conversation the caller does not own', async () => {
    authz.assertOwnsConversation.mockRejectedValue(new authz.NotFoundError())
    const app = createApp('intruder')
    const res = await request(app).get('/api/conversations/c1/assignable-agents')
    expect(res.status).toBe(404)
    expect(resolver.getAssignableAgents).not.toHaveBeenCalled()
  })
})
