import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const moduleDb = vi.hoisted(() => ({
  findAllModule: vi.fn(),
  findOneModule: vi.fn(),
  updateModule: vi.fn(),
}))

const coreDb = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../infrastructure/db.js', () => ({
  Collections: {
    DRAFTS: 'whatsapp_listing_drafts',
    SESSIONS: 'whatsapp_listing_sessions',
  },
  ...moduleDb,
}))

vi.mock('../../../db.js', () => coreDb)
vi.mock('../../../auth.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: 'agent-1' }
    next()
  },
}))

import { buildAgentAnalytics, registerAgentRoutes } from './agent-routes.js'

const entitlements = {
  checkMonthlyQuota: vi.fn().mockResolvedValue({ used: 4, max: 100 }),
  getConfig: vi.fn(),
}

function createApp() {
  const app = express()
  app.use(express.json())
  registerAgentRoutes(app, {
    entitlements,
    credits: {},
    pipeline: {},
    config: {},
  })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  entitlements.checkMonthlyQuota.mockResolvedValue({ used: 4, max: 100 })
  moduleDb.findAllModule.mockResolvedValue([])
  coreDb.findAll.mockResolvedValue([])
})

describe('buildAgentAnalytics', () => {
  it('aggregates activity, review time, AI cost, and correction-based field accuracy', () => {
    const result = buildAgentAnalytics({
      range: '7d',
      now: new Date('2026-09-18T15:00:00Z'),
      quota: { used: 2, max: 100 },
      drafts: [
        {
          id: 'd-1',
          status: 'published',
          created_at: '2026-09-17T10:00:00Z',
          updated_at: '2026-09-17T10:30:00Z',
          extracted_property: {
            title: 'Marina apartment',
            price: 480000,
          },
          original_extracted_property: { title: 'Marina apartment', price: 500000 },
        },
        {
          id: 'd-2',
          status: 'awaiting_approval',
          created_at: '2026-09-18T10:00:00Z',
          updated_at: '2026-09-18T10:05:00Z',
          extracted_property: { title: 'Townhouse', confidence: 0.8 },
        },
        {
          id: 'd-3',
          status: 'discarded',
          created_at: '2026-09-17T12:00:00Z',
          updated_at: '2026-09-17T12:10:00Z',
          extracted_property: { title: 'Discarded draft' },
          original_extracted_property: { title: 'Discarded draft' },
        },
        {
          id: 'old',
          status: 'published',
          created_at: '2026-08-01T10:00:00Z',
          updated_at: '2026-08-01T11:00:00Z',
          extracted_property: { title: 'Old listing', confidence: 1 },
        },
      ],
      usageRows: [
        { occurred_at: '2026-09-17T10:00:00Z', cost_estimate_micro_usd: 2500 },
        { occurred_at: '2026-08-01T10:00:00Z', cost_estimate_micro_usd: 9000 },
      ],
    })

    expect(result.summary).toEqual({
      total_drafts: 3,
      approved: 1,
      approval_rate: 50,
      avg_approval_minutes: 30,
      ai_cost_estimate_usd: 0.25,
    })
    expect(result.activity).toHaveLength(7)
    expect(result.activity.at(-1)).toEqual({
      date: '2026-09-18',
      drafts: 1,
      approved: 0,
    })
    expect(result.field_accuracy).toEqual(
      expect.arrayContaining([
        { field: 'title', label: 'Title', accuracy: 100, sample_size: 1, corrected_count: 0 },
        { field: 'price', label: 'Price', accuracy: 0, sample_size: 1, corrected_count: 1 },
      ]),
    )
    expect(result.field_accuracy_basis).toBe('accepted_without_correction')
  })

  it('returns a complete zero-state payload', () => {
    const result = buildAgentAnalytics({
      range: '30d',
      now: new Date('2026-09-18T15:00:00Z'),
      quota: { used: 0, max: 100 },
      drafts: [],
      usageRows: [],
    })

    expect(result.summary.total_drafts).toBe(0)
    expect(result.summary.avg_approval_minutes).toBeNull()
    expect(result.field_accuracy).toEqual([])
    expect(result.activity).toHaveLength(30)
  })
})

describe('GET /api/agent/whatsapp-listings/analytics', () => {
  it('scopes drafts and usage to the authenticated agent', async () => {
    const now = new Date()
    const earlier = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const drafts = [
      {
        id: 'mine',
        agent_id: 'agent-1',
        status: 'published',
        created_at: earlier,
        updated_at: now.toISOString(),
        extracted_property: { title: 'Mine', confidence: 0.9 },
        original_extracted_property: { title: 'Mine', confidence: 0.9 },
      },
      {
        id: 'theirs',
        agent_id: 'agent-2',
        status: 'published',
        created_at: earlier,
        updated_at: now.toISOString(),
        extracted_property: { title: 'Theirs', confidence: 1 },
        original_extracted_property: { title: 'Theirs', confidence: 1 },
      },
    ]
    const usage = [
      {
        tenant_id: 'agent-1',
        feature: 'whatsapp-listings',
        occurred_at: earlier,
        cost_estimate_micro_usd: 1000,
      },
      {
        tenant_id: 'agent-2',
        feature: 'whatsapp-listings',
        occurred_at: earlier,
        cost_estimate_micro_usd: 9000,
      },
    ]
    moduleDb.findAllModule.mockImplementation(async (_collection, predicate) =>
      drafts.filter(predicate),
    )
    coreDb.findAll.mockImplementation(async (_collection, predicate) => usage.filter(predicate))

    const response = await request(createApp()).get(
      '/api/agent/whatsapp-listings/analytics?range=7d',
    )

    expect(response.status).toBe(200)
    expect(response.body.summary.total_drafts).toBe(1)
    expect(response.body.summary.ai_cost_estimate_usd).toBe(0.1)
    expect(response.body.field_accuracy[0].sample_size).toBe(1)
  })

  it('rejects unknown filters through a strict schema', async () => {
    const response = await request(createApp()).get(
      '/api/agent/whatsapp-listings/analytics?range=7d&agent_id=agent-2',
    )

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Invalid analytics filters')
    expect(moduleDb.findAllModule).not.toHaveBeenCalled()
    expect(coreDb.findAll).not.toHaveBeenCalled()
  })
})
