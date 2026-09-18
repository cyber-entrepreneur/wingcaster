/**
 * AGT-HTX-003 closed-transaction import route tests.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
}))
const closedTx = vi.hoisted(() => ({
  importClosedTransactionsCsv: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../closed-transactions.js', () => closedTx)

let registerRoutes

async function createApp(userId = 'agent-1') {
  const app = express()
  app.use(express.json())
  const logActivity = vi.fn()
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: userId }
      next()
    },
    logActivity,
  })
  return { app, logActivity }
}

const SAMPLE_CSV = [
  'listing_id,final_sold_price,closed_at',
  'lst-1,475000,2023-04-02',
].join('\n')

beforeEach(async () => {
  vi.resetModules()
  db.findOne.mockReset().mockResolvedValue({ id: 'agent-1', agency_id: 'agn-1' })
  closedTx.importClosedTransactionsCsv.mockReset().mockResolvedValue({
    imported: 1,
    skipped: 0,
    errors: [],
    import_id: 'imp-1',
  })
  ;({ registerRoutes } = await import('./import-routes.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('POST /api/closed-transactions/import', () => {
  it('imports CSV with strict validation', async () => {
    const { app, logActivity } = await createApp()
    const res = await request(app)
      .post('/api/closed-transactions/import')
      .send({ csv_text: SAMPLE_CSV, filename: 'history.csv' })
    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(1)
    expect(closedTx.importClosedTransactionsCsv).toHaveBeenCalledWith({
      csvText: SAMPLE_CSV,
      agentId: 'agent-1',
      agencyId: 'agn-1',
      columnMap: undefined,
      filename: 'history.csv',
    })
    expect(logActivity).toHaveBeenCalled()
  })

  it('rejects unknown fields (strict zod)', async () => {
    const { app } = await createApp()
    const res = await request(app)
      .post('/api/closed-transactions/import')
      .send({ csv_text: SAMPLE_CSV, extra: true })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid import payload/i)
  })

  it('returns preview when preview_only is true', async () => {
    const { app } = await createApp()
    const res = await request(app)
      .post('/api/closed-transactions/import')
      .send({ csv_text: SAMPLE_CSV, preview_only: true })
    expect(res.status).toBe(200)
    expect(res.body.row_count).toBe(1)
    expect(res.body.preview).toHaveLength(1)
    expect(closedTx.importClosedTransactionsCsv).not.toHaveBeenCalled()
  })

  it('passes column_map through to importer', async () => {
    const { app } = await createApp()
    const column_map = { final_sold_price: 'Sold For', closed_at: 'Close Date' }
    await request(app)
      .post('/api/closed-transactions/import')
      .send({ csv_text: SAMPLE_CSV, column_map })
    expect(closedTx.importClosedTransactionsCsv).toHaveBeenCalledWith(
      expect.objectContaining({ columnMap: column_map }),
    )
  })

  it('rejects missing csv_text', async () => {
    const { app } = await createApp()
    const res = await request(app).post('/api/closed-transactions/import').send({})
    expect(res.status).toBe(400)
  })
})
