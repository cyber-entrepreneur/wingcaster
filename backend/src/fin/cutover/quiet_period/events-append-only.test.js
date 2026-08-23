/**
 * Real-Postgres — UPDATE/DELETE on quiet_period_events rejected at role level.
 */
import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { NOW } from '../../testing/seed.js'
import { finPostgresSuite } from '../../testing/suite.js'

finPostgresSuite('quiet_period/events-append-only', {}, ({ pool }) => {
  it('fin_app_role can INSERT but UPDATE/DELETE are revoked', async () => {
    const id = randomUUID()
    const client = await pool().connect()
    try {
      await client.query('SET ROLE fin_app_role')
      await client.query(`SELECT set_config('fin.environment', 'LIVE', false)`)
      await client.query(
        `INSERT INTO fin.cutover_quiet_period_events (
           id, environment, kind, source_file, message, payload, occurred_at
         ) VALUES ($1, 'LIVE', 'OTHER', 'test.js', 'probe', '{}'::jsonb, $2::timestamptz)`,
        [id, NOW],
      )

      await expect(client.query(
        `UPDATE fin.cutover_quiet_period_events SET message = 'nope' WHERE id = $1`,
        [id],
      )).rejects.toMatchObject({ code: '42501' })

      await expect(client.query(
        `DELETE FROM fin.cutover_quiet_period_events WHERE id = $1`,
        [id],
      )).rejects.toMatchObject({ code: '42501' })
    } finally {
      await client.query('RESET ROLE').catch(() => {})
      client.release()
    }
  })
})
