import { WHATSAPP_INTAKE_JANITOR } from '../../../fin/foundation/advisory-locks.js'
import { getPool } from '../../../persistence/postgres-adapter.js'

export async function runWhatsAppIntakeJanitorTick({ pool } = {}) {
  const pg = pool || getPool()
  const lockClient = await pg.connect()
  try {
    const locked = await lockClient.query(
      'SELECT pg_try_advisory_lock($1, $2) AS ok',
      [WHATSAPP_INTAKE_JANITOR, 0],
    )
    if (!locked.rows[0].ok) {
      return { skipped: true, processed: 0, reason: 'WHATSAPP_INTAKE_JANITOR_LOCK_HELD' }
    }
    try {
      const result = await lockClient.query(
        `UPDATE public.whatsapp_activation_codes
            SET invalidated_at = NOW(),
                invalidated_reason = 'EXPIRED',
                pending_selection = NULL
          WHERE expires_at <= NOW()
            AND claimed_at IS NULL
            AND invalidated_at IS NULL
          RETURNING id`,
      )
      return { skipped: false, processed: result.rowCount || 0 }
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock($1, $2)', [WHATSAPP_INTAKE_JANITOR, 0])
    }
  } finally {
    lockClient.release()
  }
}
