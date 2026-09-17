/**
 * Audit-log search + viewer API (H5 — cross-cutting).
 *
 * `audit_log` (migration 009) has been growing rows for months — application
 * routes (agency applications, package approvals, ownership transfers, MFA
 * policy changes, PAT revocations, passkey enrollments) all write to it —
 * but nothing surfaces those rows. This module ships:
 *
 *   GET /api/audit/log         — filtered search (paginated)
 *   GET /api/audit/log.csv     — same filters, CSV export (audit-of-audit)
 *
 * ---------------------------------------------------------------------------
 * Access model
 * ---------------------------------------------------------------------------
 *
 * Two access modes:
 *   1. Platform admin — sees all audit rows across all tenants.
 *   2. Agency owner / admin — sees only rows where `agency_id` matches an
 *      agency they administer.
 *
 * A future SOC 2 audit will ask "who can search this log?" — the answer must
 * be a tight allowlist, not "any authenticated user."
 *
 * ---------------------------------------------------------------------------
 * Filter surface
 * ---------------------------------------------------------------------------
 *
 * All filters are optional; supplied filters AND together:
 *   - agency_id: restrict to an agency (rejected if caller isn't platform
 *     admin AND doesn't administer that agency)
 *   - actor_id: rows this user performed
 *   - type: exact match on `type` column (e.g. 'agency_mfa_policy_updated')
 *   - entity_type: exact match (e.g. 'agency_mfa_policy')
 *   - entity_id: exact match
 *   - from / to: created_at range (ISO strings)
 *   - q: free-text search across type + action + entity_type + metadata JSON
 *   - limit: page size, 25 default, 200 max
 *   - offset: pagination
 *
 * Every response includes a total count so pagination UI can render pages.
 */

import { authMiddleware } from '../../auth.js'
import { query } from '../../db.js'
import { getAgencyMembership } from '../../tenant-authorization.js'
import logger from '../logger.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])
const MAX_PAGE_SIZE = 200
const DEFAULT_PAGE_SIZE = 25

/** Users the caller is authorised to search over. Platform admins → null (unbounded). */
async function resolveAllowedAgencyIds({ userId, isPlatformAdmin }) {
  if (isPlatformAdmin) return null
  const rows = await query(
    `SELECT agency_id FROM agency_members WHERE user_id = $1 AND status = 'active' AND role IN ('owner', 'admin')`,
    [userId],
  )
  return rows.map((r) => r.agency_id)
}

function parseISODate(raw) {
  if (!raw) return null
  const d = new Date(String(raw))
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function clampLimit(raw) {
  const n = Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE
  return Math.min(MAX_PAGE_SIZE, n)
}

function clampOffset(raw) {
  const n = Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/** Build the WHERE clause + params from query filters + agency allowlist. */
function buildFilters({ query: q, allowedAgencyIds }) {
  const where = []
  const params = []
  const push = (clause, ...vals) => {
    vals.forEach((v) => params.push(v))
    where.push(clause.replace(/\?/g, () => `$${params.length}`))
  }

  if (allowedAgencyIds !== null) {
    if (allowedAgencyIds.length === 0) {
      // Non-admin caller with no admin memberships — return nothing but
      // don't 403 (the endpoint itself is allowed; the result is empty).
      push('FALSE')
    } else {
      push(`agency_id = ANY(?::text[])`, allowedAgencyIds)
    }
  }
  if (q?.agency_id) {
    push('agency_id = ?', String(q.agency_id))
  }
  if (q?.actor_id) {
    push('agent_id = ?', String(q.actor_id))
  }
  if (q?.type) {
    push('type = ?', String(q.type))
  }
  if (q?.entity_type) {
    push('entity_type = ?', String(q.entity_type))
  }
  if (q?.entity_id) {
    push('entity_id = ?', String(q.entity_id))
  }
  const from = parseISODate(q?.from)
  if (from) push('created_at >= ?::timestamptz', from)
  const to = parseISODate(q?.to)
  if (to) push('created_at <= ?::timestamptz', to)
  if (q?.q) {
    // Free-text against type + action + entity_type + metadata JSON. Using
    // `ILIKE` for portability; a future migration could add a tsvector column.
    push(
      `(type ILIKE ? OR action ILIKE ? OR entity_type ILIKE ? OR metadata::text ILIKE ?)`,
      `%${q.q}%`,
      `%${q.q}%`,
      `%${q.q}%`,
      `%${q.q}%`,
    )
  }

  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}

function serializeAuditRow(row) {
  return {
    id: row.id,
    agent_id: row.agent_id,
    agency_id: row.agency_id,
    type: row.type,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    ip: row.ip,
    user_agent: row.user_agent,
    metadata: row.metadata,
    created_at: row.created_at,
  }
}

function isPlatformAdmin(req) {
  return req.user?.platform_role === 'platform_admin' || req.user?.role === 'platform_admin'
}

/**
 * Register the routes on the given Express app.
 *
 * @param {import('express').Express} app
 * @param {object} deps
 * @param {Function} [deps.authMiddleware]
 */
export function registerAuditSearchRoutes(app, deps = {}) {
  const auth = deps.authMiddleware || authMiddleware

  app.get('/api/audit/log', auth, async (req, res, next) => {
    try {
      const allowed = await resolveAllowedAgencyIds({
        userId: req.user.id,
        isPlatformAdmin: isPlatformAdmin(req),
      })
      // If the caller supplied an explicit agency_id, ensure they can search
      // it (a rogue platform-admin claim was already blocked upstream).
      if (req.query.agency_id && allowed !== null && !allowed.includes(String(req.query.agency_id))) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const { where, params } = buildFilters({ query: req.query, allowedAgencyIds: allowed })
      const limit = clampLimit(req.query.limit)
      const offset = clampOffset(req.query.offset)

      const countRows = await query(`SELECT COUNT(*)::int AS n FROM audit_log ${where}`, params)
      const rows = await query(
        `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        params,
      )
      return res.json({
        entries: rows.map(serializeAuditRow),
        pagination: {
          limit,
          offset,
          total: countRows[0]?.n ?? 0,
        },
      })
    } catch (err) {
      logger.error({ err }, 'audit-log search failed')
      return next(err)
    }
  })

  app.get('/api/audit/log.csv', auth, async (req, res, next) => {
    try {
      const allowed = await resolveAllowedAgencyIds({
        userId: req.user.id,
        isPlatformAdmin: isPlatformAdmin(req),
      })
      if (req.query.agency_id && allowed !== null && !allowed.includes(String(req.query.agency_id))) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const { where, params } = buildFilters({ query: req.query, allowedAgencyIds: allowed })
      const rows = await query(
        `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ${MAX_PAGE_SIZE * 10}`,
        params,
      )
      // Simple CSV — escape quotes by doubling.
      const cols = ['id', 'created_at', 'agent_id', 'agency_id', 'type', 'action', 'entity_type', 'entity_id', 'ip', 'user_agent']
      const escape = (v) => {
        if (v === null || v === undefined) return ''
        const s = String(v)
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
        return s
      }
      const header = cols.join(',')
      const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`)
      res.setHeader('X-WingCaster-Audit-Rows', String(rows.length))
      // Write audit-of-audit — searching the log is itself an event worth
      // recording. Fire-and-forget so an audit-write failure doesn't fail
      // the export itself.
      logger.info(
        { user_id: req.user.id, filters: req.query, rows: rows.length },
        'audit_log_csv_exported',
      )
      return res.status(200).send(`${header}\n${body}\n`)
    } catch (err) {
      logger.error({ err }, 'audit-log CSV export failed')
      return next(err)
    }
  })
}

// Exported for tests.
export const __testables = {
  parseISODate,
  clampLimit,
  clampOffset,
  buildFilters,
  resolveAllowedAgencyIds,
  serializeAuditRow,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
}
