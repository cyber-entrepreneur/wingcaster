import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerRoutes } from './jobs-routes.js'
import { substitutePlaceholders, templateCodeForAggregate } from './notify-job-completed.js'

const originalSecret = process.env.JWT_SECRET

beforeEach(() => {
  process.env.JWT_SECRET = 'publishing-jobs-test-secret'
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

describe('GET/POST /api/publishing/jobs — auth', () => {
  it('unauthenticated GET → 401', async () => {
    const { authMiddleware } = await import('../../auth.js')
    const app = express()
    registerRoutes(app, { authMiddleware })
    const res = await request(app).get('/api/publishing/jobs/job-1')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })

  it('unauthenticated retry → 401', async () => {
    const { authMiddleware } = await import('../../auth.js')
    const app = express()
    app.use(express.json())
    registerRoutes(app, { authMiddleware })
    const res = await request(app)
      .post('/api/publishing/jobs/job-1/destinations/dest-1/retry')
    expect(res.status).toBe(401)
  })

  it('unauthenticated retry-all → 401', async () => {
    const { authMiddleware } = await import('../../auth.js')
    const app = express()
    app.use(express.json())
    registerRoutes(app, { authMiddleware })
    const res = await request(app)
      .post('/api/publishing/jobs/job-1/retry-all')
      .send({ error_classes_to_retry: ['PORTAL_DOWN'] })
    expect(res.status).toBe(401)
  })

  it('registerRoutes throws without authMiddleware', () => {
    expect(() => registerRoutes(express())).toThrow(/authMiddleware/)
  })
})

describe('notify helper copy', () => {
  it('resolves variant template codes and substitutes {N} {M}', () => {
    expect(templateCodeForAggregate('mixed')).toBe('publishing_job.completed.mixed')
    expect(substitutePlaceholders('Published to {N} of {M} channels', { N: 2, M: 5 }))
      .toBe('Published to 2 of 5 channels')
    expect(substitutePlaceholders('receipt {{jobId}}', { jobId: 'abc' }))
      .toBe('receipt abc')
  })
})
