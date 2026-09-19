import { expect, it, vi } from 'vitest'
import { WHATSAPP_LISTINGS_WORKER } from '../../../fin/foundation/advisory-locks.js'
import { finPostgresSuite } from '../../../fin/testing/suite.js'
import { createQueue } from '../infrastructure/queue.js'

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} }

finPostgresSuite('whatsapp-listings worker advisory-lock', { seed: false }, ({ pool }) => {
  it('class 1032 — a held lock skips the tick; releases cleanly so the next tick runs', async () => {
    expect(WHATSAPP_LISTINGS_WORKER).toBe(1032)

    const pipeline = { runExtraction: vi.fn(), discardDraft: vi.fn() }
    const queue = createQueue({
      pipeline,
      config: { sessionTtlHours: 24, dedupeTtlHours: 24 },
      logger: noopLogger,
    })

    const holder = await pool().connect()
    try {
      // Simulate another replica already running a tick.
      const held = await holder.query('SELECT pg_try_advisory_lock($1, $2) AS ok', [WHATSAPP_LISTINGS_WORKER, 0])
      expect(held.rows[0].ok).toBe(true)

      const skipped = await queue.tick()
      expect(skipped).toEqual({ skipped: true, reason: 'LOCK_HELD' })
      expect(pipeline.runExtraction).not.toHaveBeenCalled()

      // Release the foreign lock; the next tick should acquire, run, and release it.
      await holder.query('SELECT pg_advisory_unlock($1, $2)', [WHATSAPP_LISTINGS_WORKER, 0])
      const ran = await queue.tick()
      expect(ran.skipped).toBe(false)

      // Proof the tick did not leak its lock: the holder can re-acquire it.
      const reacquired = await holder.query('SELECT pg_try_advisory_lock($1, $2) AS ok', [WHATSAPP_LISTINGS_WORKER, 0])
      expect(reacquired.rows[0].ok).toBe(true)
    } finally {
      try {
        await holder.query('SELECT pg_advisory_unlock_all()')
      } catch { /* nothing held */ }
      holder.release()
    }
  })
})
