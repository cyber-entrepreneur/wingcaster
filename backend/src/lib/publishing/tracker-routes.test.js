/**
 * Fast gates for GET /api/publishing/tracker — no Postgres.
 * Real-Postgres coverage is in tracker-routes.postgres.test.js.
 */
import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import {
  mapDistributionStatusToTracker,
  parseTrackerQuery,
  toTrackerRow,
  toTrackerRows,
  TrackerQueryError,
} from './tracker.js'
import { registerRoutes } from './tracker-routes.js'

function createApp({ user = { id: 'user-1', agent_id: 'user-1' }, agent = { id: 'user-1', agency_id: null }, queryFn, auth } = {}) {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: auth || ((req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      req.user = user
      req.agent = agent
      next()
    }),
    query: queryFn || (async () => []),
  })
  return app
}

describe('registerRoutes', () => {
  it('throws when authMiddleware is missing', () => {
    expect(() => registerRoutes(express())).toThrow(/authMiddleware/)
  })
})

describe('GET /api/publishing/tracker validation', () => {
  it('returns 401 when unauthenticated', async () => {
    const app = createApp()
    const res = await request(app).get('/api/publishing/tracker')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Unauthorized/i)
  })

  it('rejects limit > 50', async () => {
    const app = createApp()
    const res = await request(app)
      .get('/api/publishing/tracker')
      .query({ limit: 51 })
      .set('Authorization', 'Bearer test')
    expect(res.status).toBe(400)
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'limit' })]),
    )
  })

  it('rejects a bad status token', async () => {
    const app = createApp()
    const res = await request(app)
      .get('/api/publishing/tracker')
      .query({ status: 'live,nope' })
      .set('Authorization', 'Bearer test')
    expect(res.status).toBe(400)
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'status' })]),
    )
  })

  it('rejects an invalid cursor', async () => {
    const app = createApp()
    const res = await request(app)
      .get('/api/publishing/tracker')
      .query({ after: 'not-base64-json' })
      .set('Authorization', 'Bearer test')
    expect(res.status).toBe(400)
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'after' })]),
    )
  })
})

describe('GET /api/publishing/tracker/summary validation', () => {
  it('returns 401 when unauthenticated', async () => {
    const app = createApp()
    const res = await request(app).get('/api/publishing/tracker/summary')
    expect(res.status).toBe(401)
  })

  it('rejects limit > 50 (same filter parser)', async () => {
    const app = createApp()
    const res = await request(app)
      .get('/api/publishing/tracker/summary')
      .query({ limit: 99 })
      .set('Authorization', 'Bearer test')
    expect(res.status).toBe(400)
  })
})

describe('mapDistributionStatusToTracker', () => {
  it('maps DB statuses onto the six tracker statuses', () => {
    expect(mapDistributionStatusToTracker('published')).toBe('live')
    expect(mapDistributionStatusToTracker('success')).toBe('live')
    expect(mapDistributionStatusToTracker('live')).toBe('live')
    expect(mapDistributionStatusToTracker('pending')).toBe('submitted')
    expect(mapDistributionStatusToTracker('submitted')).toBe('submitted')
    expect(mapDistributionStatusToTracker('in_review')).toBe('in_review')
    expect(mapDistributionStatusToTracker('pending_moderation')).toBe('in_review')
    expect(mapDistributionStatusToTracker('rejected')).toBe('rejected')
    expect(mapDistributionStatusToTracker('expired')).toBe('expired')
    expect(mapDistributionStatusToTracker('failed')).toBe('failed')
    expect(mapDistributionStatusToTracker('error')).toBe('failed')
  })
})

describe('parseTrackerQuery', () => {
  it('defaults limit 20 and submitted_at:desc', () => {
    const parsed = parseTrackerQuery({})
    expect(parsed.limit).toBe(20)
    expect(parsed.sort).toBe('submitted_at:desc')
  })

  it('throws TrackerQueryError for limit 51', () => {
    expect(() => parseTrackerQuery({ limit: 51 })).toThrow(TrackerQueryError)
  })
})

describe('toTrackerRows — no per-row queries', () => {
  it('does not call query inside rows.map', () => {
    expect(toTrackerRow.toString()).not.toMatch(/\bquery\s*\(/)
    expect(toTrackerRows.toString()).not.toMatch(/\bquery\s*\(/)
    const mapped = toTrackerRows([
      {
        distribution_attempt_id: 'a1',
        listing_id: 'p1',
        address_line: '12 Marina Walk',
        thumbnail_url: 'https://cdn.example/a.jpg',
        portal_code: 'bayut',
        portal_display_name: 'Bayut',
        channel_token_key: 'publishing.realestate.bayut',
        submitted_at: '2026-09-02T10:00:00.000Z',
        updated_at: '2026-09-02T11:00:00.000Z',
        tracker_status: 'failed',
        error_class: 'auth_expired',
        error_message: 'token expired',
        credits_charged: 100,
        portal_live_url: null,
      },
    ])
    expect(mapped).toHaveLength(1)
    expect(mapped[0].status).toBe('failed')
    expect(mapped[0].error_class).toBe('auth_expired')
    expect(mapped[0].listing).toEqual({
      id: 'p1',
      address_line: '12 Marina Walk',
      thumbnail_url: 'https://cdn.example/a.jpg',
    })
    expect(mapped[0].portal.code).toBe('bayut')
  })

  it('returns snake_case error_class matching the DB CHECK enum', () => {
    const row = toTrackerRow({
      distribution_attempt_id: 'a1',
      tracker_status: 'rejected',
      error_class: 'portal_rules_violation',
    })
    expect(row.error_class).toBe('portal_rules_violation')
    expect(row.error_class).not.toBe('portal-rules-violation')
  })
})
