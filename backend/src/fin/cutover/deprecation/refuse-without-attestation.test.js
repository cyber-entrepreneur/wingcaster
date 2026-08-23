/**
 * Real-Postgres — refuses DROP without fresh attestation.
 */
import { expect, it } from 'vitest'
import { NOW } from '../../testing/seed.js'
import { skipIfNoPostgres } from '../../../testing/postgres.js'
import { deprecateCommercial } from '../deprecation.js'
import { DEPRECATE_ACTOR, SNAPSHOT_NOTE, setFinOnlyMode, withDeprecationTestDb } from './test-support.js'

skipIfNoPostgres()('cutover/deprecation/refuse-without-attestation', () => {
  it('refuses when no attestation signed within 30 days', async () => {
    await withDeprecationTestDb(async (pool) => {
      await setFinOnlyMode(pool, { attestationId: null })

      await expect(deprecateCommercial({
        environment: 'LIVE',
        actor: { ...DEPRECATE_ACTOR, idempotencyKey: `deprecate-no-attest-${Date.now()}` },
        snapshotNote: SNAPSHOT_NOTE,
        now: NOW,
      })).rejects.toThrow('CUTOVER_DEPRECATION_NOT_READY')
    })
  })
})
