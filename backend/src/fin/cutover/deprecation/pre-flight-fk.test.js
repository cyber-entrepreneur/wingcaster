/**
 * Real-Postgres — pre-flight FK check refuses DROP.
 */
import { expect, it } from 'vitest'
import { NOW } from '../../testing/seed.js'
import { skipIfNoPostgres } from '../../../testing/postgres.js'
import { deprecateCommercial } from '../deprecation.js'
import {
  DEPRECATE_ACTOR,
  SNAPSHOT_NOTE,
  seedFreshAttestation,
  setFinOnlyMode,
  withDeprecationTestDb,
} from './test-support.js'

skipIfNoPostgres()('cutover/deprecation/pre-flight-fk', () => {
  it('refuses DROP when a public table FK references commercial.*', async () => {
    await withDeprecationTestDb(async (pool) => {
      const attestationId = await seedFreshAttestation(pool, { now: NOW })
      await setFinOnlyMode(pool, { attestationId })

      await pool.query(`
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
      })).rejects.toThrow('CUTOVER_DEPRECATION_NOT_READY')

      const remaining = await pool.query(
        `SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname = 'commercial'`,
      )
      expect(remaining.rows[0].n).toBeGreaterThan(0)

      await pool.query('DROP TABLE IF EXISTS public.deprecation_fk_probe')
    })
  })
})
