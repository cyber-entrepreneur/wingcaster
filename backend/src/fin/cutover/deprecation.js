/**
 * Stage 13f commercial.* deprecation (DL-226..DL-232).
 * Operator-triggered DROP via migration 290a. No fin.* domain mutations.
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transaction } from '../../db.js'
import { BusinessClock } from '../clock.js'
import { CATEGORY, finError } from '../errors.js'
import { FIN_CUTOVER_DEPRECATE } from '../foundation/advisory-locks.js'
import { requestFingerprint } from '../idempotency/fingerprint.js'
import { claimIdempotency, completeIdempotency } from '../idempotency/claim.js'
import { insertAudit, insertOutbox } from '../ledger/write.js'
import { applyCutoverSession } from './activation.js'
import { readActiveEnvironment } from './mode.js'
import { logQuietPeriodEvent } from './quiet_period/logger.js'
import {
  QUIET_PERIOD_DAYS_REQUIRED,
  STAGE_13F_ATTESTATION_FRESH_DAYS,
  quietPeriodDaysElapsed,
} from './quiet_period/status.js'

const DROP_MIGRATION_FILENAME = '290a_fin_cutover_drop_commercial.sql'
const MIN_SNAPSHOT_NOTE_LENGTH = 20

function envOf(environment) {
  if (environment === 'TEST' || environment === 'LIVE') return environment
  return null
}

function iso(value) {
  if (!value) return BusinessClock.now()
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function validateSnapshotNote(snapshotNote) {
  const note = String(snapshotNote || '').trim()
  if (!note || note.length < MIN_SNAPSHOT_NOTE_LENGTH) {
    throw finError('SNAPSHOT_NOTE_REQUIRED', {
      category: CATEGORY.VALIDATION,
      httpStatus: 400,
      details: {
        min_length: MIN_SNAPSHOT_NOTE_LENGTH,
        hint: 'snapshot id, timestamp, and restore verification method',
      },
    })
  }
  return note
}

async function countCommercialTables(client) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n
       FROM pg_tables
      WHERE schemaname = 'commercial'`,
  )
  return rows[0]?.n || 0
}

async function countFksOutsideCommercial(client) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n
       FROM pg_constraint c
       JOIN pg_class rel ON rel.oid = c.conrelid
       JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
       JOIN pg_class frel ON frel.oid = c.confrelid
       JOIN pg_namespace fnsp ON fnsp.oid = frel.relnamespace
      WHERE c.contype = 'f'
        AND fnsp.nspname = 'commercial'
        AND nsp.nspname <> 'commercial'`,
  )
  return rows[0]?.n || 0
}

async function countWriteAttempts90d(client, environment, now) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n
       FROM fin.cutover_quiet_period_events
      WHERE environment = $1
        AND kind = 'COMMERCIAL_WRITE_ATTEMPT'
        AND occurred_at > $2::timestamptz - interval '90 days'
        AND occurred_at <= $2::timestamptz`,
    [environment, now],
  )
  return rows[0]?.n || 0
}

async function latestAttestationSignedAt(client, environment, now) {
  const { rows } = await client.query(
    `SELECT signed_at
       FROM fin.cutover_parity_attestations
      WHERE environment = $1
        AND signed_at >= $2::timestamptz - ($3::text || ' days')::interval
        AND signed_at <= $2::timestamptz
      ORDER BY signed_at DESC
      LIMIT 1`,
    [environment, now, String(STAGE_13F_ATTESTATION_FRESH_DAYS)],
  )
  return rows[0]?.signed_at || null
}

export async function loadDeprecationDropAudit(client, environment) {
  const { rows } = await client.query(
    `SELECT created_at, actor_email_snapshot
       FROM fin.financial_audit_events
      WHERE environment = $1
        AND action = 'FIN_CUTOVER_COMMERCIAL_DROPPED'
      ORDER BY created_at DESC
      LIMIT 1`,
    [environment],
  )
  if (!rows[0]) return { dropped_at: null, dropped_by_email: null }
  return {
    dropped_at: new Date(rows[0].created_at).toISOString(),
    dropped_by_email: rows[0].actor_email_snapshot || null,
  }
}

/**
 * Pure readiness JSON for the deprecation DROP gates.
 */
export async function computeDeprecationReadiness(pool, {
  environment = 'LIVE',
  now = null,
  snapshotNote = null,
} = {}) {
  const env = envOf(environment) || 'LIVE'
  const stamped = iso(now)
  const client = pool

  const active = await readActiveEnvironment(client, env)
  const mode = active?.mode || 'OFF'
  const activatedAt = mode === 'FIN_ONLY' && active?.activated_at
    ? new Date(active.activated_at).toISOString()
    : null
  const daysElapsed = activatedAt ? quietPeriodDaysElapsed(activatedAt, stamped) : null

  const writeAttempts90d = await countWriteAttempts90d(client, env, stamped)
  const commercialTables = await countCommercialTables(client)
  const fksOutside = await countFksOutsideCommercial(client)
  const attestationSignedAt = await latestAttestationSignedAt(client, env, stamped)

  const modeFinOnly = mode === 'FIN_ONLY'
  const quietPeriod90d = modeFinOnly
    && daysElapsed != null
    && daysElapsed >= QUIET_PERIOD_DAYS_REQUIRED
  const r097Clean90d = writeAttempts90d === 0
  const r099Fresh = Boolean(attestationSignedAt)
  const snapshotConfirmed = Boolean(String(snapshotNote || '').trim().length >= MIN_SNAPSHOT_NOTE_LENGTH)

  const gates = {
    mode_fin_only: modeFinOnly,
    quiet_period_90d: quietPeriod90d,
    r097_clean_90d: r097Clean90d,
    r099_fresh: r099Fresh,
    commercial_tables_remaining: commercialTables,
    fks_outside_commercial: fksOutside,
    snapshot_confirmed_by_operator: snapshotConfirmed,
  }

  const readyForDrop = modeFinOnly
    && quietPeriod90d
    && r097Clean90d
    && r099Fresh
    && commercialTables > 0
    && fksOutside === 0
    && snapshotConfirmed

  return { ready_for_drop: readyForDrop, gates }
}

/**
 * Operator-only: execute migration 290a and record audit/outbox (DL-227).
 */
export async function deprecateCommercial({
  environment,
  actor,
  snapshotNote,
  note = null,
  idempotencyKey = null,
  now = null,
} = {}) {
  const env = envOf(environment)
  if (!env) throw finError('ENV_MISMATCH', { category: CATEGORY.VALIDATION })

  const actorType = actor?.actorType || 'USER'
  const actorId = actor?.actorId || null
  const actorEmail = actor?.actorEmail || actor?.email
  if (!actorEmail) {
    throw finError('CUTOVER_DEPRECATE_ACTOR_EMAIL_REQUIRED', {
      category: CATEGORY.VALIDATION,
    })
  }

  const validatedSnapshot = validateSnapshotNote(snapshotNote)
  const stamped = iso(now || actor?.now)
  const claimKey = idempotencyKey || `CUTOVER:DEPRECATE:${env}:${stamped.slice(0, 10)}`

  const migrationsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', 'persistence', 'migrations',
  )
  const dropPath = join(migrationsDir, DROP_MIGRATION_FILENAME)
  const dropSql = await readFile(dropPath, 'utf8')

  return transaction(async (client) => {
    const locked = await client.query(
      'SELECT pg_try_advisory_lock($1, $2) AS ok',
      [FIN_CUTOVER_DEPRECATE, 0],
    )
    if (!locked.rows[0]?.ok) {
      throw finError('CUTOVER_DEPRECATE_IN_PROGRESS', {
        category: CATEGORY.CONFLICT,
        httpStatus: 409,
        retryable: true,
        retryAfter: 2,
      })
    }

    try {
      await applyCutoverSession(client, env)

      const claimed = await claimIdempotency(client, {
        environment: env,
        tenantId: null,
        key: claimKey,
        fingerprint: requestFingerprint({
          cmd: 'DeprecateCommercial',
          environment: env,
          snapshotNote: validatedSnapshot,
        }),
        now: stamped,
        actorType,
        actorId,
      })
      if (claimed.kind === 'replay') return claimed.row.response_body

      const readiness = await computeDeprecationReadiness(client, {
        environment: env,
        now: stamped,
        snapshotNote: validatedSnapshot,
      })
      if (!readiness.ready_for_drop) {
        throw finError('CUTOVER_DEPRECATION_NOT_READY', {
          category: CATEGORY.PRECONDITION,
          httpStatus: 409,
          details: readiness,
        })
      }

      const tablesBefore = readiness.gates.commercial_tables_remaining
      await client.query(dropSql)

      const tablesAfter = await countCommercialTables(client)
      const dropMeta = {
        environment: env,
        migration: DROP_MIGRATION_FILENAME,
        tables_dropped: tablesBefore,
        tables_remaining: tablesAfter,
        snapshot_note: validatedSnapshot,
        note: note || null,
        dropped_at: stamped,
        dropped_by_email: actorEmail,
      }

      await logQuietPeriodEvent(client, {
        kind: 'OTHER',
        environment: env,
        sourceFile: 'fin/cutover/deprecation.js',
        message: 'commercial schema tables dropped (Stage 13f)',
        payload: dropMeta,
        now: stamped,
      })

      await insertAudit(client, {
        environment: env,
        actorType,
        actorId,
        actorEmail,
        action: 'FIN_CUTOVER_COMMERCIAL_DROPPED',
        targetType: 'ENVIRONMENT',
        targetId: null,
        afterState: dropMeta,
        reasonCode: 'FIN_CUTOVER_COMMERCIAL_DROPPED',
        now: stamped,
      })

      await insertOutbox(client, {
        environment: env,
        topic: 'fin.cutover.commercial_dropped',
        dedupeKey: `cutover:commercial_dropped:${env}:${stamped}`,
        payload: dropMeta,
        now: stamped,
      })

      const body = {
        ok: true,
        environment: env,
        migration: DROP_MIGRATION_FILENAME,
        tables_dropped: tablesBefore,
        tables_remaining: tablesAfter,
        dropped_at: stamped,
        snapshot_note: validatedSnapshot,
      }
      await completeIdempotency(client, {
        id: claimed.row.id,
        now: stamped,
        body,
      })
      return body
    } finally {
      await client.query(
        'SELECT pg_advisory_unlock($1, $2)',
        [FIN_CUTOVER_DEPRECATE, 0],
      ).catch(() => {})
    }
  })
}
