/**
 * PA-CRD-008 — credit reservation janitor admin status + manual run.
 */
import { runCreditJanitorTick } from '../../lib/credits/janitor.js'
import { FIN_CREDITS_JANITOR } from '../foundation/advisory-locks.js'

const WORKER = 'CREDITS_JANITOR'

export async function loadCreditJanitorStatus(pool) {
  const [backlog, lock, lastRun] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS count
         FROM public.credit_reservations
        WHERE status = 'HELD' AND expires_at < NOW()`,
    ),
    pool.query(
      `SELECT l.pid, l.granted, a.usename, a.application_name,
              COALESCE(a.client_addr::text, '') AS client_addr
         FROM pg_locks l
         LEFT JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory'
          AND l.classid = $1
          AND l.objid = 0
          AND l.granted`,
      [FIN_CREDITS_JANITOR],
    ),
    pool.query(
      `SELECT last_run_at, last_processed_count, last_skip_reason, updated_at
         FROM public.credit_worker_status
        WHERE worker_name = $1`,
      [WORKER],
    ),
  ])

  const holder = lock.rows[0] || null
  const persisted = lastRun.rows[0] || null

  return {
    worker: WORKER,
    advisory_lock_class: FIN_CREDITS_JANITOR,
    backlog_count: backlog.rows[0]?.count ?? 0,
    lock_held: Boolean(holder),
    lock_holder: holder
      ? {
        pid: holder.pid,
        usename: holder.usename,
        application_name: holder.application_name,
        client_addr: holder.client_addr,
      }
      : null,
    last_run_at: persisted?.last_run_at ?? null,
    last_processed_count: persisted?.last_processed_count ?? 0,
    last_skip_reason: persisted?.last_skip_reason ?? null,
    status_updated_at: persisted?.updated_at ?? null,
  }
}

export async function recordCreditJanitorRun(pool, result, now = new Date().toISOString()) {
  await pool.query(
    `INSERT INTO public.credit_worker_status (
       worker_name, last_run_at, last_processed_count, last_skip_reason, updated_at
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (worker_name) DO UPDATE SET
       last_run_at = EXCLUDED.last_run_at,
       last_processed_count = EXCLUDED.last_processed_count,
       last_skip_reason = EXCLUDED.last_skip_reason,
       updated_at = EXCLUDED.updated_at`,
    [
      WORKER,
      now,
      Number(result?.processed || 0),
      result?.reason || (result?.skipped ? 'CREDITS_JANITOR_LOCK_HELD' : null),
      now,
    ],
  )
}

export async function runCreditJanitorAdmin(pool, now = new Date().toISOString()) {
  const result = await runCreditJanitorTick({ pool, now })
  await recordCreditJanitorRun(pool, result, now)
  return {
    ...result,
    last_run_at: now,
  }
}
