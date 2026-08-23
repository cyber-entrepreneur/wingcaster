/**
 * Real-Postgres — refuses DROP when quiet period < 90 days.
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

skipIfNoPostgres()('cutover/deprecation/refuse-without-90d', () => {
  it('refuses when FIN_ONLY activated less than 90 days ago', async () => {
    await withDeprecationTestDb(async (pool) => {
      const attestationId = await seedFreshAttestation(pool, { now: NOW })
      await setFinOnlyMode(pool, { attestationId, activatedAt: NOW })

      await expect(deprecateCommercial({
        environment: 'LIVE',
        actor: { ...DEPRECATE_ACTOR, idempotencyKey: `deprecate-young-${Date.now()}` },
        snapshotNote: SNAPSHOT_NOTE,
        now: NOW,
      })).rejects.toThrow('CUTOVER_DEPRECATION_NOT_READY')
    })
  })
})
