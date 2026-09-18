/**
 * Scheduled-publish worker (AGT-PUB-007).
 *
 * Sweeps `scheduled_publications` for rows whose time has come and runs each
 * through the SAME submitPortalPublishingJob() the immediate publish path
 * uses. On success a 'weekly' row re-arms for +7 days (a light "keep it
 * fresh" re-post); a 'none' row terminates as 'published'. Failures stamp
 * 'failed' + last_error so the agent can see and reschedule.
 *
 * `startScheduledPublishJob()` runs it on an interval (unref'd so it never
 * holds the process open); `runScheduledPublishOnce()` is exported for tests
 * and manual admin runs.
 */

import { query } from '../db.js'
import { submitPortalPublishingJob } from '../lib/publishing/submit-job.js'
import logger from '../lib/logger.js'

export const SCHEDULED_PUBLISH_INTERVAL_MS = 60 * 1000 // 1 minute
const BATCH_SIZE = 25

function nextWeekly(from) {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString()
}

/** Fire every due scheduled publication once. Returns a log/observability summary. */
export async function runScheduledPublishOnce({ now = new Date(), submit = submitPortalPublishingJob } = {}) {
  const nowIso = now.toISOString()
  const due = await query(
    `SELECT id, property_id, agent_id, agency_id, portals, message, recurrence, scheduled_at, attempts
       FROM scheduled_publications
      WHERE status = 'pending' AND scheduled_at <= $1
      ORDER BY scheduled_at ASC
      LIMIT $2`,
    [nowIso, BATCH_SIZE],
  )

  let published = 0
  let failed = 0
  for (const row of due) {
    // Claim the row so a second worker tick can't double-fire it.
    const claimed = await query(
      `UPDATE scheduled_publications
          SET status = 'processing', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'pending'
        RETURNING id`,
      [row.id],
    )
    if (claimed.length === 0) continue

    try {
      const portals = Array.isArray(row.portals) ? row.portals : JSON.parse(row.portals || '[]')
      const result = await submit({
        propertyId: row.property_id,
        agentId: row.agent_id,
        agencyId: row.agency_id || null,
        portals,
        message: row.message || '',
      })
      const jobId = result?.jobId || result?.job?.id || null
      if (row.recurrence === 'weekly') {
        await query(
          `UPDATE scheduled_publications
              SET status = 'pending', job_id = $2, attempts = attempts + 1,
                  last_fired_at = CURRENT_TIMESTAMP, last_error = NULL,
                  scheduled_at = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1`,
          [row.id, jobId, nextWeekly(row.scheduled_at)],
        )
      } else {
        await query(
          `UPDATE scheduled_publications
              SET status = 'published', job_id = $2, attempts = attempts + 1,
                  last_fired_at = CURRENT_TIMESTAMP, last_error = NULL,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $1`,
          [row.id, jobId],
        )
      }
      published += 1
    } catch (err) {
      failed += 1
      await query(
        `UPDATE scheduled_publications
            SET status = 'failed', attempts = attempts + 1,
                last_error = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [row.id, String(err?.message || err).slice(0, 500)],
      )
      logger.error({ err: err?.message || String(err), scheduledId: row.id }, 'scheduled publish: single row failed')
    }
  }
  return { scanned: due.length, published, failed }
}

export function startScheduledPublishJob({ intervalMs = SCHEDULED_PUBLISH_INTERVAL_MS } = {}) {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const summary = await runScheduledPublishOnce()
      if (summary.published > 0 || summary.failed > 0) {
        logger.info(summary, 'scheduled-publish tick')
      }
    } catch (err) {
      logger.error({ err: err?.message || String(err) }, 'scheduled-publish tick failed')
    } finally {
      running = false
    }
  }
  const timer = setInterval(tick, intervalMs)
  if (typeof timer.unref === 'function') timer.unref()
  return timer
}
