/**
 * Daily agency-application expiry worker (BE-BLOCKER-09).
 *
 * Pending applications whose `expires_at` is at or before `now` flip to
 * `expired`. Works against `public.agency_applications` when present, and
 * also against `legacy_collections` rows for collection='agency_applications'
 * during the BE-06 merge window.
 *
 * Idempotent: already-expired (or non-pending) rows are skipped.
 */

import logger from '../lib/logger.js'
import { query } from '../db.js'

export const AGENCY_APPLICATION_EXPIRY_DAYS = 30

/**
 * Compute the default expires_at for a new application.
 * @param {Date|string|number} [from]
 * @returns {string} ISO-8601 timestamp
 */
export function agencyApplicationExpiresAt(from = new Date()) {
  const base = from instanceof Date ? from : new Date(from)
  const d = new Date(base.getTime())
  d.setUTCDate(d.getUTCDate() + AGENCY_APPLICATION_EXPIRY_DAYS)
  return d.toISOString()
}

async function agencyApplicationsTableExists() {
  const { rows } = await query(
    `SELECT 1
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'agency_applications'
      LIMIT 1`,
  )
  return rows.length > 0
}

async function expireTypedTable(nowIso) {
  const due = await query(
    `SELECT id, status
       FROM public.agency_applications
      WHERE expires_at IS NOT NULL
        AND expires_at <= $1::timestamptz
        AND status IN ('pending', 'expired')`,
    [nowIso],
  )

  let expired = 0
  let skipped = 0
  for (const row of due.rows) {
    if (row.status === 'expired') {
      skipped += 1
      continue
    }
  }

  if (due.rows.some((r) => r.status === 'pending')) {
    const updated = await query(
      `UPDATE public.agency_applications
          SET status = 'expired',
              updated_at = $1::timestamptz,
              data = CASE
                WHEN data IS NULL THEN jsonb_build_object('status', 'expired', 'updated_at', $1::text)
                ELSE data || jsonb_build_object('status', 'expired', 'updated_at', $1::text)
              END
        WHERE status = 'pending'
          AND expires_at IS NOT NULL
          AND expires_at <= $1::timestamptz
        RETURNING id`,
      [nowIso],
    )
    expired = updated.rows.length
  }

  return { expired, skipped, scanned: due.rows.length }
}

async function expireLegacyCollections(nowIso) {
  const due = await query(
    `SELECT id, COALESCE(data->>'status', '') AS status
       FROM public.legacy_collections
      WHERE collection = 'agency_applications'
        AND (
          CASE
            WHEN data ? 'expires_at'
                 AND data->>'expires_at' IS NOT NULL
                 AND btrim(data->>'expires_at') <> ''
              THEN (data->>'expires_at')::timestamptz
            ELSE COALESCE(created_at, CURRENT_TIMESTAMP) + INTERVAL '30 days'
          END
        ) <= $1::timestamptz
        AND COALESCE(data->>'status', '') IN ('pending', 'expired')`,
    [nowIso],
  )

  let expired = 0
  let skipped = 0
  for (const row of due.rows) {
    if (row.status === 'expired') {
      skipped += 1
      continue
    }
  }

  if (due.rows.some((r) => r.status === 'pending')) {
    const updated = await query(
      `UPDATE public.legacy_collections
          SET data = data
                || jsonb_build_object(
                     'status', 'expired',
                     'updated_at', $1::text
                   ),
              updated_at = $1::timestamptz
        WHERE collection = 'agency_applications'
          AND COALESCE(data->>'status', '') = 'pending'
          AND (
            CASE
              WHEN data ? 'expires_at'
                   AND data->>'expires_at' IS NOT NULL
                   AND btrim(data->>'expires_at') <> ''
                THEN (data->>'expires_at')::timestamptz
              ELSE COALESCE(created_at, CURRENT_TIMESTAMP) + INTERVAL '30 days'
            END
          ) <= $1::timestamptz
        RETURNING id`,
      [nowIso],
    )
    expired = updated.rows.length
  }

  return { expired, skipped, scanned: due.rows.length }
}

/**
 * Run one daily tick: flip due pending agency applications to expired.
 *
 * @param {{ now?: Date|string|number }} [opts]
 * @returns {Promise<{ now: string, expired: number, skipped: number, scanned: number }>}
 */
export async function runAgencyApplicationExpiryTick(opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date()
  const nowIso = now.toISOString()

  let expired = 0
  let skipped = 0
  let scanned = 0

  try {
    if (await agencyApplicationsTableExists()) {
      const typed = await expireTypedTable(nowIso)
      expired += typed.expired
      skipped += typed.skipped
      scanned += typed.scanned
    }

    const legacy = await expireLegacyCollections(nowIso)
    expired += legacy.expired
    skipped += legacy.skipped
    scanned += legacy.scanned
  } catch (err) {
    logger.error(
      { err: err.message || String(err) },
      'agency application expiry tick failed',
    )
    throw err
  }

  if (expired > 0) {
    logger.info({ expired, skipped, scanned, now: nowIso }, 'agency application expiry tick')
  }

  return { now: nowIso, expired, skipped, scanned }
}
