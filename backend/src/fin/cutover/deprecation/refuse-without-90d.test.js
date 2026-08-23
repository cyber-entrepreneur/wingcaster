/**
 * Real-Postgres — refuses DROP when quiet period < 90 days.
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

finPostgresSuite('cutover/deprecation/refuse-without-90d', {}, ({ pool }) => {
  it('refuses when FIN_ONLY activated less than 90 days ago', async () => {
    const attestationId = await seedFreshAttestation(pool(), { now: NOW })
    await setFinOnlyMode(pool(), { attestationId, activatedAt: NOW })

    await expect(deprecateCommercial({
      environment: 'LIVE',
      actor: { ...DEPRECATE_ACTOR, idempotencyKey: `deprecate-young-${Date.now()}` },
      snapshotNote: SNAPSHOT_NOTE,
      now: NOW,
    })).rejects.toThrow('CUTOVER_DEPRECATION_NOT_READY')
  })
})
