/**
 * Real-Postgres tests for listing authorization + anti-fraud verification.
 *
 * Only Real-PG catches: migration 799 applying against a real cluster, and the
 * table-mapper INSERT of the new typed columns actually succeeding (the
 * duplicate-column trap is invisible to DAL-mocked unit tests).
 */
import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { insert, findOne } from '../../db.js'
import { submitPortalPublishingJob } from '../publishing/submit-job.js'
import { hardGateBlockers, deriveVerificationStatus } from './jurisdiction-requirements.js'

finPostgresSuite('listing verification gate (migration 799)', { seed: false }, ({ pool }) => {
  it('migration 799 adds the property columns + listing_verifications table', async () => {
    const cols = await pool().query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'properties'
         AND column_name IN ('country_code','listing_role','represents_type','represents_name','verification_status')
       ORDER BY column_name`)
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'country_code', 'listing_role', 'represents_type', 'represents_name', 'verification_status',
    ].sort())

    const tbl = await pool().query(`SELECT to_regclass('public.listing_verifications') AS t`)
    expect(tbl.rows[0].t).toBeTruthy()

    const def = await pool().query(`
      SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'properties'
         AND column_name = 'verification_status'`)
    expect(def.rows[0].column_default).toMatch(/unverified/)
  })

  it('DAL insert persists typed columns + verification value in data (no duplicate-column 500)', async () => {
    const id = randomUUID()
    await insert('properties', {
      id,
      agent_id: null,
      title: 'Marina View 2BR',
      city: 'Dubai',
      status: 'active',
      country_code: 'AE',
      listing_role: 'referral',
      represents_type: 'developer',
      represents_name: 'Aldar',
      verification_status: 'authorised',
      // rides in data JSONB (not a typed column) — read back via fromRow
      trakheesi_number: '71-1234567890',
      authorization_ref: 'FORM-A-9',
    })

    // Typed columns land in real columns.
    const row = await pool().query(
      `SELECT country_code, listing_role, represents_type, verification_status,
              data->>'trakheesi_number' AS trakheesi
         FROM public.properties WHERE id = $1`,
      [id],
    )
    expect(row.rows[0]).toMatchObject({
      country_code: 'AE',
      listing_role: 'referral',
      represents_type: 'developer',
      verification_status: 'authorised',
      trakheesi: '71-1234567890',
    })

    // DAL readback merges data back to top-level so the gate can read it.
    const hydrated = await findOne('properties', (p) => p.id === id)
    expect(hydrated.trakheesi_number).toBe('71-1234567890')
    expect(hardGateBlockers(hydrated).missing).toHaveLength(0)
    expect(deriveVerificationStatus(hydrated)).toBe('authorised')
  })

  it('listing_verifications audit row inserts via the DAL', async () => {
    const propertyId = randomUUID()
    await insert('properties', { id: propertyId, agent_id: null, title: 'x', city: 'Dubai', status: 'active' })
    const auditId = randomUUID()
    await insert('listing_verifications', {
      id: auditId,
      property_id: propertyId,
      agency_id: null,
      tenant_id: 'personal:u1',
      from_status: null,
      to_status: 'authorised',
      control_key: 'AE',
      source: 'listing_create',
      actor_user_id: null,
    })
    const back = await findOne('listing_verifications', (v) => v.id === auditId)
    expect(back.to_status).toBe('authorised')
    expect(back.control_key).toBe('AE')
  })

  it('portal broadcast is BLOCKED for a UAE property with no permit', async () => {
    const propertyId = randomUUID()
    const agentId = randomUUID()
    await insert('properties', {
      id: propertyId, agent_id: null, title: 'Unpermitted', city: 'Dubai',
      status: 'active', country_code: 'AE',
    })
    await expect(
      submitPortalPublishingJob({ propertyId, agentId, portals: [{ code: 'bayut' }] }),
    ).rejects.toMatchObject({ code: 'LISTING_UNVERIFIED', status: 400 })
  })

  it('portal broadcast passes the gate once the permit is present', async () => {
    const propertyId = randomUUID()
    const agentId = randomUUID()
    await insert('properties', {
      id: propertyId, agent_id: null, title: 'Permitted', city: 'Dubai',
      status: 'active', country_code: 'AE', trakheesi_number: '71-1',
    })
    // The gate now passes; the call proceeds to portal resolution and fails
    // there (no portal_registry seeded) — proving the permit unblocked the gate.
    await expect(
      submitPortalPublishingJob({ propertyId, agentId, portals: [{ code: 'bayut' }] }),
    ).rejects.toSatisfy((err) => err.code !== 'LISTING_UNVERIFIED')
  })
})
