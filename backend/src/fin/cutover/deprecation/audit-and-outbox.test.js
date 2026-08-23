/**
 * Real-Postgres — DROP writes audit + outbox with snapshot note.
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

finPostgresSuite('cutover/deprecation/audit-and-outbox', {}, ({ pool }) => {
  it('records FIN_CUTOVER_COMMERCIAL_DROPPED audit and outbox payload', async () => {
    const attestationId = await seedFreshAttestation(pool(), { now: NOW })
    await setFinOnlyMode(pool(), { attestationId })

    await deprecateCommercial({
      environment: 'LIVE',
      actor: { ...DEPRECATE_ACTOR, idempotencyKey: `deprecate-audit-${Date.now()}` },
      snapshotNote: SNAPSHOT_NOTE,
      now: NOW,
    })

    const audit = await pool().query(
      `SELECT action, actor_email_snapshot, after_state
         FROM fin.financial_audit_events
        WHERE action = 'FIN_CUTOVER_COMMERCIAL_DROPPED'
        ORDER BY created_at DESC LIMIT 1`,
    )
    expect(audit.rowCount).toBe(1)
    expect(audit.rows[0].actor_email_snapshot).toBe(DEPRECATE_ACTOR.actorEmail)
    expect(audit.rows[0].after_state.snapshot_note).toBe(SNAPSHOT_NOTE)

    const outbox = await pool().query(
      `SELECT topic, payload FROM fin.outbox_events
        WHERE topic = 'fin.cutover.commercial_dropped'
        ORDER BY created_at DESC LIMIT 1`,
    )
    expect(outbox.rowCount).toBe(1)
    expect(outbox.rows[0].payload.snapshot_note).toBe(SNAPSHOT_NOTE)
  })
})
