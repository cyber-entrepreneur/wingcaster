import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dal = vi.hoisted(() => ({
  findAll: vi.fn(async () => []),
  findOne: vi.fn(async () => null),
  insert: vi.fn(async (_c, item) => item),
  update: vi.fn(async () => 1),
  remove: vi.fn(async () => 1),
}))

const identity = vi.hoisted(() => ({
  findUserById: vi.fn(async () => ({
    id: 'user-1',
    email: 'agent@example.test',
    active_tenant_id: 'personal:user-1',
    data: {},
  })),
}))

const orchestrator = vi.hoisted(() => ({
  assignConversation: vi.fn(async (id) => ({ id })),
  archiveConversation: vi.fn(async (id) => ({ id, archived_at: 'now' })),
  markConversationReadByAgent: vi.fn(async (id) => ({ id, unread_count: 0 })),
  markConversationUnreadByAgent: vi.fn(async (id) => ({ id, unread_count: 1 })),
}))

const authz = vi.hoisted(() => ({
  assertOwnsConversation: vi.fn(async (_userId, id) => {
    if (id === 'forbidden') {
      const err = new Error('Forbidden')
      err.status = 403
      throw err
    }
    return {
      id,
      assigned_agent_id: 'user-1',
      contact_id: 'contact-1',
      contact_name: 'Sara',
    }
  }),
}))

vi.mock('../db.js', () => dal)
vi.mock('../identity.js', () => identity)
vi.mock('../tenant-authorization.js', () => ({
  personalTenantId: (userId) => `personal:${userId}`,
}))
vi.mock('./authz.js', () => authz)
vi.mock('../conversations/orchestrator.js', () => orchestrator)

import { registerInboxAgentRoutes } from './inbox-agent-routes.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  const authMiddleware = (req, _res, next) => {
    req.user = { id: 'user-1' }
    next()
  }
  registerInboxAgentRoutes(app, { authMiddleware })
  return app
}

describe('inbox-agent-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dal.findOne.mockImplementation(async (collection, filter) => {
      if (collection === 'tenant_memberships') {
        const row = {
          id: 'mem-1',
          user_id: 'user-1',
          tenant_id: 'personal:user-1',
          status: 'active',
          data: { inbox_merge_mode: 'separate' },
          updated_at: '2026-09-01T00:00:00.000Z',
        }
        return filter(row) ? row : null
      }
      if (collection === 'contacts') {
        const row = { id: 'contact-1', name: 'Sara Al-Mansoori' }
        return filter(row) ? row : null
      }
      return null
    })
    dal.findAll.mockResolvedValue([
      {
        id: 'm1',
        conversation_id: 'conv-1',
        direction: 'inbound',
        content: 'Is the 2BR still available?',
        created_at: '2026-09-08T08:12:00Z',
      },
    ])
  })

  it('GET /api/agent-preferences returns merge mode', async () => {
    const res = await request(buildApp()).get('/api/agent-preferences')
    expect(res.status).toBe(200)
    expect(res.body.inbox_merge_mode).toBe('separate')
  })

  it('PATCH /api/agent-preferences persists merge mode', async () => {
    const res = await request(buildApp())
      .patch('/api/agent-preferences')
      .send({ inbox_merge_mode: 'merged' })
    expect(res.status).toBe(200)
    expect(res.body.inbox_merge_mode).toBe('merged')
    expect(dal.update).toHaveBeenCalled()
  })

  it('POST /api/conversations/bulk mark_read updates owned rows and reports failures', async () => {
    const res = await request(buildApp())
      .post('/api/conversations/bulk')
      .send({ conversation_ids: ['conv-1', 'forbidden'], action: 'mark_read' })
    expect(res.status).toBe(200)
    expect(res.body.updated).toBe(1)
    expect(res.body.failed).toEqual([{ conversation_id: 'forbidden', error: 'PERMISSION_DENIED' }])
    expect(orchestrator.markConversationReadByAgent).toHaveBeenCalledWith('conv-1')
  })

  it('POST /api/conversations/:id/ai-suggestions returns heuristic drafts', async () => {
    const res = await request(buildApp()).post('/api/conversations/conv-1/ai-suggestions')
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(true)
    expect(res.body.suggestions.length).toBeGreaterThan(0)
    expect(res.body.suggestions[0]).toMatch(/available/i)
  })
})
