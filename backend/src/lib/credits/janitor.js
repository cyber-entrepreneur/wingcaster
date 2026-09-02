/**
 * Hanging-reservation janitor. Runs every 60s (caller schedules).
 * Advisory lock CREDITS_JANITOR = 1022 (spec 1020 is already FIN_BILLING_PERIOD_CLOSE).
 */
import { FIN_CREDITS_JANITOR } from '../../fin/foundation/advisory-locks.js'
import { insertOutbox } from '../../fin/ledger/write.js'

const BATCH = 200

export async function runCreditJanitorTick({
  pool,
  now = new Date().toISOString(),
  limit = BATCH,
  environment = 'LIVE',
} = {}) {
  const lockClient = await pool.connect()
  try {
    const locked = await lockClient.query(
      'SELECT pg_try_advisory_lock($1, $2) AS ok',
      [FIN_CREDITS_JANITOR, 0],
    )
    if (!locked.rows[0].ok) {
      return { skipped: true, processed: 0, reason: 'CREDITS_JANITOR_LOCK_HELD' }
    }
    try {
      const expired = await lockClient.query(
        `SELECT id FROM public.credit_reservations
          WHERE status = 'HELD' AND expires_at < $1::timestamptz
          ORDER BY expires_at ASC
          LIMIT $2`,
        [now, limit],
      )
      let processed = 0
      for (const row of expired.rows) {
        await lockClient.query('BEGIN')
        try {
          const held = await lockClient.query(
            `SELECT * FROM public.credit_reservations WHERE id = $1 FOR UPDATE SKIP LOCKED`,
            [row.id],
          )
          const reservation = held.rows[0]
          if (!reservation || reservation.status !== 'HELD') {
            await lockClient.query('COMMIT')
            continue
          }
          await lockClient.query(
            `SELECT * FROM public.credit_wallets WHERE tenant_id = $1 FOR UPDATE`,
            [reservation.tenant_id],
          )
          await lockClient.query(
            `UPDATE public.credit_reservations
                SET status = 'EXPIRED', resolved_at = $2::timestamptz
              WHERE id = $1`,
            [reservation.id, now],
          )
          await lockClient.query(
            `UPDATE public.credit_wallets
                SET credits_reserved = GREATEST(credits_reserved - $2, 0),
                    version = version + 1,
                    updated_at = $3::timestamptz
              WHERE tenant_id = $1`,
            [reservation.tenant_id, reservation.credits_amount, now],
          )
          await insertOutbox(lockClient, {
            environment,
            topic: 'credits.reservation_expired',
            dedupeKey: `credits.reservation_expired:${reservation.id}`,
            payload: {
              reservation_id: reservation.id,
              tenant_id: reservation.tenant_id,
              feature: reservation.feature,
              request_id: reservation.request_id,
              credits_amount: Number(reservation.credits_amount),
            },
            now,
          })
          await lockClient.query('COMMIT')
          processed += 1
        } catch (error) {
          await lockClient.query('ROLLBACK').catch(() => {})
          throw error
        }
      }
      return { skipped: false, processed }
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock($1, $2)', [FIN_CREDITS_JANITOR, 0])
    }
  } finally {
    lockClient.release()
  }
}
