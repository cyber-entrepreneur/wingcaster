/**
 * Real-Postgres — happy-path DROP leaves tombstoned commercial schema.
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

finPostgresSuite('cutover/deprecation/happy-drop', {}, ({ pool }) => {
  it('drops all commercial tables and keeps the empty schema', async () => {
    const attestationId = await seedFreshAttestation(pool(), { now: NOW })
    await setFinOnlyMode(pool(), { attestationId })

    const before = await pool().query(
      `SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname = 'commercial'`,
    )
    expect(before.rows[0].n).toBeGreaterThan(0)

    const result = await deprecateCommercial({
      environment: 'LIVE',
      actor: { ...DEPRECATE_ACTOR, idempotencyKey: `deprecate-happy-${Date.now()}` },
      snapshotNote: SNAPSHOT_NOTE,
      now: NOW,
    })
    expect(result.ok).toBe(true)
    expect(result.tables_remaining).toBe(0)

    const afterTables = await pool().query(
      `SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname = 'commercial'`,
    )
    expect(afterTables.rows[0].n).toBe(0)

    const schema = await pool().query(
      `SELECT nspname FROM pg_namespace WHERE nspname = 'commercial'`,
    )
    expect(schema.rowCount).toBe(1)
  })
})
