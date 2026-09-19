/**
 * PA-CRD-009 — credit → fin ledger mirror worker admin status + manual run.
 */
import { runCreditFinMirrorTick } from '../../lib/credits/fin-mirror-worker.js'
import { FIN_CREDITS_FIN_MIRROR } from '../foundation/advisory-locks.js'

const WORKER = 'CREDITS_FIN_MIRROR'

const UNMIRRORED_GRANTS_SQL = `
  SELECT COUNT(*)::int AS count
    FROM public.credit_grants g
   WHERE NOT EXISTS (
     SELECT 1 FROM fin.ledger_transactions t
      WHERE t.economic_source_type = 'credit_grants'
        AND t.economic_source_id = g.id
        AND t.shape = 'GRANT_MIRROR'
   )`

const UNMIRRORED_CONSUMPTIONS_SQL = `
  SELECT COUNT(*)::int AS count
    FROM public.credit_consumptions c
   WHERE NOT EXISTS (
     SELECT 1 FROM fin.ledger_transactions t
      WHERE t.economic_source_type = 'credit_consumptions'
        AND t.economic_source_id = c.id
        AND t.shape = 'CONSUME_MIRROR'
   )`

async function queryWorkerStatus(pool, workerName) {
  try {
    const { rows } = await pool.query(
      `SELECT last_run_at, last_processed_count, last_skip_reason,
              COALESCE(last_skipped_rows, 0) AS last_skipped_rows, updated_at
         FROM public.credit_worker_status
        WHERE worker_name = $1`,
      [workerName],
    )
    return rows[0] || null
  } catch (error) {
    if (error.code === '42P01' || error.code === '42703') return null
    throw error
  }
}

export async function loadCreditFinMirrorStatus(pool) {
  const [grants, consumptions, lock, lastRun, lastMirror] = await Promise.all([
    pool.query(UNMIRRORED_GRANTS_SQL),
    pool.query(UNMIRRORED_CONSUMPTIONS_SQL),
    pool.query(
      `SELECT l.pid, l.granted, a.usename, a.application_name,
              COALESCE(a.client_addr::text, '') AS client_addr
         FROM pg_locks l
         LEFT JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory'
          AND l.classid = $1
          AND l.objid = 0
          AND l.granted`,
      [FIN_CREDITS_FIN_MIRROR],
    ),
    queryWorkerStatus(pool, WORKER),
    pool.query(
      `SELECT MAX(created_at) AS last_mirror_at
         FROM fin.ledger_transactions
        WHERE shape IN ('GRANT_MIRROR', 'CONSUME_MIRROR')`,
    ),
  ])

  const grantBacklog = grants.rows[0]?.count ?? 0
  const consumptionBacklog = consumptions.rows[0]?.count ?? 0
  const holder = lock.rows[0] || null
  const persisted = lastRun

  return {
    worker: WORKER,
    advisory_lock_class: FIN_CREDITS_FIN_MIRROR,
    grant_backlog_count: grantBacklog,
    consumption_backlog_count: consumptionBacklog,
    backlog_count: grantBacklog + consumptionBacklog,
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
    last_mirror_at: lastMirror.rows[0]?.last_mirror_at ?? null,
    last_processed_count: persisted?.last_processed_count ?? 0,
    last_skipped_rows: persisted?.last_skipped_rows ?? 0,
    last_skip_reason: persisted?.last_skip_reason ?? null,
    status_updated_at: persisted?.updated_at ?? null,
  }
}

export async function recordCreditFinMirrorRun(pool, result, now = new Date().toISOString()) {
  const skipReason = result?.reason || (result?.skipped ? 'CREDITS_FIN_MIRROR_LOCK_HELD' : null)
  const values = [
    WORKER,
    now,
    Number(result?.processed || 0),
    skipReason,
    Number(result?.skippedRows || 0),
    now,
  ]
  try {
    await pool.query(
      `INSERT INTO public.credit_worker_status (
         worker_name, last_run_at, last_processed_count, last_skip_reason,
         last_skipped_rows, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (worker_name) DO UPDATE SET
         last_run_at = EXCLUDED.last_run_at,
         last_processed_count = EXCLUDED.last_processed_count,
         last_skip_reason = EXCLUDED.last_skip_reason,
         last_skipped_rows = EXCLUDED.last_skipped_rows,
         updated_at = EXCLUDED.updated_at`,
      values,
    )
  } catch (error) {
    if (error.code !== '42P01' && error.code !== '42703') throw error
    try {
      await pool.query(
        `INSERT INTO public.credit_worker_status (
           worker_name, last_run_at, last_processed_count, last_skip_reason, updated_at
         ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (worker_name) DO UPDATE SET
           last_run_at = EXCLUDED.last_run_at,
           last_processed_count = EXCLUDED.last_processed_count,
           last_skip_reason = EXCLUDED.last_skip_reason,
           updated_at = EXCLUDED.updated_at`,
        [WORKER, now, values[2], skipReason, now],
      )
    } catch (fallbackError) {
      if (fallbackError.code !== '42P01') throw fallbackError
    }
  }
}

export async function runCreditFinMirrorAdmin(pool, now = new Date().toISOString()) {
  const result = await runCreditFinMirrorTick({ pool, now })
  await recordCreditFinMirrorRun(pool, result, now)
  return {
    ...result,
    last_run_at: now,
  }
}
