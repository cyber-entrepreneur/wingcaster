/**
 * Real-Postgres — pre-flight FK check refuses DROP.
 */
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../testing/suite.js'
import { NOW } from '../../testing/seed.js'
import { deprecateCommercial } from '../deprecation.js'
import {
  DEPRECATE_ACTOR,
  SNAPSHOT_NOTE,
  seedFreshAttestation,
  setFinOnlyMode,
} from './test-support.js'

finPostgresSuite('cutover/deprecation/pre-flight-fk', {}, ({ pool }) => {
  it('refuses DROP when a public table FK references commercial.*', async () => {
    const attestationId = await seedFreshAttestation(pool(), { now: NOW })
    await setFinOnlyMode(pool(), { attestationId })

    await pool().query(`
      CREATE TABLE IF NOT EXISTS public.deprecation_fk_probe (
        id TEXT PRIMARY KEY,
        ledger_id TEXT REFERENCES commercial.ledger_entries(id)
      )
    `)

    await expect(deprecateCommercial({
      environment: 'LIVE',
      actor: { ...DEPRECATE_ACTOR, idempotencyKey: `deprecate-fk-${Date.now()}` },
      snapshotNote: SNAPSHOT_NOTE,
      now: NOW,
    })).rejects.toThrow(/CUTOVER_DEPRECATION_NOT_READY|CUTOVER_FK_PREFLIGHT_FAILED/)

    const remaining = await pool().query(
      `SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname = 'commercial'`,
    )
    expect(remaining.rows[0].n).toBeGreaterThan(0)

    await pool().query('DROP TABLE IF EXISTS public.deprecation_fk_probe')
  })
})
