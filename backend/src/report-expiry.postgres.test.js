/**
 * Real-Postgres coverage for BE-BLOCKER-24 + BE-BLOCKER-25:
 *   - comparable_reports / agent_price_reports.expires_at columns
 *   - pending past expires_at → expired
 *   - future expires_at untouched
 *   - shared worker processes both tables identically
 *   - tick is idempotent
 */
import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import {
  reportExpiresAt,
  runReportExpiryTick,
} from './workers/report-expiry-worker.js'

async function seedUser(pool, id = randomUUID()) {
  await pool.query(
    `INSERT INTO public.users (id, email, name, created_at, updated_at, data)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [id, `user-${id.slice(0, 8)}@example.test`, `User ${id.slice(0, 8)}`],
  )
  return id
}

async function seedComparableReport(pool, {
  status = 'pending',
  createdAt,
  expiresAt,
} = {}) {
  const id = randomUUID()
  const reporterId = await seedUser(pool)
  const created = createdAt || new Date().toISOString()
  const expires = expiresAt === undefined ? reportExpiresAt(created) : expiresAt
  await pool.query(
    `INSERT INTO market_pricing.comparable_reports
      (id, reporter_id, comparable_id, comparable_type, reason, status,
       created_at, updated_at, expires_at, data)
     VALUES ($1, $2, $3, 'external', 'fake_listing', $4,
             $5::timestamptz, $5::timestamptz, $6::timestamptz, '{}'::jsonb)`,
    [id, reporterId, `comp-${id.slice(0, 8)}`, status, created, expires],
  )
  return id
}

async function seedAgentPriceReport(pool, {
  status = 'pending',
  createdAt,
  expiresAt,
} = {}) {
  const id = randomUUID()
  const reporterId = await seedUser(pool)
  const created = createdAt || new Date().toISOString()
  const expires = expiresAt === undefined ? reportExpiresAt(created) : expiresAt
  await pool.query(
    `INSERT INTO market_pricing.agent_price_reports
      (id, reporter_id, sold_price, currency, status,
       created_at, updated_at, expires_at, data)
     VALUES ($1, $2, 250000, 'USD', $3,
             $4::timestamptz, $4::timestamptz, $5::timestamptz, '{}'::jsonb)`,
    [id, reporterId, status, created, expires],
  )
  return id
}

finPostgresSuite('report expiry worker (BE-BLOCKER-24/25)', { seed: false }, ({ pool }) => {
  it('migration adds expires_at on both report tables', async () => {
    for (const table of ['comparable_reports', 'agent_price_reports']) {
      const col = await pool().query(
        `SELECT column_name, data_type
           FROM information_schema.columns
          WHERE table_schema = 'market_pricing'
            AND table_name = $1
            AND column_name = 'expires_at'`,
        [table],
      )
      expect(col.rows[0]?.data_type).toBe('timestamp with time zone')
    }
  })

  it('tick expires due pending rows on both tables and leaves future rows untouched', async () => {
    const now = new Date('2026-06-15T12:00:00.000Z')
    const dueComparable = await seedComparableReport(pool(), {
      status: 'pending',
      createdAt: '2026-05-01T12:00:00.000Z',
      expiresAt: '2026-05-31T12:00:00.000Z',
    })
    const futureComparable = await seedComparableReport(pool(), {
      status: 'pending',
      createdAt: '2026-06-10T12:00:00.000Z',
      expiresAt: '2026-07-10T12:00:00.000Z',
    })
    const dueAgent = await seedAgentPriceReport(pool(), {
      status: 'pending',
      createdAt: '2026-05-01T12:00:00.000Z',
      expiresAt: '2026-05-31T12:00:00.000Z',
    })
    const futureAgent = await seedAgentPriceReport(pool(), {
      status: 'pending',
      createdAt: '2026-06-10T12:00:00.000Z',
      expiresAt: '2026-07-10T12:00:00.000Z',
    })

    const result = await runReportExpiryTick({ pool: pool(), now })
    expect(result.skipped).toBe(false)
    expect(result.expired).toBeGreaterThanOrEqual(2)
    expect(result.tables.comparable_reports.expired).toBeGreaterThanOrEqual(1)
    expect(result.tables.agent_price_reports.expired).toBeGreaterThanOrEqual(1)

    const dueC = await pool().query(
      `SELECT status FROM market_pricing.comparable_reports WHERE id = $1`,
      [dueComparable],
    )
    const futureC = await pool().query(
      `SELECT status FROM market_pricing.comparable_reports WHERE id = $1`,
      [futureComparable],
    )
    const dueA = await pool().query(
      `SELECT status FROM market_pricing.agent_price_reports WHERE id = $1`,
      [dueAgent],
    )
    const futureA = await pool().query(
      `SELECT status FROM market_pricing.agent_price_reports WHERE id = $1`,
      [futureAgent],
    )
    expect(dueC.rows[0].status).toBe('expired')
    expect(futureC.rows[0].status).toBe('pending')
    expect(dueA.rows[0].status).toBe('expired')
    expect(futureA.rows[0].status).toBe('pending')
  })

  it('tick is idempotent for already-expired rows', async () => {
    const now = new Date('2026-08-01T00:00:00.000Z')
    const comparableId = await seedComparableReport(pool(), {
      status: 'pending',
      createdAt: '2026-06-01T00:00:00.000Z',
      expiresAt: '2026-07-01T00:00:00.000Z',
    })
    const agentId = await seedAgentPriceReport(pool(), {
      status: 'pending',
      createdAt: '2026-06-01T00:00:00.000Z',
      expiresAt: '2026-07-01T00:00:00.000Z',
    })

    const first = await runReportExpiryTick({ pool: pool(), now })
    expect(first.expired).toBeGreaterThanOrEqual(2)

    const second = await runReportExpiryTick({ pool: pool(), now })
    expect(second.expired).toBe(0)

    const comparable = await pool().query(
      `SELECT status FROM market_pricing.comparable_reports WHERE id = $1`,
      [comparableId],
    )
    const agent = await pool().query(
      `SELECT status FROM market_pricing.agent_price_reports WHERE id = $1`,
      [agentId],
    )
    expect(comparable.rows[0].status).toBe('expired')
    expect(agent.rows[0].status).toBe('expired')
  })

  it('reportExpiresAt helper is created_at + 30 days', () => {
    expect(reportExpiresAt('2026-03-01T00:00:00.000Z')).toBe('2026-03-31T00:00:00.000Z')
  })

  it('concurrent tick skips when advisory lock is held', async () => {
    const { REPORT_EXPIRY } = await import('./fin/foundation/advisory-locks.js')
    const holder = await pool().connect()
    try {
      const locked = await holder.query(
        'SELECT pg_try_advisory_lock($1, $2) AS ok',
        [REPORT_EXPIRY, 0],
      )
      expect(locked.rows[0].ok).toBe(true)

      const tick = await runReportExpiryTick({
        pool: pool(),
        now: new Date('2026-09-01T00:00:00.000Z'),
      })
      expect(tick.skipped).toBe(true)
      expect(tick.reason).toBe('REPORT_EXPIRY_LOCK_HELD')
      expect(tick.expired).toBe(0)
    } finally {
      await holder.query('SELECT pg_advisory_unlock($1, $2)', [REPORT_EXPIRY, 0])
      holder.release()
    }
  })
})
