/**
 * AGT-HTX-003 closed-transaction import route tests.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ findOne: vi.fn() }))
const importer = vi.hoisted(() => ({ importClosedTransactionsCsv: vi.fn() }))
const activity = vi.hoisted(() => ({ logActivity: vi.fn() }))

vi.mock('../../db.js', () => db)
vi.mock('../../closed-transactions.js', () => importer)

let registerRoutes

async function createApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: 'agent-1' }
    next()
  })
  registerRoutes(app, {
    authMiddleware: (_req, _res, next) => next(),
    logActivity: activity.logActivity,
  })
  return app
}

beforeEach(async () => {
  vi.resetModules()
  db.findOne.mockReset().mockResolvedValue({ id: 'agent-1', agency_id: 'agency-1' })
  importer.importClosedTransactionsCsv.mockReset().mockResolvedValue({ imported: 2, skipped: 0, errors: [] })
  activity.logActivity.mockReset()
  ;({ registerRoutes } = await import('./import-routes.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('POST /api/closed-transactions/import', () => {
  it('imports CSV with strict validation', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/closed-transactions/import')
      .send({ csv_text: 'listing_id,final_sold_price,closed_at\np-1,100000,2024-01-01' })
    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(2)
    expect(importer.importClosedTransactionsCsv).toHaveBeenCalled()
    expect(activity.logActivity).toHaveBeenCalled()
  })

  it('rejects unknown fields', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/closed-transactions/import')
      .send({ csv_text: 'a,b', extra: true })
    expect(res.status).toBe(400)
  })

  it('rejects missing csv_text', async () => {
    const app = await createApp()
    const res = await request(app).post('/api/closed-transactions/import').send({})
    expect(res.status).toBe(400)
  })
})
