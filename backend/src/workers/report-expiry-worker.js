/**
 * Shared daily report-expiry worker (BE-BLOCKER-24 + BE-BLOCKER-25).
 *
 * Identical shape for market_pricing.comparable_reports and
 * market_pricing.agent_price_reports: pending-like rows whose expires_at
 * is at or before `now` flip to `expired`.
 *
 * Pattern after fin/auth/expiry-worker.js: session advisory lock, batch
 * select, FOR UPDATE SKIP LOCKED per row.
 */

import logger from '../lib/logger.js'
import { getPool } from '../persistence/postgres-adapter.js'
import { REPORT_EXPIRY } from '../fin/foundation/advisory-locks.js'

export const REPORT_EXPIRY_DAYS = 30

/** Statuses treated as still open for auto-expiry. */
export const PENDING_LIKE_STATUSES = Object.freeze(['pending', 'pending_review'])

export const REPORT_EXPIRY_TABLES = Object.freeze([
  {
    key: 'comparable_reports',
    schema: 'market_pricing',
    table: 'comparable_reports',
  },
  {
    key: 'agent_price_reports',
    schema: 'market_pricing',
    table: 'agent_price_reports',
  },
])

/**
 * Default expires_at for a new report (created_at + 30 days).
 * @param {Date|string|number} [from]
 * @returns {string} ISO-8601 timestamp
 */
export function reportExpiresAt(from = new Date()) {
  const base = from instanceof Date ? from : new Date(from)
  const d = new Date(base.getTime())
  d.setUTCDate(d.getUTCDate() + REPORT_EXPIRY_DAYS)
  return d.toISOString()
}

function iso(value) {
  if (!value) return new Date().toISOString()
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function qualify({ schema, table }) {
  return `${schema}.${table}`
}

/**
 * Expire due rows for one report table. Shared helper called twice per tick.
 *
 * @param {import('pg').PoolClient} client
 * @param {{ schema: string, table: string, key: string }} target
 * @param {string} nowIso
 * @param {number} limit
 * @returns {Promise<{ key: string, scanned: number, expired: number, skipped: number, ids: string[] }>}
 */
export async function expireDueReportTable(client, target, nowIso, limit = 100) {
  const fq = qualify(target)
  const due = await client.query(
    `SELECT id, status
       FROM ${fq}
      WHERE status = ANY($1::text[])
        AND expires_at IS NOT NULL
        AND expires_at <= $2::timestamptz
      ORDER BY expires_at ASC, id ASC
      LIMIT $3
      FOR UPDATE SKIP LOCKED`,
    [PENDING_LIKE_STATUSES, nowIso, limit],
  )

  const ids = []
  let expired = 0
  let skipped = 0

  for (const row of due.rows) {
    if (row.status === 'expired') {
      skipped += 1
      continue
    }
    const updated = await client.query(
      `UPDATE ${fq}
          SET status = 'expired',
              updated_at = $2::timestamptz,
              data = CASE
                WHEN data IS NULL THEN jsonb_build_object('status', 'expired', 'updated_at', $2::text)
                ELSE data || jsonb_build_object('status', 'expired', 'updated_at', $2::text)
              END
        WHERE id = $1
          AND status = ANY($3::text[])
          AND expires_at IS NOT NULL
          AND expires_at <= $2::timestamptz
        RETURNING id`,
      [row.id, nowIso, PENDING_LIKE_STATUSES],
    )
    if (updated.rowCount) {
      expired += 1
      ids.push(updated.rows[0].id)
    } else {
      skipped += 1
    }
  }

  return {
    key: target.key,
    scanned: due.rows.length,
    expired,
    skipped,
    ids,
  }
}

/**
 * Run one daily tick across both report tables under a single advisory lock.
 *
 * @param {{ pool?: import('pg').Pool, now?: Date|string|number, limit?: number }} [opts]
 * @returns {Promise<{
 *   skipped: boolean,
 *   reason?: string,
 *   now: string,
 *   processed: number,
 *   expired: number,
 *   scanned: number,
 *   skippedRows: number,
 *   tables: Record<string, { scanned: number, expired: number, skipped: number, ids: string[] }>
 * }>}
 */
export async function runReportExpiryTick(opts = {}) {
  const pool = opts.pool || getPool()
  const nowIso = iso(opts.now)
  const limit = opts.limit ?? 100

  const lockClient = await pool.connect()
  try {
    const locked = await lockClient.query(
      'SELECT pg_try_advisory_lock($1, $2) AS ok',
      [REPORT_EXPIRY, 0],
    )
    if (!locked.rows[0].ok) {
      return {
        skipped: true,
        reason: 'REPORT_EXPIRY_LOCK_HELD',
        now: nowIso,
        processed: 0,
        expired: 0,
        scanned: 0,
        skippedRows: 0,
        tables: {},
      }
    }

    try {
      await lockClient.query('BEGIN')
      const tables = {}
      let expired = 0
      let scanned = 0
      let skippedRows = 0

      for (const target of REPORT_EXPIRY_TABLES) {
        const result = await expireDueReportTable(lockClient, target, nowIso, limit)
        tables[target.key] = result
        expired += result.expired
        scanned += result.scanned
        skippedRows += result.skipped
      }

      await lockClient.query('COMMIT')

      if (expired > 0) {
        logger.info(
          { expired, scanned, skippedRows, now: nowIso, tables },
          'report expiry tick',
        )
      }

      return {
        skipped: false,
        now: nowIso,
        processed: expired,
        expired,
        scanned,
        skippedRows,
        tables,
      }
    } catch (err) {
      await lockClient.query('ROLLBACK').catch(() => {})
      logger.error(
        { err: err.message || String(err) },
        'report expiry tick failed',
      )
      throw err
    } finally {
      await lockClient.query(
        'SELECT pg_advisory_unlock($1, $2)',
        [REPORT_EXPIRY, 0],
      )
    }
  } finally {
    lockClient.release()
  }
}
