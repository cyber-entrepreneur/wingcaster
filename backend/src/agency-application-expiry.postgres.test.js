/**
 * Real-Postgres coverage for BE-BLOCKER-09:
 *   - agency_applications.expires_at column + created_at+30d backfill
 *   - daily expiry tick flips due pending → expired
 *   - tick is idempotent
 *   - future expires_at rows stay pending
 */
import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import { query } from './db.js'
import {
  agencyApplicationExpiresAt,
  runAgencyApplicationExpiryTick,
} from './workers/agency-application-expiry.js'


async function seedAgency(id) {
  // Use the full id in slug — truncating to 8 chars collapsed
  // `agency-${uuid.slice(0,8)}` into only 16 buckets (`slug-agency-0`…`f`)
  // and caused intermittent agencies_slug_key collisions under Real-Postgres.
  await query(
    `INSERT INTO public.agencies (id, name, slug, created_at, updated_at, data)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [id, `Agency ${id.slice(0, 8)}`, `slug-${id}`],
  )
  return id
}

async function seedApplication({
  status = 'pending',
  createdAt,
  expiresAt,
} = {}) {
  const id = randomUUID()
  const created = createdAt || new Date().toISOString()
  const expires = expiresAt === undefined
    ? agencyApplicationExpiresAt(created)
    : expiresAt
  const agencyId = `agency-${id.slice(0, 8)}`
  await seedAgency(agencyId)
  await query(
    `INSERT INTO public.agency_applications
      (id, agency_id, agent_email, agent_name, status, created_at, updated_at, expires_at, data)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz, $7::timestamptz, $8::jsonb)`,
    [
      id,
      agencyId,
      `agent-${id.slice(0, 8)}@example.test`,
      'Test Agent',
      status,
      created,
      expires,
      JSON.stringify({
        id,
        status,
        created_at: created,
        expires_at: expires,
      }),
    ],
  )
  return id
}

finPostgresSuite('agency application expiry (BE-BLOCKER-09)', { seed: false }, ({ pool }) => {
  it('migration adds expires_at and backfills created_at + 30 days', async () => {
    const col = await pool().query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'agency_applications'
          AND column_name = 'expires_at'`,
    )
    expect(col.rows[0]?.data_type).toBe('timestamp with time zone')
    expect(col.rows[0]?.is_nullable).toBe('NO')
    expect(String(col.rows[0]?.column_default || '')).toMatch(/30\s*days/i)

    const created = '2026-01-01T00:00:00.000Z'
    const id = randomUUID()
    const agencyId = `ag-${id.slice(0, 8)}`
    await seedAgency(agencyId)
    await pool().query(
      `INSERT INTO public.agency_applications
        (id, agency_id, agent_email, status, created_at, updated_at, expires_at, data)
       VALUES ($1, $2, $3, 'pending', $4::timestamptz, $4::timestamptz, $4::timestamptz, '{}'::jsonb)`,
      [id, agencyId, `a-${id.slice(0, 8)}@ex.test`, created],
    )

    // Re-apply the migration backfill expression against a cleared column
    // (temporarily nullable) to prove created_at + 30 days semantics.
    await pool().query(
      `ALTER TABLE public.agency_applications ALTER COLUMN expires_at DROP NOT NULL`,
    )
    await pool().query(
      `UPDATE public.agency_applications SET expires_at = NULL WHERE id = $1`,
      [id],
    )
    await pool().query(
      `UPDATE public.agency_applications
          SET expires_at = COALESCE(created_at, CURRENT_TIMESTAMP) + INTERVAL '30 days'
        WHERE expires_at IS NULL`,
    )
    await pool().query(
      `ALTER TABLE public.agency_applications ALTER COLUMN expires_at SET NOT NULL`,
    )

    const row = await pool().query(
      `SELECT expires_at, created_at + INTERVAL '30 days' AS expected
         FROM public.agency_applications
        WHERE id = $1`,
      [id],
    )
    expect(new Date(row.rows[0].expires_at).toISOString()).toBe(
      new Date(row.rows[0].expected).toISOString(),
    )
    expect(new Date(row.rows[0].expires_at).toISOString()).toBe('2026-01-31T00:00:00.000Z')
  })

  it('tick expires due pending rows and leaves future rows untouched', async () => {
    const now = new Date('2026-06-15T12:00:00.000Z')
    const dueId = await seedApplication({
      status: 'pending',
      createdAt: '2026-05-01T12:00:00.000Z',
      expiresAt: '2026-05-31T12:00:00.000Z',
    })
    const futureId = await seedApplication({
      status: 'pending',
      createdAt: '2026-06-10T12:00:00.000Z',
      expiresAt: '2026-07-10T12:00:00.000Z',
    })

    const result = await runAgencyApplicationExpiryTick({ now })
    expect(result.expired).toBeGreaterThanOrEqual(1)
    expect(result.scanned).toBeGreaterThanOrEqual(1)

    const due = await pool().query(
      `SELECT status FROM public.agency_applications WHERE id = $1`,
      [dueId],
    )
    const future = await pool().query(
      `SELECT status FROM public.agency_applications WHERE id = $1`,
      [futureId],
    )
    expect(due.rows[0].status).toBe('expired')
    expect(future.rows[0].status).toBe('pending')
  })

  it('tick is idempotent for already-expired rows', async () => {
    const now = new Date('2026-08-01T00:00:00.000Z')
    const id = await seedApplication({
      status: 'pending',
      createdAt: '2026-06-01T00:00:00.000Z',
      expiresAt: '2026-07-01T00:00:00.000Z',
    })

    const first = await runAgencyApplicationExpiryTick({ now })
    expect(first.expired).toBeGreaterThanOrEqual(1)

    const second = await runAgencyApplicationExpiryTick({ now })
    expect(second.expired).toBe(0)
    expect(second.skipped).toBeGreaterThanOrEqual(1)

    const row = await pool().query(
      `SELECT status FROM public.agency_applications WHERE id = $1`,
      [id],
    )
    expect(row.rows[0].status).toBe('expired')
  })

  it('agencyApplicationExpiresAt helper is created_at + 30 days', () => {
    expect(agencyApplicationExpiresAt('2026-03-01T00:00:00.000Z')).toBe('2026-03-31T00:00:00.000Z')
  })
})
