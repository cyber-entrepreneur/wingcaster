/**
 * SLA stuck-requests reaper (Wave 5 Agent 6 / WF-05 + WF-06).
 *
 * REQUESTED fin.approval_requests for COMPARABLE_REMOVE / PRICE_REPORT_INCORPORATE
 * older than SLA_HOURS flip to status=dead_letter with public.audit_log type=sla_reaped.
 * Linked reports are expired so the queue stops waiting on a dead second-PA slot.
 */

import { randomUUID } from 'node:crypto'
import logger from '../lib/logger.js'
import { getPool } from '../persistence/postgres-adapter.js'
import { DEFAULT_SLA_HOURS } from '../modules/property-valuation/application/comparable-report-read-service.js'

export const SLA_STUCK_ACTION_KINDS = Object.freeze([
  'COMPARABLE_REMOVE',
  'PRICE_REPORT_INCORPORATE',
])

export const SLA_REAPED_AUDIT_TYPE = 'sla_reaped'
export const SLA_DEAD_LETTER_STATUS = 'dead_letter'

export function resolveSlaHours(override) {
  const n = Number(override ?? process.env.WF05_WF06_SLA_HOURS ?? DEFAULT_SLA_HOURS)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SLA_HOURS
}

/**
 * @param {object} [opts]
 * @param {import('pg').Pool} [opts.pool]
 * @param {string|Date} [opts.now]
 * @param {number} [opts.slaHours]
 * @param {number} [opts.limit]
 */
export async function runSlaStuckRequestsReaper({
  pool = getPool(),
  now = new Date(),
  slaHours = resolveSlaHours(),
  limit = 100,
} = {}) {
  const client = await pool.connect()
  const nowIso = now instanceof Date ? now.toISOString() : String(now)
  const cutoff = new Date(Date.parse(nowIso) - Number(slaHours) * 3600 * 1000).toISOString()

  const summary = {
    scanned: 0,
    reaped: 0,
    skipped: 0,
    ids: [],
    wf05: 0,
    wf06: 0,
    sla_hours: slaHours,
    cutoff,
  }

  try {
    await client.query('BEGIN')
    const due = await client.query(
      `SELECT id, action_kind, status, subject_id, payload, environment, created_at
         FROM fin.approval_requests
        WHERE status = 'REQUESTED'
          AND action_kind = ANY($1::text[])
          AND created_at <= $2::timestamptz
        ORDER BY created_at ASC, id ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED`,
      [SLA_STUCK_ACTION_KINDS, cutoff, limit],
    )
    summary.scanned = due.rows.length

    for (const row of due.rows) {
      const updated = await client.query(
        `UPDATE fin.approval_requests
            SET status = $2,
                updated_at = $3::timestamptz,
                payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object(
                  'sla_reaped_at', $3::text,
                  'sla_hours', $4::numeric
                )
          WHERE id = $1 AND status = 'REQUESTED'
          RETURNING id, action_kind, subject_id, payload`,
        [row.id, SLA_DEAD_LETTER_STATUS, nowIso, slaHours],
      )
      if (!updated.rowCount) {
        summary.skipped += 1
        continue
      }

      const reaped = updated.rows[0]
      const payload = reaped.payload || row.payload || {}
      const reportId = payload.report_id || payload.payload?.report_id || reaped.subject_id || null

      await client.query(
        `INSERT INTO public.audit_log (
           id, type, action, entity_type, entity_id, metadata, created_at, data
         ) VALUES (
           $1, $2, $2, 'approval_request', $3,
           $4::jsonb, $5::timestamptz, $4::jsonb
         )`,
        [
          randomUUID(),
          SLA_REAPED_AUDIT_TYPE,
          reaped.id,
          JSON.stringify({
            type: SLA_REAPED_AUDIT_TYPE,
            approval_request_id: reaped.id,
            action_kind: reaped.action_kind,
            report_id: reportId,
            sla_hours: slaHours,
            previous_status: 'REQUESTED',
            status: SLA_DEAD_LETTER_STATUS,
          }),
          nowIso,
        ],
      )

      if (reportId && reaped.action_kind === 'COMPARABLE_REMOVE') {
        await client.query(
          `UPDATE market_pricing.comparable_reports
              SET status = 'expired',
                  updated_at = $2::timestamptz,
                  approval_request_id = NULL,
                  data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                    'sla_reaped', true,
                    'sla_reaped_at', $2::text,
                    'approval_request_id', $1::text
                  )
            WHERE id = $3
              AND status IN ('remove_proposed', 'pending')`,
          [reaped.id, nowIso, reportId],
        ).catch(() => null)
        summary.wf05 += 1
      } else if (reportId && reaped.action_kind === 'PRICE_REPORT_INCORPORATE') {
        await client.query(
          `UPDATE market_pricing.agent_price_reports
              SET status = 'expired',
                  updated_at = $2::timestamptz,
                  approval_request_id = NULL,
                  data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                    'sla_reaped', true,
                    'sla_reaped_at', $2::text,
                    'approval_request_id', $1::text
                  )
            WHERE id = $3
              AND status IN ('pending_second_approval', 'pending_review')`,
          [reaped.id, nowIso, reportId],
        ).catch(() => null)
        summary.wf06 += 1
      }

      summary.reaped += 1
      summary.ids.push(reaped.id)
    }

    await client.query('COMMIT')
    return summary
  } catch (err) {
    await client.query('ROLLBACK').catch(() => null)
    logger.error({ err: err.message || String(err) }, 'sla_stuck_requests_reaper failed')
    throw err
  } finally {
    client.release()
  }
}

export default { runSlaStuckRequestsReaper, resolveSlaHours }
