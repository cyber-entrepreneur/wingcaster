/**
 * Stage 13e quiet-period best-effort logger (DL-217).
 * INSERT only. Never throws — a failed log must not break the caller.
 * Uses a standalone pool connection so an aborted caller tx (42501 on
 * commercial.*) cannot roll the anomaly row back or poison the INSERT.
 */
import { randomUUID } from 'node:crypto'
import { getPool } from '../../../persistence/postgres-adapter.js'
import { BusinessClock } from '../../clock.js'
import { QUIET_PERIOD_KINDS } from './status.js'

const INSERT_SQL = `INSERT INTO fin.cutover_quiet_period_events (
       id, environment, kind, source_file, message, payload, occurred_at
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`

function envOf(value) {
  return value === 'TEST' ? 'TEST' : 'LIVE'
}

function kindOf(value) {
  return QUIET_PERIOD_KINDS.includes(value) ? value : 'OTHER'
}

function payloadJson(payload) {
  try {
    return JSON.stringify(payload && typeof payload === 'object' ? payload : {})
  } catch {
    return '{}'
  }
}

async function insertRow(client, values) {
  try {
    if (client?.query) {
      await client.query(INSERT_SQL, values)
      return
    }
  } catch {
    // Caller client may be aborted (25P02) after a commercial permission
    // denied. Fall through to a fresh pool connection.
  }
  try {
    await getPool().query(INSERT_SQL, values)
  } catch {
    // Best-effort: never throw.
  }
}

export function isCommercialPermissionDenied(error) {
  if (String(error?.code || '') !== '42501') return false
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('commercial')
    || msg.includes('usage_events')
    || msg.includes('ledger_entries')
    || msg.includes('record_consumption')
}

export async function logQuietPeriodEvent(client, {
  kind = 'OTHER',
  environment = 'LIVE',
  sourceFile = null,
  message = 'quiet_period_event',
  payload = {},
  now = null,
} = {}) {
  try {
    const occurredAt = now || BusinessClock.now()
    await insertRow(client, [
      randomUUID(),
      envOf(environment),
      kindOf(kind),
      sourceFile != null ? String(sourceFile).slice(0, 512) : null,
      String(message || 'quiet_period_event').slice(0, 4000),
      payloadJson(payload),
      occurredAt,
    ])
  } catch {
    // never throw
  }
}

export async function logCommercialWriteAttempt(client, {
  environment = 'LIVE',
  sourceFile = null,
  message = 'permission denied on commercial.*',
  payload = {},
  now = null,
} = {}) {
  return logQuietPeriodEvent(client, {
    kind: 'COMMERCIAL_WRITE_ATTEMPT',
    environment,
    sourceFile,
    message,
    payload,
    now,
  })
}

export async function noteCommercialWriteFailure(client, error, meta = {}) {
  try {
    if (!isCommercialPermissionDenied(error)) return
    await logCommercialWriteAttempt(client, {
      environment: meta.environment,
      sourceFile: meta.sourceFile,
      message: meta.message || String(error?.message || 'permission denied on commercial.*'),
      payload: { ...(meta.payload || {}), code: error?.code, error_message: error?.message },
      now: meta.now,
    })
  } catch {
    // never throw
  }
}

export async function watchCommercialWrite(client, meta, work) {
  try {
    return await work()
  } catch (error) {
    await noteCommercialWriteFailure(client, error, meta)
    throw error
  }
}

export async function listQuietPeriodEvents(pool, {
  environment = 'LIVE',
  limit = 200,
} = {}) {
  const env = envOf(environment)
  const cap = Math.min(500, Math.max(1, Number(limit) || 200))
  const events = await pool.query(
    `SELECT id, environment, kind, source_file, message, payload, occurred_at
       FROM fin.cutover_quiet_period_events
      WHERE environment = $1
      ORDER BY occurred_at DESC
      LIMIT $2`,
    [env, cap],
  )
  const byKind = await pool.query(
    `SELECT kind, COUNT(*)::int AS count
       FROM fin.cutover_quiet_period_events
      WHERE environment = $1
      GROUP BY kind
      ORDER BY kind`,
    [env],
  )
  return { events: events.rows, by_kind: byKind.rows }
}
