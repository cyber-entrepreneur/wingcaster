import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    return { id, assigned_agent_id: 'user-1', contact_id: 'contact-1', contact_name: 'Sara' }
  }),
}))

const anthropic = vi.hoisted(() => ({ create: vi.fn() }))
const usageLogger = vi.hoisted(() => ({ recordAiCall: vi.fn(async () => undefined) }))

vi.mock('../db.js', () => dal)
vi.mock('../../db.js', () => dal)
vi.mock('../identity.js', () => identity)
vi.mock('../tenant-authorization.js', () => ({ personalTenantId: (userId) => 'personal:' + userId }))
vi.mock('../../tenant-authorization.js', () => ({ personalTenantId: (userId) => 'personal:' + userId }))
vi.mock('./authz.js', () => authz)
vi.mock('../authz.js', () => authz)
vi.mock('../conversations/orchestrator.js', () => orchestrator)
vi.mock('./ai-usage-logger.js', () => usageLogger)
vi.mock('../ai-usage-logger.js', () => usageLogger)
vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    constructor() { this.messages = { create: anthropic.create } }
  },
}))

import { registerInboxAgentRoutes } from './inbox-agent-routes.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  registerInboxAgentRoutes(app, {
    authMiddleware: (req, _res, next) => { req.user = { id: 'user-1' }; next() },
  })
  return app
}

describe('inbox-agent-routes', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ANTHROPIC_API_KEY
    dal.findOne.mockImplementation(async (collection, filter) => {
      if (collection === 'tenant_memberships') {
        const row = { id: 'mem-1', user_id: 'user-1', tenant_id: 'personal:user-1', status: 'active', data: { inbox_merge_mode: 'separate' }, updated_at: '2026-09-01T00:00:00.000Z' }
        return filter(row) ? row : null
      }
      if (collection === 'contacts') {
        const row = { id: 'contact-1', name: 'Sara Al-Mansoori' }
        return filter(row) ? row : null
      }
      return null
    })
    dal.findAll.mockResolvedValue([
      { id: 'm1', conversation_id: 'conv-1', direction: 'inbound', content: 'Is the 2BR still available?', created_at: '2026-09-08T08:12:00Z' },
    ])
  })
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalKey
  })

  it('GET /api/agent-preferences returns merge mode', async () => {
    const res = await request(buildApp()).get('/api/agent-preferences')
    expect(res.status).toBe(200)
    expect(res.body.inbox_merge_mode).toBe('separate')
  })

  it('PATCH /api/agent-preferences persists merge mode', async () => {
    const res = await request(buildApp()).patch('/api/agent-preferences').send({ inbox_merge_mode: 'merged' })
    expect(res.status).toBe(200)
    expect(res.body.inbox_merge_mode).toBe('merged')
    expect(dal.update).toHaveBeenCalled()
  })

  it('POST /api/conversations/bulk mark_read updates owned rows and reports failures', async () => {
    const res = await request(buildApp()).post('/api/conversations/bulk').send({ conversation_ids: ['conv-1', 'forbidden'], action: 'mark_read' })
    expect(res.status).toBe(200)
    expect(res.body.updated).toBe(1)
    expect(res.body.failed).toEqual([{ conversation_id: 'forbidden', error: 'PERMISSION_DENIED' }])
  })

  it('POST /api/conversations/:id/ai-suggestions returns heuristic drafts when no API key', async () => {
    const res = await request(buildApp()).post('/api/conversations/conv-1/ai-suggestions')
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(true)
    expect(res.body.source).toBe('heuristic')
    expect(res.body.suggestions.length).toBeGreaterThan(0)
    expect(anthropic.create).not.toHaveBeenCalled()
  })

  it('POST /api/conversations/:id/ai-suggestions uses Anthropic and writes audit when keyed', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    anthropic.create.mockResolvedValue({
      model: 'claude-haiku-4-5-20251001',
      content: [{ type: 'text', text: '["Yes, still available.", "Happy to schedule a viewing.", "I can send photos."]' }],
      usage: { input_tokens: 40, output_tokens: 30 },
    })
    const res = await request(buildApp()).post('/api/conversations/conv-1/ai-suggestions')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('anthropic')
    expect(res.body.enabled).toBe(true)
    expect(res.body.suggestions).toHaveLength(3)
    expect(dal.insert).toHaveBeenCalledWith('audit_log', expect.objectContaining({
      type: 'inbox_ai_suggestion',
      action: 'generate',
      entity_type: 'conversation',
      entity_id: 'conv-1',
      metadata: expect.objectContaining({ source: 'anthropic', suggestion_count: 3 }),
    }))
    expect(usageLogger.recordAiCall).toHaveBeenCalled()
  })

  it('POST /api/conversations/:id/ai-suggestions falls back to heuristic when Anthropic fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    anthropic.create.mockRejectedValue(new Error('upstream down'))
    const res = await request(buildApp()).post('/api/conversations/conv-1/ai-suggestions')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('heuristic')
    expect(res.body.suggestions.length).toBeGreaterThan(0)
  })
})
