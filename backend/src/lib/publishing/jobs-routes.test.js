import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerRoutes } from './jobs-routes.js'

const originalSecret = process.env.JWT_SECRET

beforeEach(() => {
  process.env.JWT_SECRET = 'publishing-jobs-test-secret'
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

function createApp({ user = { id: 'user-1', agent_id: 'agent-1' }, agent = { id: 'agent-1' }, loadJob, auth } = {}) {
  const app = express()
  app.use(express.json())
  registerRoutes(app, {
    authMiddleware: auth || ((req, _res, next) => {
      if (user) {
        req.user = user
        req.agent = agent
      }
      next()
    }),
    loadJob,
  })
  return app
}

const samplePayload = {
  job: {
    id: 'job-1',
    listing_id: 'prop-1',
    listing_short_ref: 'PROP0001',
    aggregate: 'mixed',
    submitted_at: '2026-09-08T00:00:00.000Z',
    completed_at: null,
    counts: { succeeded: 1, in_review: 0, failed: 2, total: 3 },
    credits: { total_charged: 10, total_reserved: 5 },
    agent_id: 'agent-1',
    agency_id: null,
    is_legacy: false,
  },
  destinations: [
    {
      id: 'dest-down',
      status: 'failed',
      error_class: 'PORTAL_DOWN',
      retry_available: true,
      portal: { code: 'olx', display_name: 'OLX', logo_url: null, country_code: 'EG', all_country_codes: ['EG', 'LB'] },
    },
    {
      id: 'dest-auth',
      status: 'failed',
      error_class: 'AUTH_EXPIRED',
      retry_available: false,
      portal: { code: 'bayut', display_name: 'Bayut', logo_url: null, country_code: 'AE', all_country_codes: ['AE', 'SA'] },
    },
  ],
}

describe('registerRoutes', () => {
  it('throws when authMiddleware is missing', () => {
    expect(() => registerRoutes(express())).toThrow(/authMiddleware/)
  })
})

describe('GET /api/publishing/jobs/:jobId', () => {
  it('unauthenticated → 401', async () => {
    const { authMiddleware } = await import('../../auth.js')
    const app = express()
    registerRoutes(app, { authMiddleware })
    const res = await request(app).get('/api/publishing/jobs/job-1')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })

  it('missing job for this user → 404 not 403 (leak-safe)', async () => {
    const res = await request(createApp({
      loadJob: async () => null,
    })).get('/api/publishing/jobs/someone-elses-job')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
    expect(res.status).not.toBe(403)
  })

  it('returns the aggregated job payload', async () => {
    const res = await request(createApp({
      loadJob: async () => ({ payload: samplePayload, statementCount: 1 }),
    })).get('/api/publishing/jobs/job-1')
    expect(res.status).toBe(200)
    expect(res.body.job).toMatchObject({
      id: 'job-1',
      aggregate: 'mixed',
      counts: { succeeded: 1, failed: 2, total: 3 },
    })
    expect(res.body.job.agent_id).toBeUndefined()
    expect(res.body.destinations).toHaveLength(2)
  })
})

describe('POST /api/publishing/jobs/:jobId/retry-all', () => {
  it('unauthenticated → 401', async () => {
    const { authMiddleware } = await import('../../auth.js')
    const app = express()
    app.use(express.json())
    registerRoutes(app, { authMiddleware })
    const res = await request(app)
      .post('/api/publishing/jobs/job-1/retry-all')
      .send({ error_classes_to_retry: ['PORTAL_DOWN'] })
    expect(res.status).toBe(401)
  })

  it('unknown job → 404 not 403', async () => {
    const res = await request(createApp({
      loadJob: async () => null,
    })).post('/api/publishing/jobs/missing/retry-all').send({})
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })
})
