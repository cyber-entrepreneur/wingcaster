/**
 * T5 — SIEM export + real-time audit stream (H5 v2).
 *
 * Two additions on top of H5's search endpoint:
 *
 *   1. Server-Sent Events (SSE) stream at
 *      `GET /api/audit/log/stream` — same filters as H5 search, but pushes
 *      new rows to connected clients as they land instead of requiring
 *      poll-and-diff.
 *
 *   2. `GET /api/audit/log.jsonl` — same rows as `log.csv` but emitted as
 *      JSON Lines. Every major SIEM (Datadog, Splunk, Elastic, Sumo Logic)
 *      ingests JSON Lines natively as a source file or via a fluentbit /
 *      vector forwarder.
 *
 * The SSE path is push-based via an in-memory subscriber list. Application
 * routes that write audit rows call `publishAuditEvent(row)` after their
 * INSERT so the stream stays in sync. A cross-node deployment would swap
 * this for pg_notify + LISTEN; the in-memory list is fine for single-node
 * or a load balancer with sticky sessions.
 */

import { EventEmitter } from 'node:events'
import { authMiddleware } from '../../auth.js'
import { query } from '../../db.js'
import logger from '../logger.js'

/**
 * In-process pub-sub for audit rows. Each subscriber is a
 * `{ agencyId | null, filters, write }` — `agencyId=null` means platform
 * admin who sees everything.
 */
const emitter = new EventEmitter()
emitter.setMaxListeners(200)

/**
 * Application code calls this AFTER inserting an audit_log row. Downstream
 * subscribers with matching filters get pushed the event. Failures never
 * fail the caller (audit writes are the real record; stream is a nice-to-
 * have).
 */
export function publishAuditEvent(row) {
  try {
    emitter.emit('audit', row)
  } catch (err) {
    logger.error({ err }, 'audit stream publish failed')
  }
}

function matchesFilters(row, filters) {
  if (!filters) return true
  if (filters.type && row.type !== filters.type) return false
  if (filters.entity_type && row.entity_type !== filters.entity_type) return false
  if (filters.entity_id && row.entity_id !== filters.entity_id) return false
  if (filters.actor_id && row.agent_id !== filters.actor_id) return false
  return true
}

function isPlatformAdmin(req) {
  return req.user?.platform_role === 'platform_admin' || req.user?.role === 'platform_admin'
}

async function resolveAllowedAgencyIds(userId, isAdmin) {
  if (isAdmin) return null
  const rows = await query(
    `SELECT agency_id FROM agency_members WHERE user_id = $1 AND status = 'active' AND role IN ('owner', 'admin')`,
    [userId],
  )
  return rows.map((r) => r.agency_id)
}

/**
 * Register the routes on the given Express app.
 *
 * @param {import('express').Express} app
 * @param {object} deps
 * @param {Function} [deps.authMiddleware]
 */
export function registerAuditSiemRoutes(app, deps = {}) {
  const auth = deps.authMiddleware || authMiddleware

  // ---------------------------------------------------------------------
  // Real-time stream (SSE)
  // ---------------------------------------------------------------------
  app.get('/api/audit/log/stream', auth, async (req, res) => {
    const isAdmin = isPlatformAdmin(req)
    const allowedAgencies = await resolveAllowedAgencyIds(req.user.id, isAdmin)

    // Explicit agency filter must still validate against caller allowlist
    // (H5 semantics). A cross-tenant probe returns 403.
    if (
      req.query.agency_id &&
      allowedAgencies !== null &&
      !allowedAgencies.includes(String(req.query.agency_id))
    ) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const filters = {
      type: req.query.type || null,
      entity_type: req.query.entity_type || null,
      entity_id: req.query.entity_id || null,
      actor_id: req.query.actor_id || null,
      agency_id: req.query.agency_id || null,
    }

    // SSE headers.
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // nginx: disable proxy buffering
    res.flushHeaders?.()

    // Initial event so clients know the stream is live.
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`)

    const listener = (row) => {
      try {
        // Agency-scoping: allowedAgencies=null (platform admin) sees all;
        // otherwise only rows whose agency_id is in the allowlist.
        if (allowedAgencies !== null) {
          if (!row.agency_id || !allowedAgencies.includes(row.agency_id)) return
        }
        if (filters.agency_id && row.agency_id !== filters.agency_id) return
        if (!matchesFilters(row, filters)) return
        res.write(`event: audit\ndata: ${JSON.stringify(row)}\n\n`)
      } catch (err) {
        // Broken response (client disconnected) → detach the listener so
        // we don't accumulate zombies.
        logger.debug({ err }, 'audit SSE listener write failed; detaching')
        emitter.off('audit', listener)
      }
    }
    emitter.on('audit', listener)

    // Heartbeat every 25s so long-idle connections don't time out at load
    // balancers.
    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n') } catch { /* client gone */ }
    }, 25_000)
    heartbeat.unref?.()

    req.on('close', () => {
      emitter.off('audit', listener)
      clearInterval(heartbeat)
    })
  })

  // ---------------------------------------------------------------------
  // JSON Lines export (SIEM-native)
  // ---------------------------------------------------------------------
  app.get('/api/audit/log.jsonl', auth, async (req, res, next) => {
    try {
      const isAdmin = isPlatformAdmin(req)
      const allowed = await resolveAllowedAgencyIds(req.user.id, isAdmin)
      if (req.query.agency_id && allowed !== null && !allowed.includes(String(req.query.agency_id))) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const where = []
      const params = []
      const push = (clause, ...vals) => {
        vals.forEach((v) => params.push(v))
        where.push(clause.replace(/\?/g, () => `$${params.length}`))
      }
      if (allowed !== null) {
        if (allowed.length === 0) push('FALSE')
        else push('agency_id = ANY(?::text[])', allowed)
      }
      if (req.query.type) push('type = ?', String(req.query.type))
      if (req.query.entity_type) push('entity_type = ?', String(req.query.entity_type))
      if (req.query.entity_id) push('entity_id = ?', String(req.query.entity_id))
      if (req.query.actor_id) push('agent_id = ?', String(req.query.actor_id))
      if (req.query.agency_id) push('agency_id = ?', String(req.query.agency_id))
      if (req.query.from) {
        const d = new Date(String(req.query.from))
        if (!Number.isNaN(d.getTime())) push('created_at >= ?::timestamptz', d.toISOString())
      }
      if (req.query.to) {
        const d = new Date(String(req.query.to))
        if (!Number.isNaN(d.getTime())) push('created_at <= ?::timestamptz', d.toISOString())
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const rows = await query(
        `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC LIMIT 10000`,
        params,
      )

      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.jsonl"`)
      res.setHeader('X-WingCaster-Audit-Rows', String(rows.length))
      // Datadog / Splunk / Elastic all accept `application/x-ndjson`.
      const body = rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')
      return res.status(200).send(body)
    } catch (err) {
      return next(err)
    }
  })
}

// Exported for tests.
export const __testables = {
  emitter,
  matchesFilters,
  resolveAllowedAgencyIds,
}
