/**
 * Real-Postgres — R100 DRIFT before drop, GREEN after.
 */
import { expect, it } from 'vitest'
import { NOW } from '../testing/seed.js'
import { skipIfNoPostgres } from '../../testing/postgres.js'
import { deprecateCommercial } from '../cutover/deprecation.js'
import {
  DEPRECATE_ACTOR,
  SNAPSHOT_NOTE,
  seedFreshAttestation,
  setFinOnlyMode,
  withDeprecationTestDb,
} from '../cutover/deprecation/test-support.js'
import { runReconciliation } from './runner.js'

function resultOf(run, code) {
  return run.results.find((r) => r.check_code === code)
}

skipIfNoPostgres()('reconciliation/r100', () => {
  it('R100 DRIFT when commercial tables remain after 90d quiet period, GREEN after DROP', async () => {
    await withDeprecationTestDb(async (pool) => {
      const attestationId = await seedFreshAttestation(pool, { now: NOW })
      await setFinOnlyMode(pool, { attestationId })

      const before = await runReconciliation(pool, { now: NOW })
      expect(resultOf(before, 'R100').result).toBe('DRIFT')

      await deprecateCommercial({
        environment: 'LIVE',
        actor: { ...DEPRECATE_ACTOR, idempotencyKey: `r100-drop-${Date.now()}` },
        snapshotNote: SNAPSHOT_NOTE,
        now: NOW,
      })

      const after = await runReconciliation(pool, { now: NOW })
      expect(resultOf(after, 'R100').result).toBe('GREEN')
    })
  })
})
