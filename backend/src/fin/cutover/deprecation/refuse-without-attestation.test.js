/**
 * Real-Postgres — refuses DROP without fresh attestation.
 */
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../testing/suite.js'
import { NOW } from '../../testing/seed.js'
import { deprecateCommercial } from '../deprecation.js'
import { DEPRECATE_ACTOR, SNAPSHOT_NOTE, setFinOnlyMode } from './test-support.js'

finPostgresSuite('cutover/deprecation/refuse-without-attestation', {}, ({ pool }) => {
  it('refuses when no attestation signed within 30 days', async () => {
    await setFinOnlyMode(pool(), { attestationId: null })

    await expect(deprecateCommercial({
      environment: 'LIVE',
      actor: { ...DEPRECATE_ACTOR, idempotencyKey: `deprecate-no-attest-${Date.now()}` },
      snapshotNote: SNAPSHOT_NOTE,
      now: NOW,
    })).rejects.toThrow('CUTOVER_DEPRECATION_NOT_READY')
  })
})
