/**
 * WF-03 publishing stuck-job SLA reaper (#175).
 *
 * Incomplete publishing_jobs (completed_at IS NULL) older than SLA_HOURS are
 * claimed with FOR UPDATE SKIP LOCKED. Non-terminal destination rows
 * (distribution_jobs) flip to dead_letter with public.audit_log type=sla_reaped.
 *
 * Mirrors backend/src/workers/sla-stuck-requests-reaper.js (WF-05/WF-06).
 * publishing_jobs has no status column — "pending" ≡ completed_at IS NULL.
 */

import { randomUUID } from 'node:crypto'
import logger from '../lib/logger.js'
import { getPool } from '../persistence/postgres-adapter.js'

export const PUBLISHING_SLA_REAPED_AUDIT_TYPE = 'sla_reaped'
export const PUBLISHING_DEAD_LETTER_STATUS = 'dead_letter'

/** Destinations still mid-lifecycle — eligible for SLA reap. */
export const PUBLISHING_STUCK_DESTINATION_STATUSES = Object.freeze([
  'pending',
  'queued',
  'draft',
  'submitted',
  'pending_moderation',
  'in_review',
  'pending_retry',
])

const DEFAULT_PUBLISHING_SLA_HOURS = 24

export function resolvePublishingSlaHours(override) {
  const n = Number(override ?? process.env.WF03_PUBLISHING_SLA_HOURS ?? DEFAULT_PUBLISHING_SLA_HOURS)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PUBLISHING_SLA_HOURS
}

/**
 * @param {object} [opts]
 * @param {import('pg').Pool} [opts.pool]
 * @param {string|Date} [opts.now]
 * @param {number} [opts.slaHours]
 * @param {number} [opts.limit]
 */
export async function runPublishingStuckJobsReaper({
  pool = getPool(),
  now = new Date(),
  slaHours = resolvePublishingSlaHours(),
  limit = 100,
} = {}) {
  const client = await pool.connect()
  const nowIso = now instanceof Date ? now.toISOString() : String(now)
  const cutoff = new Date(Date.parse(nowIso) - Number(slaHours) * 3600 * 1000).toISOString()

  const summary = {
    scanned: 0,
    reaped_jobs: 0,
    reaped_destinations: 0,
    skipped: 0,
    job_ids: [],
    destination_ids: [],
    sla_hours: slaHours,
    cutoff,
  }

  try {
    await client.query('BEGIN')
    const due = await client.query(
      `SELECT id, property_id, agent_id, agency_id, submitted_at, created_at
         FROM public.publishing_jobs
        WHERE completed_at IS NULL
          AND COALESCE(submitted_at, created_at) <= $1::timestamptz
        ORDER BY COALESCE(submitted_at, created_at) ASC, id ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [cutoff, limit],
    )
    summary.scanned = due.rows.length

    for (const job of due.rows) {
      const dests = await client.query(
        `SELECT id, status, error_message, retry_count
           FROM public.distribution_jobs
          WHERE publishing_job_id = $1
            AND lower(COALESCE(status, '')) = ANY($2::text[])
          ORDER BY created_at ASC, id ASC
          FOR UPDATE SKIP LOCKED`,
        [job.id, [...PUBLISHING_STUCK_DESTINATION_STATUSES]],
      )

      if (!dests.rows.length) {
        // No stuck destinations left — stamp completed so we stop scanning.
        await client.query(
          `UPDATE public.publishing_jobs
              SET completed_at = COALESCE(completed_at, $2::timestamptz),
                  updated_at = $2::timestamptz,
                  data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                    'sla_reaped', true,
                    'sla_reaped_at', $2::text,
                    'aggregate', 'all_failed'
                  )
            WHERE id = $1 AND completed_at IS NULL`,
          [job.id, nowIso],
        )
        summary.skipped += 1
        continue
      }

      let jobReaped = false
      for (const dest of dests.rows) {
        const updated = await client.query(
          `UPDATE public.distribution_jobs
              SET status = $2,
                  updated_at = $3::timestamptz,
                  error_message = COALESCE(error_message, 'sla_reaped'),
                  data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                    'sla_reaped_at', $3::text,
                    'sla_hours', $4::numeric,
                    'previous_status', $5::text
                  )
            WHERE id = $1
              AND lower(COALESCE(status, '')) = ANY($6::text[])
            RETURNING id, status, publishing_job_id`,
          [
            dest.id,
            PUBLISHING_DEAD_LETTER_STATUS,
            nowIso,
            slaHours,
            dest.status,
            [...PUBLISHING_STUCK_DESTINATION_STATUSES],
          ],
        )
        if (!updated.rowCount) {
          summary.skipped += 1
          continue
        }

        await client.query(
          `INSERT INTO public.audit_log (
             id, agent_id, agency_id, type, action, entity_type, entity_id,
             metadata, created_at, data
           ) VALUES (
             $1, $2, $3, $4, $4, 'distribution_job', $5,
             $6::jsonb, $7::timestamptz, $6::jsonb
           )`,
          [
            randomUUID(),
            job.agent_id || null,
            job.agency_id || null,
            PUBLISHING_SLA_REAPED_AUDIT_TYPE,
            dest.id,
            JSON.stringify({
              type: PUBLISHING_SLA_REAPED_AUDIT_TYPE,
              distribution_job_id: dest.id,
              publishing_job_id: job.id,
              property_id: job.property_id || null,
              previous_status: dest.status,
              status: PUBLISHING_DEAD_LETTER_STATUS,
              sla_hours: slaHours,
            }),
            nowIso,
          ],
        )

        summary.reaped_destinations += 1
        summary.destination_ids.push(dest.id)
        jobReaped = true
      }

      if (jobReaped) {
        await client.query(
          `UPDATE public.publishing_jobs
              SET completed_at = COALESCE(completed_at, $2::timestamptz),
                  updated_at = $2::timestamptz,
                  data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                    'sla_reaped', true,
                    'sla_reaped_at', $2::text,
                    'aggregate', 'all_failed'
                  )
            WHERE id = $1`,
          [job.id, nowIso],
        )
        summary.reaped_jobs += 1
        summary.job_ids.push(job.id)
      }
    }

    await client.query('COMMIT')
    return summary
  } catch (err) {
    await client.query('ROLLBACK').catch(() => null)
    logger.error({ err: err.message || String(err) }, 'publishing_stuck_jobs_reaper failed')
    throw err
  } finally {
    client.release()
  }
}

/** Alias expected by WF-03 e2e harness. */
export async function tick(opts = {}) {
  return runPublishingStuckJobsReaper(opts)
}

export default { runPublishingStuckJobsReaper, resolvePublishingSlaHours, tick }
