/**
 * WF-05 bad-comparable report decisions (BE-CMR-02 / BE-CMR-05 / BE-CMR-08).
 *
 * Replaces the generic POST .../review tri-state with four decision endpoints.
 * High market-impact confirm-remove records REMOVE_PROPOSED via fin.approval_requests
 * and defers tombstone + recalculation until second approval.
 *
 * Agent 6 (bulk / undo / affected-valuations) should import shared helpers from this
 * module (`buildDecisionSnapshot`, `OPEN_DECISION_STATUSES`, `UNDO_GRACE_MS`, …).
 * Single-row confirm-remove / quarantine / reject / request-info live here as SoT.
 */

import { randomUUID, createHash } from 'node:crypto'
import {
  ELEVATION_HEADER,
  ELEVATION_TTL_SECONDS,
  verifyToken,
} from '../../../auth.js'
import { transaction } from '../../../db.js'
import { insertAudit, insertOutbox } from '../../../fin/ledger/write.js'
import { requestFingerprint } from '../../../fin/idempotency/fingerprint.js'
import { listUserAgencyMemberships } from '../../../tenant-authorization.js'
import { toFinEnvironment, normalizeClientEnv, WINGCASTER_ENV_HEADER } from '../../../lib/session-env.js'
import { Collections } from '../infrastructure/db.js'
import { MARKET_IMPACT_TIERS } from './market-impact-service.js'

export const COMPARABLE_REMOVE_ACTION_KIND = 'COMPARABLE_REMOVE'
export const COMPARABLE_REMOVE_WORKFLOW = 'WF-05'

export const WF05_DECISION_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED_REMOVED: 'confirmed_removed',
  CONFIRMED_QUARANTINED: 'confirmed_quarantined',
  REJECTED: 'rejected',
  AWAITING_INFO: 'awaiting_info',
  EXPIRED: 'expired',
  REMOVE_PROPOSED: 'remove_proposed',
})

export const DECISION_ERROR = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  OWN_CASE: 'OWN_CASE',
  ALREADY_DECIDED: 'ALREADY_DECIDED',
  INVALID_INPUT: 'INVALID_INPUT',
  STEP_UP_REQUIRED: 'STEP_UP_REQUIRED',
  ENV_REQUIRED: 'ENV_REQUIRED',
  RECALC_COMMITTED: 'RECALC_COMMITTED',
  UNDO_WINDOW_EXPIRED: 'UNDO_EXPIRED',
  UNDO_EXPIRED: 'UNDO_EXPIRED',
  TOKEN_CONSUMED: 'TOKEN_CONSUMED',
  SAME_REVIEWER: 'SAME_REVIEWER',
  NO_DECISION: 'NO_DECISION',
})

/** Alias for Agent 6 bulk/undo imports (PR #92). */
export const REPORT_ERROR = DECISION_ERROR

/** 5s queue-family undo grace (PA-MOD-001 / BE-CMR-09). */
export const UNDO_GRACE_MS = 5_000

export function issueUndoToken(nowIso = new Date().toISOString()) {
  const undo_token_id = randomUUID()
  const undo_expires_at = new Date(Date.parse(nowIso) + UNDO_GRACE_MS).toISOString()
  return { undo_token_id, undo_expires_at }
}


/** Statuses that still accept PA decisions (single + bulk). */
export const OPEN_DECISION_STATUSES = new Set(['pending'])

/** Terminal / in-flight decision statuses (cannot decide again). */
export const DECIDED_STATUSES = new Set([
  WF05_DECISION_STATUS.CONFIRMED_REMOVED,
  WF05_DECISION_STATUS.CONFIRMED_QUARANTINED,
  WF05_DECISION_STATUS.REJECTED,
  WF05_DECISION_STATUS.AWAITING_INFO,
  WF05_DECISION_STATUS.EXPIRED,
  WF05_DECISION_STATUS.REMOVE_PROPOSED,
  // legacy /review statuses
  'reviewed',
  'dismissed',
  'actioned',
])

export const REJECT_REASON_CODES = Object.freeze([
  'comparable_correct',
  'insufficient_evidence',
  'duplicate_resolved',
  'vexatious_pattern',
  'out_of_scope',
  'other',
])

export const REQUEST_INFO_REASON_CODES = Object.freeze([
  'need_sale_record',
  'need_portal_screenshot',
  'need_clearer_photos',
  'need_address_confirmation',
  'need_price_evidence',
  'other',
])

/**
 * Undo-compatible decision snapshot stored under `report.data.decision`.
 * Shared with Agent 6 undo / bulk so merge can keep one writer.
 */
export function buildDecisionSnapshot(report, {
  action,
  reason_code = null,
  notes = null,
  requested_evidence = null,
  actorId,
  decidedAt,
  recalc_job_id = null,
  extra = {},
} = {}) {
  return {
    action,
    reason_code,
    notes,
    requested_evidence: Array.isArray(requested_evidence) ? requested_evidence : null,
    previous_status: report.status,
    previous_notes: report.notes ?? report.decision_notes ?? null,
    previous_reviewed_by: report.reviewed_by ?? null,
    previous_reviewed_at: report.reviewed_at ?? null,
    previous_data: { ...(report.data || {}) },
    decided_by: actorId,
    decided_at: decidedAt,
    recalc_job_id,
    ...extra,
  }
}

export function summarizeReport(report) {
  const decision = (report?.decision && typeof report.decision === 'object'
    ? report.decision
    : null)
    || (report?.data?.decision && typeof report.data.decision === 'object'
      ? report.data.decision
      : null)
  return {
    id: report.id,
    status: report.status,
    reason_code: decision?.reason_code || report.decision_reason_code || null,
    notes: report.notes ?? report.decision_notes ?? null,
    reviewed_by: report.reviewed_by ?? null,
    reviewed_at: report.reviewed_at ?? null,
    requested_evidence: decision?.requested_evidence
      || report.requested_evidence
      || null,
  }
}

export function decisionError(code, message, httpStatus) {
  const status = httpStatus
    || (code === DECISION_ERROR.NOT_FOUND ? 404
      : code === DECISION_ERROR.OWN_CASE ? 403
        : code === DECISION_ERROR.INVALID_INPUT || code === DECISION_ERROR.ENV_REQUIRED ? 400
          : code === DECISION_ERROR.STEP_UP_REQUIRED ? 401
            : code === DECISION_ERROR.TOKEN_CONSUMED ? 410
              : 409)
  return new DecisionError(code, message || code, { httpStatus: status })
}

const MIGRATE_TO_ENDPOINTS = [
  'POST /api/admin/pricing/reports/:reportId/confirm-remove',
  'POST /api/admin/pricing/reports/:reportId/confirm-quarantine',
  'POST /api/admin/pricing/reports/:reportId/reject-as-invalid',
  'POST /api/admin/pricing/reports/:reportId/request-info',
]

export function goneReviewBody() {
  return {
    error: 'POST /api/admin/pricing/reports/:id/review is gone. Use WF-05 decision endpoints.',
    code: 'GONE',
    migrate_to: MIGRATE_TO_ENDPOINTS[0],
    migrate_to_endpoints: MIGRATE_TO_ENDPOINTS,
  }
}

export class DecisionError extends Error {
  constructor(code, message, { httpStatus = 400, extra = {} } = {}) {
    super(message)
    this.name = 'DecisionError'
    this.code = code
    this.httpStatus = httpStatus
    // Align with serviceError() so admin-routes sendServiceError reads either field.
    this.status = httpStatus
    this.extra = extra
  }

  toJSON() {
    return { error: this.message, code: this.code, ...this.extra }
  }
}

function asUuidOrNull(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))
    ? String(id)
    : null
}

function nowIso() {
  return new Date().toISOString()
}

function resolveDecisionEnv(req) {
  const header = req?.get?.(WINGCASTER_ENV_HEADER) || req?.headers?.[WINGCASTER_ENV_HEADER.toLowerCase()]
  if (header != null && String(header).trim() !== '') {
    return normalizeClientEnv(header)
  }
  if (req?.sessionEnv || req?.user?.env) {
    return normalizeClientEnv(req.sessionEnv || req.user.env)
  }
  throw new DecisionError(
    DECISION_ERROR.ENV_REQUIRED,
    'X-Wingcaster-Env header is required for pricing report decisions',
    { httpStatus: 400 },
  )
}

function assertPending(report) {
  const status = String(report?.status || '')
  if (status !== WF05_DECISION_STATUS.PENDING) {
    throw new DecisionError(
      DECISION_ERROR.ALREADY_DECIDED,
      `Report has already been ${status}`,
      { httpStatus: 409, extra: { status } },
    )
  }
}

/**
 * Require a recent step-up elevation (family pattern from requireElevated).
 * Responds via DecisionError with code STEP_UP_REQUIRED (and step_up_required
 * alias for the frontend modal).
 */
export function assertStepUp(req, { maxAgeSeconds = ELEVATION_TTL_SECONDS } = {}) {
  const fail = (message) => {
    throw new DecisionError(
      DECISION_ERROR.STEP_UP_REQUIRED,
      message,
      {
        httpStatus: 401,
        extra: { code: 'step_up_required', max_age_seconds: maxAgeSeconds },
      },
    )
  }

  if (!req.user?.id) return fail('Authentication required')
  const header = req.headers?.[ELEVATION_HEADER] || req.headers?.['x-elevated-token']
  if (!header) return fail('This action requires re-authentication')

  const raw = String(header).startsWith('Bearer ') ? String(header).slice(7) : String(header)
  const decoded = verifyToken(raw)
  if (!decoded || decoded.elevated !== true) return fail('This action requires re-authentication')
  if (decoded.id !== req.user.id) return fail('This action requires re-authentication')

  const elevationVersion = Number(decoded.token_version ?? 0)
  const sessionVersion = Number(req.user.token_version ?? 0)
  if (elevationVersion !== sessionVersion) return fail('This action requires re-authentication')

  const issuedAt = Number(decoded.iat ?? 0) * 1000
  if (!issuedAt || Date.now() - issuedAt > maxAgeSeconds * 1000) {
    return fail('Re-authentication has expired')
  }

  req.elevation = {
    issued_at: new Date(issuedAt).toISOString(),
    age_seconds: Math.floor((Date.now() - issuedAt) / 1000),
  }
}

export function createComparableReportDecisionService({
  dal,
  adapter,
  recalculationJobService,
  marketImpactService,
  logger,
  listMemberships = listUserAgencyMemberships,
  runTransaction = transaction,
  writeAuditFn = insertAudit,
  insertOutboxFn = insertOutbox,
  /** Test seam: throw after txn commit, before outbox dispatch. */
  afterCommitBeforeDispatch = null,
  now = () => Date.now(),
} = {}) {
  const nowIsoLocal = () => new Date(now()).toISOString()
  async function loadReport(reportId) {
    const report = await dal.findOne(
      Collections.COMPARABLE_REPORTS,
      (r) => r.id === reportId,
    )
    if (!report) {
      throw new DecisionError(DECISION_ERROR.NOT_FOUND, 'Report not found', { httpStatus: 404 })
    }
    return report
  }

  /**
   * is_own when PA is the reporter OR shares an agency with the comparable owner.
   */
  async function detectIsOwn(report, userId) {
    if (!userId || !report) return false
    if (report.reporter_id && String(report.reporter_id) === String(userId)) return true

    try {
      const memberships = await listMemberships(userId, { statuses: ['active'] })
      const agencyIds = new Set(
        (memberships || [])
          .map((m) => m.agency_id || m.agencyId)
          .filter(Boolean)
          .map(String),
      )
      if (!agencyIds.size) return false

      const type = report.comparable_type
      const comparableId = report.comparable_id

      if (type === 'internal' && adapter?.getPropertyById) {
        const property = await adapter.getPropertyById(comparableId)
        const ownerAgentId = property?.agent_id || property?.owner_id
        if (ownerAgentId && String(ownerAgentId) === String(userId)) return true
        if (property?.agency_id && agencyIds.has(String(property.agency_id))) return true
        if (ownerAgentId) {
          const ownerMemberships = await listMemberships(ownerAgentId, { statuses: ['active'] })
          if ((ownerMemberships || []).some((m) => agencyIds.has(String(m.agency_id || m.agencyId)))) {
            return true
          }
        }
      }

      if (type === 'external') {
        const ec = await dal.findOne(
          Collections.EXTERNAL_COMPARABLES,
          (row) => row.id === comparableId,
        )
        const owningAgency = ec?.data?.owning_agency_id || ec?.agency_id
        if (owningAgency && agencyIds.has(String(owningAgency))) return true
      }

      if (type === 'agent_report') {
        const apr = await dal.findOne(
          Collections.AGENT_PRICE_REPORTS,
          (row) => row.id === comparableId,
        )
        const ownerId = apr?.agent_id || apr?.reporter_id
        if (ownerId && String(ownerId) === String(userId)) return true
        if (ownerId) {
          const ownerMemberships = await listMemberships(ownerId, { statuses: ['active'] })
          if ((ownerMemberships || []).some((m) => agencyIds.has(String(m.agency_id || m.agencyId)))) {
            return true
          }
        }
      }
    } catch (err) {
      logger?.warn?.({ err: err.message, reportId: report.id }, 'is_own detection failed; treating as not own')
    }
    return false
  }

  async function assertNotOwn(report, userId) {
    const isOwn = await detectIsOwn(report, userId)
    if (isOwn) {
      throw new DecisionError(
        DECISION_ERROR.OWN_CASE,
        'You cannot decide a report you filed or that targets a comparable at your agency',
        { httpStatus: 403, extra: { is_own: true } },
      )
    }
    return false
  }

  async function tombstoneComparable(report, { quarantineHours = null } = {}) {
    const now = nowIsoLocal()
    const type = report.comparable_type
    const id = report.comparable_id

    if (type === 'external') {
      const existing = await dal.findOne(Collections.EXTERNAL_COMPARABLES, (r) => r.id === id)
      if (!existing) return null
      const nextStatus = quarantineHours != null ? 'quarantined' : 'removed'
      const quarantineUntil = quarantineHours != null
        ? new Date(Date.now() + Number(quarantineHours) * 3600 * 1000).toISOString()
        : null
      await dal.update(
        Collections.EXTERNAL_COMPARABLES,
        (r) => r.id === id,
        (r) => ({
          ...r,
          status: nextStatus,
          updated_at: now,
          data: {
            ...(r.data || {}),
            pricing_comparable_excluded: true,
            tombstoned_at: quarantineHours == null ? now : r.data?.tombstoned_at || null,
            quarantine_until: quarantineUntil,
            quarantine_hours: quarantineHours,
            tombstone_report_id: report.id,
          },
        }),
      )
      return { comparable_id: id, comparable_type: type, status: nextStatus, quarantine_until: quarantineUntil }
    }

    if (type === 'agent_report') {
      const existing = await dal.findOne(Collections.AGENT_PRICE_REPORTS, (r) => r.id === id)
      if (!existing) return null
      const quarantineUntil = quarantineHours != null
        ? new Date(Date.now() + Number(quarantineHours) * 3600 * 1000).toISOString()
        : null
      await dal.update(
        Collections.AGENT_PRICE_REPORTS,
        (r) => r.id === id,
        (r) => ({
          ...r,
          // verified reports re-enter the pool; exclude while removed/quarantined
          status: quarantineHours != null ? 'pending' : 'rejected',
          review_notes: quarantineHours != null
            ? `Quarantined via comparable report ${report.id}`
            : `Removed via comparable report ${report.id}`,
          updated_at: now,
          data: {
            ...(r.data || {}),
            pricing_comparable_excluded: true,
            tombstoned_at: quarantineHours == null ? now : null,
            quarantine_until: quarantineUntil,
            quarantine_hours: quarantineHours,
            tombstone_report_id: report.id,
            prior_status: r.status,
          },
        }),
      )
      return { comparable_id: id, comparable_type: type, quarantine_until: quarantineUntil }
    }

    if (type === 'internal' && adapter?.updateProperty) {
      await adapter.updateProperty(id, {
        data: {
          pricing_comparable_excluded: true,
          tombstoned_at: quarantineHours == null ? now : null,
          quarantine_until: quarantineHours != null
            ? new Date(Date.now() + Number(quarantineHours) * 3600 * 1000).toISOString()
            : null,
          tombstone_report_id: report.id,
        },
      })
      return { comparable_id: id, comparable_type: type }
    }

    // Soft-exclude via report data when we cannot mutate the comparable row.
    return { comparable_id: id, comparable_type: type, soft: true }
  }

  async function enqueueRecalcForProperties(propertyIds, requestedBy) {
    if (!recalculationJobService?.enqueue || !propertyIds?.length) return []
    const jobs = []
    for (const propertyId of propertyIds) {
      try {
        const job = await recalculationJobService.enqueue(
          { property_id: propertyId, force_recompute: true },
          requestedBy,
        )
        if (job) jobs.push(job)
      } catch (err) {
        logger?.warn?.({ err: err.message, propertyId }, 'Failed to enqueue recalculation for affected property')
      }
    }
    return jobs
  }

  async function writeDecisionAudit({
    environment,
    actorId,
    actorEmail,
    action,
    reportId,
    beforeState,
    afterState,
    reasonCode,
    approvalRequestId = null,
    client = null,
    strict = false,
  }) {
    const payload = {
      environment: toFinEnvironment(environment),
      actorType: 'USER',
      actorId: asUuidOrNull(actorId),
      actorEmail: actorEmail || 'pa@wingcaster',
      action,
      targetType: 'comparable_reports',
      targetId: asUuidOrNull(reportId),
      beforeState,
      afterState,
      reasonCode: reasonCode || action,
      approvalRequestId: asUuidOrNull(approvalRequestId),
      now: nowIsoLocal(),
    }
    try {
      if (client) {
        await writeAuditFn(client, payload)
      } else {
        await runTransaction(async (txClient) => {
          await writeAuditFn(txClient, payload)
        })
      }
    } catch (err) {
      if (strict) throw err
      // Unit / memory harnesses may lack fin schema — decisions must still commit.
      logger?.warn?.({ err: err.message, reportId, action }, 'PA-AUD-001 audit write skipped')
    }
  }

  /**
   * PA-AUD / #127-style audit_log row for every undo attempt (success + failure).
   * Failure of this insert surfaces 5xx with an alert-level log — never swallowed.
   */
  async function writeUndoAttemptAudit({
    report,
    actorId = null,
    outcome,
    previousDecision = null,
    undoTokenId = null,
    undoExpiresAt = null,
    requestIp = null,
    userAgent = null,
    client = null,
  }) {
    const row = {
      id: randomUUID(),
      agent_id: actorId || null,
      tenant_id: report?.agency_id || report?.data?.tenant_id || null,
      type: 'comparable_report_undo_attempt',
      action: 'comparable_report_undo_attempt',
      entity_type: 'comparable_report',
      entity_id: report.id,
      ip: requestIp || null,
      user_agent: userAgent || null,
      metadata: {
        previous_decision: previousDecision,
        undo_token_id: undoTokenId,
        outcome,
        request_ip: requestIp || null,
        user_agent: userAgent || null,
        undo_expires_at: undoExpiresAt,
        actor_user_id: actorId,
      },
      created_at: nowIsoLocal(),
      data: {},
    }
    try {
      if (client?.query && !dal?.insert) {
        await client.query(
          `INSERT INTO public.audit_log (
             id, agent_id, tenant_id, type, action, entity_type, entity_id,
             ip, user_agent, metadata, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
          [
            row.id,
            row.agent_id,
            row.tenant_id,
            row.type,
            row.action,
            row.entity_type,
            row.entity_id,
            row.ip,
            row.user_agent,
            JSON.stringify(row.metadata),
            row.created_at,
          ],
        )
      } else if (dal?.insert) {
        await dal.insert('audit_log', row)
      } else if (client?.query) {
        await client.query(
          `INSERT INTO public.audit_log (
             id, agent_id, tenant_id, type, action, entity_type, entity_id,
             ip, user_agent, metadata, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
          [
            row.id,
            row.agent_id,
            row.tenant_id,
            row.type,
            row.action,
            row.entity_type,
            row.entity_id,
            row.ip,
            row.user_agent,
            JSON.stringify(row.metadata),
            row.created_at,
          ],
        )
      } else {
        throw new Error('No audit_log writer available')
      }
      return row
    } catch (err) {
      logger?.error?.(
        { alert: true, err: err.message, reportId: report?.id, outcome },
        'comparable_report_undo_attempt audit insert failed',
      )
      throw new DecisionError(
        'AUDIT_WRITE_FAILED',
        'Undo audit write failed',
        { httpStatus: 500, extra: { code: 'AUDIT_WRITE_FAILED' } },
      )
    }
  }

  const COMPARABLE_REMOVED_OUTBOX_TOPIC = 'valuation.comparable_removed'

  async function writeComparableRemovedOutbox(client, {
    environment,
    reportId,
    comparableId,
    propertyIds,
    requestedBy,
    approvalRequestId,
  }) {
    const now = nowIsoLocal()
    const payload = {
      report_id: reportId,
      comparable_id: comparableId,
      property_ids: propertyIds || [],
      requested_by: requestedBy,
      approval_request_id: approvalRequestId,
    }
    const dedupeKey = `${COMPARABLE_REMOVED_OUTBOX_TOPIC}:${reportId}:${approvalRequestId || 'none'}`
    const base = {
      id: randomUUID(),
      topic: COMPARABLE_REMOVED_OUTBOX_TOPIC,
      dedupe_key: dedupeKey,
      payload,
      status: 'PENDING',
      dispatched_at: null,
      published_at: null,
    }
    const inserted = await insertOutboxFn(client, {
      environment: toFinEnvironment(environment),
      topic: COMPARABLE_REMOVED_OUTBOX_TOPIC,
      dedupeKey,
      payload,
      now,
      // Test seams may honour an explicit id
      id: base.id,
    })
    if (inserted && typeof inserted === 'object') {
      // Keep the same object reference so post-commit dispatch can mark it PUBLISHED
      // (unit tests assert on the outbox store entry identity).
      inserted.id = inserted.id || base.id
      inserted.topic = inserted.topic || base.topic
      inserted.dedupe_key = inserted.dedupe_key || base.dedupe_key
      inserted.payload = inserted.payload || base.payload
      inserted.status = inserted.status || 'PENDING'
      if (inserted.dispatched_at === undefined) inserted.dispatched_at = null
      if (inserted.published_at === undefined) inserted.published_at = null
      return inserted
    }
    return base
  }

  async function dispatchComparableRemovedOutbox({
    propertyIds,
    requestedBy,
    outboxRow = null,
    client = null,
  } = {}) {
    const jobs = await enqueueRecalcForProperties(propertyIds, requestedBy)
    const dispatchedAt = nowIsoLocal()
    if (outboxRow && typeof outboxRow === 'object') {
      outboxRow.dispatched_at = dispatchedAt
      outboxRow.published_at = dispatchedAt
      outboxRow.status = 'PUBLISHED'
    }
    if (client?.query && outboxRow?.id) {
      await client.query(
        `UPDATE fin.outbox_events
            SET status = 'PUBLISHED', published_at = $2::timestamptz, updated_at = $2::timestamptz
          WHERE id = $1 AND status = 'PENDING'`,
        [outboxRow.id, dispatchedAt],
      ).catch(() => null)
    }
    return jobs
  }

  async function createRemoveApprovalRequest({
    environment,
    actorId,
    report,
    notes,
    marketImpact,
  }) {
    const id = randomUUID()
    const now = nowIsoLocal()
    const payload = {
      workflow: COMPARABLE_REMOVE_WORKFLOW,
      decision: 'REMOVE_PROPOSED',
      report_id: report.id,
      comparable_id: report.comparable_id,
      comparable_type: report.comparable_type,
      notes: notes || null,
      market_impact: {
        tier: marketImpact.tier,
        valuations_affected: marketImpact.valuations_affected,
        pct_move_median: marketImpact.pct_move_median,
        pct_move_max: marketImpact.pct_move_max,
      },
      actor_summary: {
        submitter: actorId,
        submitted_at: now,
      },
    }
    const hash = requestFingerprint(payload)
    const finEnv = toFinEnvironment(environment)

    await runTransaction(async (client) => {
      await client.query(
        `INSERT INTO fin.approval_requests (
           id, environment, tenant_id, action_kind, status, subject_type, subject_id,
           payload_hash, payload, min_distinct_approvers,
           created_at, created_by_actor_type, created_by_actor_id, updated_at
         ) VALUES (
           $1, $2, NULL, $3, 'REQUESTED', 'comparable_reports', $4,
           $5, $6::jsonb, 1,
           $7::timestamptz, 'USER', $8, $7::timestamptz
         )`,
        [
          id,
          finEnv,
          COMPARABLE_REMOVE_ACTION_KIND,
          asUuidOrNull(report.id) || id,
          hash,
          JSON.stringify(payload),
          now,
          asUuidOrNull(actorId),
        ],
      )
    })

    return { id, payload }
  }

  async function patchReport(reportId, patch) {
    // Postgres fromRow flattens JSONB `data` onto the document root and drops
    // the nested `data` key. Merge patch.data fields at the root so toRow
    // persists them in the JSONB blob (a nested `data: { decision }` would
    // be double-wrapped and lost on the next read).
    await dal.update(
      Collections.COMPARABLE_REPORTS,
      (r) => r.id === reportId,
      (r) => {
        const { data: patchData, ...rest } = patch
        return {
          ...r,
          ...rest,
          ...(patchData && typeof patchData === 'object' ? patchData : {}),
          updated_at: nowIsoLocal(),
        }
      },
    )
    return loadReport(reportId)
  }

  async function confirmRemove({ req, reportId, notes }) {
    const env = resolveDecisionEnv(req)
    const report = await loadReport(reportId)
    assertPending(report)
    await assertNotOwn(report, req.user?.id)
    if (notes == null || String(notes).trim().length < 5) {
      throw new DecisionError(
        DECISION_ERROR.INVALID_INPUT,
        'notes are required (min 5 characters)',
        { httpStatus: 400 },
      )
    }

    const marketImpact = await marketImpactService.scoreComparable({
      comparableId: report.comparable_id,
      comparableType: report.comparable_type,
    })

    if (marketImpact.tier === MARKET_IMPACT_TIERS.HIGH) {
      assertStepUp(req)
      const approval = await createRemoveApprovalRequest({
        environment: env,
        actorId: req.user.id,
        report,
        notes,
        marketImpact,
      })
      const updated = await patchReport(reportId, {
        status: WF05_DECISION_STATUS.REMOVE_PROPOSED,
        decision_notes: notes ?? report.decision_notes ?? null,
        notes: notes !== undefined ? notes : report.notes,
        reviewed_by: req.user.id,
        reviewed_at: nowIsoLocal(),
        approval_request_id: approval.id,
        data: {
          decision: buildDecisionSnapshot(report, {
            action: 'remove_proposed',
            notes: notes ?? null,
            actorId: req.user.id,
            decidedAt: nowIsoLocal(),
            extra: {
              env,
              market_impact: marketImpact,
              approval_request_id: approval.id,
              recalc_deferred: true,
              decision_label: 'REMOVE_PROPOSED',
            },
          }),
        },
      })
      await writeDecisionAudit({
        environment: env,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'COMPARABLE_REPORT_REMOVE_PROPOSED',
        reportId,
        beforeState: { status: report.status },
        afterState: {
          status: updated.status,
          approval_request_id: approval.id,
          market_impact: marketImpact,
        },
        reasonCode: 'REMOVE_PROPOSED',
        approvalRequestId: approval.id,
      })
      return {
        httpStatus: 202,
        body: {
          success: true,
          decision: 'REMOVE_PROPOSED',
          status: WF05_DECISION_STATUS.REMOVE_PROPOSED,
          pending_second_approval: true,
          approval_request_id: approval.id,
          market_impact: {
            tier: marketImpact.tier,
            valuations_affected: marketImpact.valuations_affected,
            pct_move_median: marketImpact.pct_move_median,
            pct_move_max: marketImpact.pct_move_max,
          },
          report: updated,
          recalculation_deferred: true,
        },
      }
    }

    const decidedAt = nowIsoLocal()
    const undo = issueUndoToken(decidedAt)
    const tombstone = await tombstoneComparable(report)
    const jobs = await enqueueRecalcForProperties(
      marketImpact.affected_property_ids,
      req.user.id,
    )
    const updated = await patchReport(reportId, {
      status: WF05_DECISION_STATUS.CONFIRMED_REMOVED,
      decision_notes: notes ?? null,
      notes: notes !== undefined ? notes : report.notes,
      reviewed_by: req.user.id,
      reviewed_at: decidedAt,
      data: {
        undo_token_id: undo.undo_token_id,
        undo_expires_at: undo.undo_expires_at,
        undo_consumed: false,
        decision: buildDecisionSnapshot(report, {
          action: 'confirm_remove',
          notes: notes ?? null,
          actorId: req.user.id,
          decidedAt,
          recalc_job_id: jobs[0]?.id || null,
          extra: {
            env,
            market_impact: marketImpact,
            tombstone,
            recalculation_job_ids: jobs.map((j) => j.id),
            decision_label: 'CONFIRM_REMOVE',
            undo_token_id: undo.undo_token_id,
            undo_expires_at: undo.undo_expires_at,
          },
        }),
      },
    })
    await writeDecisionAudit({
      environment: env,
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'COMPARABLE_REPORT_CONFIRMED_REMOVED',
      reportId,
      beforeState: { status: report.status },
      afterState: {
        status: updated.status,
        tombstone,
        recalculation_job_ids: jobs.map((j) => j.id),
      },
      reasonCode: 'CONFIRM_REMOVE',
    })
    return {
      httpStatus: 202,
      body: {
        success: true,
        decision: 'CONFIRM_REMOVE',
        status: WF05_DECISION_STATUS.CONFIRMED_REMOVED,
        market_impact: {
          tier: marketImpact.tier,
          valuations_affected: marketImpact.valuations_affected,
          pct_move_median: marketImpact.pct_move_median,
          pct_move_max: marketImpact.pct_move_max,
        },
        tombstone,
        recalculation_jobs: jobs.map((j) => ({ id: j.id, status: j.status })),
        valuations_affected: marketImpact.valuations_affected,
        undo_token_id: undo.undo_token_id,
        undo_expires_at: undo.undo_expires_at,
        report: updated,
      },
    }
  }

  async function confirmQuarantine({ req, reportId, notes, quarantineHours }) {
    const env = resolveDecisionEnv(req)
    const report = await loadReport(reportId)
    assertPending(report)
    await assertNotOwn(report, req.user?.id)

    let hours = quarantineHours == null || quarantineHours === '' ? 72 : Number(quarantineHours)
    if (!Number.isFinite(hours)) {
      throw new DecisionError(DECISION_ERROR.INVALID_INPUT, 'quarantine_hours must be a number', { httpStatus: 400 })
    }
    hours = Math.round(hours)
    if (hours < 24 || hours > 168) {
      throw new DecisionError(
        DECISION_ERROR.INVALID_INPUT,
        'quarantine_hours must be between 24 and 168',
        { httpStatus: 400 },
      )
    }

    const marketImpact = await marketImpactService.scoreComparable({
      comparableId: report.comparable_id,
      comparableType: report.comparable_type,
    })
    if (marketImpact.tier === MARKET_IMPACT_TIERS.HIGH) {
      assertStepUp(req)
    }

    const tombstone = await tombstoneComparable(report, { quarantineHours: hours })
    const quarantineUntil = tombstone?.quarantine_until
      || new Date(Date.now() + hours * 3600 * 1000).toISOString()

    const updated = await patchReport(reportId, {
      status: WF05_DECISION_STATUS.CONFIRMED_QUARANTINED,
      decision_notes: notes ?? null,
      notes: notes !== undefined ? notes : report.notes,
      quarantine_until: quarantineUntil,
      reviewed_by: req.user.id,
      reviewed_at: nowIsoLocal(),
      data: {
        decision: buildDecisionSnapshot(report, {
          action: 'confirm_quarantine',
          notes: notes ?? null,
          actorId: req.user.id,
          decidedAt: nowIsoLocal(),
          extra: {
            env,
            quarantine_hours: hours,
            quarantine_until: quarantineUntil,
            tombstone,
            decision_label: 'CONFIRM_QUARANTINE',
          },
        }),
      },
    })
    await writeDecisionAudit({
      environment: env,
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'COMPARABLE_REPORT_CONFIRMED_QUARANTINED',
      reportId,
      beforeState: { status: report.status },
      afterState: { status: updated.status, quarantine_hours: hours, quarantine_until: quarantineUntil },
      reasonCode: 'CONFIRM_QUARANTINE',
    })
    return {
      httpStatus: 200,
      body: {
        success: true,
        decision: 'CONFIRM_QUARANTINE',
        status: WF05_DECISION_STATUS.CONFIRMED_QUARANTINED,
        quarantine_hours: hours,
        quarantine_until: quarantineUntil,
        report: updated,
      },
    }
  }

  async function rejectAsInvalid({ req, reportId, reasonCode, notes }) {
    const env = resolveDecisionEnv(req)
    const report = await loadReport(reportId)
    assertPending(report)
    await assertNotOwn(report, req.user?.id)

    const code = String(reasonCode || '').trim()
    if (!code || !REJECT_REASON_CODES.includes(code)) {
      throw new DecisionError(
        DECISION_ERROR.INVALID_INPUT,
        `reason_code must be one of: ${REJECT_REASON_CODES.join(', ')}`,
        { httpStatus: 400 },
      )
    }
    if (notes == null || String(notes).trim().length < 5) {
      throw new DecisionError(
        DECISION_ERROR.INVALID_INPUT,
        'notes are required (min 5 characters)',
        { httpStatus: 400 },
      )
    }

    const updated = await patchReport(reportId, {
      status: WF05_DECISION_STATUS.REJECTED,
      decision_reason_code: code,
      decision_notes: String(notes).trim(),
      notes: String(notes).trim(),
      reviewed_by: req.user.id,
      reviewed_at: nowIsoLocal(),
      data: {
        decision: buildDecisionSnapshot(report, {
          action: 'reject_as_invalid',
          reason_code: code,
          notes: String(notes).trim(),
          actorId: req.user.id,
          decidedAt: nowIsoLocal(),
          extra: { env, decision_label: 'REJECT_AS_INVALID' },
        }),
      },
    })
    await writeDecisionAudit({
      environment: env,
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'COMPARABLE_REPORT_REJECTED',
      reportId,
      beforeState: { status: report.status },
      afterState: { status: updated.status, reason_code: code },
      reasonCode: code,
    })
    return {
      httpStatus: 200,
      body: {
        success: true,
        decision: 'REJECT_AS_INVALID',
        status: WF05_DECISION_STATUS.REJECTED,
        reason_code: code,
        report: updated,
      },
    }
  }

  async function requestInfo({ req, reportId, reasonCode, notes, requestedEvidence }) {
    const env = resolveDecisionEnv(req)
    const report = await loadReport(reportId)
    assertPending(report)
    await assertNotOwn(report, req.user?.id)

    const code = String(reasonCode || '').trim()
    if (!code || !REQUEST_INFO_REASON_CODES.includes(code)) {
      throw new DecisionError(
        DECISION_ERROR.INVALID_INPUT,
        `reason_code must be one of: ${REQUEST_INFO_REASON_CODES.join(', ')}`,
        { httpStatus: 400 },
      )
    }
    if (notes == null || String(notes).trim().length < 5) {
      throw new DecisionError(
        DECISION_ERROR.INVALID_INPUT,
        'notes are required (min 5 characters)',
        { httpStatus: 400 },
      )
    }
    const evidence = Array.isArray(requestedEvidence)
      ? requestedEvidence.map((item) => String(item))
      : []

    const updated = await patchReport(reportId, {
      status: WF05_DECISION_STATUS.AWAITING_INFO,
      decision_reason_code: code,
      decision_notes: String(notes).trim(),
      notes: String(notes).trim(),
      requested_evidence: evidence,
      reviewed_by: req.user.id,
      reviewed_at: nowIsoLocal(),
      data: {
        decision: buildDecisionSnapshot(report, {
          action: 'request_info',
          reason_code: code,
          notes: String(notes).trim(),
          requested_evidence: evidence,
          actorId: req.user.id,
          decidedAt: nowIsoLocal(),
          extra: { env, decision_label: 'REQUEST_INFO' },
        }),
      },
    })
    await writeDecisionAudit({
      environment: env,
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'COMPARABLE_REPORT_AWAITING_INFO',
      reportId,
      beforeState: { status: report.status },
      afterState: { status: updated.status, reason_code: code, requested_evidence: evidence },
      reasonCode: code,
    })
    return {
      httpStatus: 200,
      body: {
        success: true,
        decision: 'REQUEST_INFO',
        status: WF05_DECISION_STATUS.AWAITING_INFO,
        reason_code: code,
        requested_evidence: evidence,
        report: updated,
      },
    }
  }


  const RECALC_COMMITTED_STATUSES = new Set([
    'running', 'completed', 'completed_with_errors', 'failed', 'cancelled',
  ])

  async function applyRejectAsInvalid(report, { reason_code, notes, actorId, req } = {}) {
    const syntheticReq = req || {
      user: { id: actorId, env: 'live' },
      get: (name) => (String(name).toLowerCase() === WINGCASTER_ENV_HEADER.toLowerCase() ? 'live' : null),
      headers: { [WINGCASTER_ENV_HEADER.toLowerCase()]: 'live' },
      sessionEnv: 'live',
    }
    return rejectAsInvalid({
      req: syntheticReq,
      reportId: report.id,
      reasonCode: reason_code,
      notes,
    })
  }

  async function applyRequestInfo(report, {
    reason_code, notes, requested_evidence = [], actorId, req,
  } = {}) {
    const syntheticReq = req || {
      user: { id: actorId, env: 'live' },
      get: (name) => (String(name).toLowerCase() === WINGCASTER_ENV_HEADER.toLowerCase() ? 'live' : null),
      headers: { [WINGCASTER_ENV_HEADER.toLowerCase()]: 'live' },
      sessionEnv: 'live',
    }
    return requestInfo({
      req: syntheticReq,
      reportId: report.id,
      reasonCode: reason_code,
      notes,
      requestedEvidence: requested_evidence,
    })
  }

  async function bulkApply(reportIds, mutator) {
    const ids = Array.isArray(reportIds)
      ? [...new Set(reportIds.filter((id) => typeof id === 'string' && id.trim()))]
      : []
    if (!ids.length) throw decisionError(REPORT_ERROR.INVALID_INPUT, 'report_ids is required')
    const succeeded = []
    const failed = []
    for (const id of ids) {
      try {
        let report
        try { report = await loadReport(id) }
        catch (err) {
          if (err?.code === REPORT_ERROR.NOT_FOUND || err?.code === DECISION_ERROR.NOT_FOUND) {
            failed.push({ id, error: REPORT_ERROR.NOT_FOUND }); continue
          }
          throw err
        }
        const result = await mutator(report)
        const updated = result?.body?.report || result?.report || result
        if (!updated?.id) throw decisionError(REPORT_ERROR.INVALID_INPUT, 'Decision writer returned no report')
        succeeded.push(summarizeReport(updated))
      } catch (err) {
        failed.push({ id, error: err?.code || REPORT_ERROR.INVALID_INPUT })
      }
    }
    return { status: failed.length ? 207 : 200, body: { succeeded, failed } }
  }

  async function bulkRejectAsInvalid({ report_ids, reason_code, notes, actorId, req } = {}) {
    return bulkApply(report_ids, (report) => applyRejectAsInvalid(report, { reason_code, notes, actorId, req }))
  }

  async function bulkRequestInfo({ report_ids, reason_code, notes, requested_evidence, actorId, req } = {}) {
    return bulkApply(report_ids, (report) => applyRequestInfo(report, { reason_code, notes, requested_evidence, actorId, req }))
  }

  async function isRecalcCommitted(decision) {
    const jobId = decision?.recalc_job_id
    if (!jobId) return false
    if (!recalculationJobService?.get) return true
    const job = await recalculationJobService.get(jobId)
    if (!job) return false
    if (RECALC_COMMITTED_STATUSES.has(job.status)) return true
    return job.status !== 'queued'
  }

  async function undoDecision(reportId, {
    actorId = null,
    undoTokenId = null,
    requestIp = null,
    userAgent = null,
  } = {}) {
    const report = await loadReport(reportId)
    // fromRow flattens JSONB onto the document root; tolerate both shapes.
    const decision = (report.decision && typeof report.decision === 'object'
      ? report.decision
      : null)
      || (report.data?.decision && typeof report.data.decision === 'object'
        ? report.data.decision
        : null)
    const storedToken = report.undo_token_id
      || report.data?.undo_token_id
      || decision?.undo_token_id
      || null
    const expiresAt = report.undo_expires_at
      || report.data?.undo_expires_at
      || decision?.undo_expires_at
      || null
    const undoConsumed = Boolean(report.undo_consumed ?? report.data?.undo_consumed)

    const auditBase = {
      report,
      actorId,
      previousDecision: decision || null,
      undoTokenId: undoTokenId || storedToken,
      undoExpiresAt: expiresAt,
      requestIp,
      userAgent,
    }

    async function rejectWithAudit(outcome, err) {
      await writeUndoAttemptAudit({ ...auditBase, outcome })
      throw err
    }

    if (!decision?.decided_at) {
      await rejectWithAudit(
        'token_consumed',
        decisionError(REPORT_ERROR.TOKEN_CONSUMED, 'Undo token already consumed or no decision to undo', 410),
      )
    }
    if (await isRecalcCommitted(decision)) {
      await rejectWithAudit(
        'token_consumed',
        decisionError(REPORT_ERROR.RECALC_COMMITTED, 'Cannot undo — recalculation has committed', 409),
      )
    }
    if (report.reporter_id && actorId && String(report.reporter_id) === String(actorId)) {
      await rejectWithAudit(
        'own_case',
        decisionError(REPORT_ERROR.OWN_CASE, 'Cannot undo a comparable report you filed', 403),
      )
    }
    if (!storedToken) {
      // Legacy path: decided_at + grace window (bulk / pre-token decisions)
      const decidedMs = Date.parse(decision.decided_at)
      if (!Number.isFinite(decidedMs) || now() - decidedMs > UNDO_GRACE_MS) {
        await rejectWithAudit(
          'expired',
          decisionError(REPORT_ERROR.UNDO_EXPIRED, 'Undo grace window expired', 410),
        )
      }
    } else {
      if (undoConsumed) {
        await rejectWithAudit(
          'token_consumed',
          decisionError(REPORT_ERROR.TOKEN_CONSUMED, 'Undo token already consumed', 409),
        )
      }
      if (!undoTokenId || String(undoTokenId) !== String(storedToken)) {
        await rejectWithAudit(
          'token_consumed',
          decisionError(REPORT_ERROR.TOKEN_CONSUMED, 'Undo token already consumed or invalid', 409),
        )
      }
      const expMs = Date.parse(expiresAt || '')
      if (!Number.isFinite(expMs) || now() > expMs) {
        await rejectWithAudit(
          'expired',
          decisionError(REPORT_ERROR.UNDO_EXPIRED, 'Undo grace window expired', 410),
        )
      }
      if (actorId && decision.decided_by && String(decision.decided_by) !== String(actorId)) {
        await rejectWithAudit(
          'wrong_reviewer',
          decisionError(REPORT_ERROR.SAME_REVIEWER, 'Only the deciding reviewer can undo within the grace window', 409),
        )
      }
    }

    const previousData = { ...(decision.previous_data || {}) }
    delete previousData.decision
    delete previousData.undo_token_id
    delete previousData.undo_expires_at
    delete previousData.undo_consumed

    const restored = await runTransaction(async (client) => {
      await writeUndoAttemptAudit({ ...auditBase, outcome: 'reverted', client })
      const updated = await patchReport(reportId, {
        status: decision.previous_status || WF05_DECISION_STATUS.PENDING,
        notes: decision.previous_notes ?? null,
        decision_notes: decision.previous_notes ?? null,
        decision_reason_code: null,
        requested_evidence: null,
        reviewed_by: decision.previous_reviewed_by ?? null,
        reviewed_at: decision.previous_reviewed_at ?? null,
        approval_request_id: null,
        // Clear the decision snapshot; keep undo markers for TOKEN_CONSUMED.
        decision: null,
        data: {
          ...previousData,
          undo_consumed: true,
          undo_token_id: storedToken,
          undo_expires_at: expiresAt,
          decision: null,
        },
      })
      return updated
    })

    if (decision.recalc_job_id && recalculationJobService?.cancel) {
      try { await recalculationJobService.cancel(decision.recalc_job_id) } catch (err) {
        logger?.warn?.({ err: err.message, jobId: decision.recalc_job_id }, 'undo cancel failed')
      }
    }
    return summarizeReport(restored)
  }

async function listAffectedValuations(reportId, { page = 1, pageSize = 25 } = {}) {
    const report = await loadReport(reportId)
    const safePage = Math.max(1, Number(page) || 1)
    const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 25))
    const evidenceRows = await dal.findAll(
      Collections.ANALYSIS_COMPARABLE_EVIDENCE,
      (row) => row.comparable_id === report.comparable_id
        && (!report.comparable_type || row.comparable_type === report.comparable_type),
    )
    const byProperty = new Map()
    for (const row of evidenceRows || []) {
      byProperty.set(row.property_id, {
        property_id: row.property_id,
        comparable_id: row.comparable_id,
        comparable_type: row.comparable_type,
        similarity_score: row.similarity_score ?? null,
        weight: row.weight ?? null,
      })
    }
    const analyses = await dal.findAll(
      Collections.PROPERTY_PRICE_ANALYSES,
      (a) => Array.isArray(a.data?.comparables_used) && a.data.comparables_used.includes(report.comparable_id),
    )
    for (const analysis of analyses || []) {
      if (!byProperty.has(analysis.property_id)) {
        byProperty.set(analysis.property_id, {
          property_id: analysis.property_id,
          comparable_id: report.comparable_id,
          comparable_type: report.comparable_type,
          similarity_score: null,
          weight: null,
        })
      }
    }
    const propertyIds = [...byProperty.keys()].sort()
    const total = propertyIds.length
    const startIdx = (safePage - 1) * safeSize
    const pageIds = propertyIds.slice(startIdx, startIdx + safeSize)
    const items = []
    for (const propertyId of pageIds) {
      const hit = byProperty.get(propertyId)
      const analysis = await dal.findOne(Collections.PROPERTY_PRICE_ANALYSES, (a) => a.property_id === propertyId)
      let property = null
      if (adapter?.getPropertyById) property = await adapter.getPropertyById(propertyId)
      else property = await dal.findOne('properties', (row) => row.id === propertyId)
      items.push({
        property_id: propertyId,
        analysis_id: analysis?.id || null,
        title: property?.title || property?.name || null,
        city: property?.city || null,
        median_price: analysis?.median_price ?? null,
        similarity_score: hit.similarity_score,
        weight: hit.weight,
        comparable_id: hit.comparable_id,
        comparable_type: hit.comparable_type,
      })
    }
    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safeSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeSize) || 1),
      },
    }
  }


  async function finalizeApprovedRemoval({
    report,
    approvalRequestId,
    actorId,
    actorEmail,
    notes,
    env,
    enqueueRecalc = true,
    client = null,
    strictAudit = false,
  }) {
    const marketImpact = await marketImpactService.scoreComparable({
      comparableId: report.comparable_id,
      comparableType: report.comparable_type,
    })
    const tombstone = await tombstoneComparable(report)
    const jobs = enqueueRecalc
      ? await enqueueRecalcForProperties(marketImpact.affected_property_ids, actorId)
      : []
    const decidedAt = nowIsoLocal()
    const updated = await patchReport(report.id, {
      status: WF05_DECISION_STATUS.CONFIRMED_REMOVED,
      decision_notes: notes ?? report.decision_notes ?? null,
      notes: notes !== undefined && notes !== null ? notes : report.notes,
      reviewed_by: report.reviewed_by || actorId,
      reviewed_at: report.reviewed_at || decidedAt,
      approval_request_id: approvalRequestId,
      data: {
        decision: buildDecisionSnapshot(report, {
          action: 'confirm_remove',
          notes: notes ?? null,
          actorId,
          decidedAt,
          recalc_job_id: jobs[0]?.id || null,
          extra: {
            env,
            market_impact: marketImpact,
            tombstone,
            recalculation_job_ids: jobs.map((j) => j.id),
            recalculation_deferred: !enqueueRecalc,
            decision_label: 'CONFIRM_REMOVE',
            second_approver_id: actorId,
            second_approved_at: decidedAt,
            approval_request_id: approvalRequestId,
          },
        }),
      },
    })
    await writeDecisionAudit({
      environment: env,
      actorId,
      actorEmail,
      action: 'COMPARABLE_REPORT_CONFIRMED_REMOVED',
      reportId: report.id,
      beforeState: { status: report.status },
      afterState: {
        status: updated.status,
        tombstone,
        recalculation_job_ids: jobs.map((j) => j.id),
        recalculation_deferred: !enqueueRecalc,
        approval_request_id: approvalRequestId,
      },
      reasonCode: 'CONFIRM_REMOVE',
      approvalRequestId,
      client,
      strict: strictAudit,
    })
    return {
      report: updated,
      tombstone,
      jobs,
      marketImpact,
    }
  }

  async function castSecondApprovalVote({
    approvalRequestId,
    decision,
    notes = null,
    viewerId,
    viewerEmail = null,
    env: envInput = 'live',
  } = {}) {
    const env = normalizeClientEnv(envInput)
    const normalized = String(decision || '').trim().toLowerCase()
    if (normalized !== 'approve' && normalized !== 'decline') {
      throw decisionError(DECISION_ERROR.INVALID_INPUT, "decision must be 'approve' or 'decline'", 400)
    }
    if (!approvalRequestId) {
      throw decisionError(DECISION_ERROR.NOT_FOUND, 'Approval request not found', 404)
    }
    const report = await dal.findOne(
      Collections.COMPARABLE_REPORTS,
      (row) => String(row.approval_request_id || row.data?.approval_request_id || '') === String(approvalRequestId),
    )
    if (!report) {
      throw decisionError(DECISION_ERROR.NOT_FOUND, 'Approval request not found', 404)
    }
    if (report.reporter_id && viewerId && String(report.reporter_id) === String(viewerId)) {
      throw decisionError(DECISION_ERROR.OWN_CASE, 'Cannot vote on your own comparable report', 403)
    }
    if (report.status !== WF05_DECISION_STATUS.REMOVE_PROPOSED) {
      throw decisionError(DECISION_ERROR.TOKEN_CONSUMED, 'Approval request already resolved', 410)
    }
    if (report.reviewed_by && viewerId && String(report.reviewed_by) === String(viewerId)) {
      throw decisionError(DECISION_ERROR.SAME_REVIEWER, 'Same reviewer cannot cast the second vote', 409)
    }

    const now = nowIsoLocal()
    const actionDecision = normalized === 'approve' ? 'APPROVED' : 'REJECTED'
    const actionId = randomUUID()
    const actorUuid = asUuidOrNull(viewerId) || viewerId

    if (normalized === 'decline') {
      const updated = await runTransaction(async (client) => {
        await client.query(
          `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
           VALUES ($1, $2, $3, $4, $5::timestamptz)
           ON CONFLICT DO NOTHING`,
          [actionId, approvalRequestId, actorUuid, actionDecision, now],
        ).catch(() => null)
        await client.query(
          `UPDATE fin.approval_requests SET status = 'REJECTED', updated_at = $2::timestamptz WHERE id = $1`,
          [approvalRequestId, now],
        ).catch(() => null)
        const patched = await patchReport(report.id, {
          status: WF05_DECISION_STATUS.PENDING,
          approval_request_id: null,
          reviewed_by: null,
          reviewed_at: null,
          decision_notes: null,
          data: {
            ...(report.data || {}),
            decision: null,
            second_vote: {
              decision: 'decline',
              actor_id: viewerId,
              at: now,
              notes: notes || null,
            },
          },
        })
        await writeDecisionAudit({
          environment: env,
          actorId: viewerId,
          actorEmail: viewerEmail,
          action: 'COMPARABLE_REPORT_REMOVE_DECLINED',
          reportId: report.id,
          beforeState: { status: report.status },
          afterState: { status: patched.status },
          reasonCode: 'REMOVE_DECLINED',
          approvalRequestId,
          client,
          strict: true,
        })
        return patched
      })
      return {
        decision: 'decline',
        status: updated.status,
        report: updated,
        approval_request_id: approvalRequestId,
      }
    }

    // Option A: vote + status + finalize (tombstone/report/audit) + outbox in one txn.
    // Recalc enqueue runs after commit via outbox dispatch (retryable).
    let outboxRow = null
    const finalized = await runTransaction(async (client) => {
      await client.query(
        `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
         VALUES ($1, $2, $3, $4, $5::timestamptz)
         ON CONFLICT DO NOTHING`,
        [actionId, approvalRequestId, actorUuid, actionDecision, now],
      ).catch(() => null)
      await client.query(
        `UPDATE fin.approval_requests
            SET status = 'APPROVED', updated_at = $2::timestamptz, decided_at = $2::timestamptz
          WHERE id = $1`,
        [approvalRequestId, now],
      ).catch(() => null)

      const result = await finalizeApprovedRemoval({
        report,
        approvalRequestId,
        actorId: viewerId,
        actorEmail: viewerEmail,
        notes,
        env,
        enqueueRecalc: false,
        client,
        strictAudit: true,
      })

      outboxRow = await writeComparableRemovedOutbox(client, {
        environment: env,
        reportId: report.id,
        comparableId: report.comparable_id,
        propertyIds: result.marketImpact.affected_property_ids,
        requestedBy: viewerId,
        approvalRequestId,
      })
      return result
    })

    if (typeof afterCommitBeforeDispatch === 'function') {
      await afterCommitBeforeDispatch({
        outboxRow,
        report: finalized.report,
        marketImpact: finalized.marketImpact,
      })
    }

    const jobs = await dispatchComparableRemovedOutbox({
      propertyIds: finalized.marketImpact.affected_property_ids,
      requestedBy: viewerId,
      outboxRow,
    })

    return {
      decision: 'approve',
      status: WF05_DECISION_STATUS.CONFIRMED_REMOVED,
      report: finalized.report,
      tombstone: finalized.tombstone,
      recalculation_jobs: jobs.map((j) => ({ id: j.id, status: j.status })),
      valuations_affected: finalized.marketImpact.valuations_affected,
      approval_request_id: approvalRequestId,
      outbox: outboxRow
        ? {
            topic: outboxRow.topic || COMPARABLE_REMOVED_OUTBOX_TOPIC,
            status: outboxRow.status,
            dispatched_at: outboxRow.dispatched_at ?? null,
            published_at: outboxRow.published_at ?? null,
          }
        : null,
    }
  }

  async function recallProposal({ reportId, actorId, actorEmail = null, reason, env: envInput = 'live' } = {}) {
    const env = normalizeClientEnv(envInput)
    const trimmed = String(reason || '').trim()
    if (trimmed.length < 5) {
      throw decisionError(DECISION_ERROR.INVALID_INPUT, 'reason must be at least 5 characters', 400)
    }
    const report = await loadReport(reportId)
    if (report.status !== WF05_DECISION_STATUS.REMOVE_PROPOSED) {
      throw decisionError(DECISION_ERROR.ALREADY_DECIDED, 'No pending removal proposal to recall', 409)
    }
    if (!report.reviewed_by || String(report.reviewed_by) !== String(actorId)) {
      throw decisionError(DECISION_ERROR.SAME_REVIEWER, 'Only the proposing PA can recall this proposal', 403)
    }
    const approvalRequestId = report.approval_request_id || report.data?.approval_request_id || null
    const now = nowIsoLocal()
    if (approvalRequestId) {
      await runTransaction(async (client) => {
        await client.query(
          `UPDATE fin.approval_requests
              SET status = 'WITHDRAWN',
                  updated_at = $2::timestamptz,
                  withdrawn_at = $2::timestamptz,
                  withdrawn_by = $3,
                  withdrawal_reason = $4
            WHERE id = $1 AND status = 'REQUESTED'`,
          [approvalRequestId, now, asUuidOrNull(actorId), trimmed],
        ).catch(() => null)
      })
    }
    const updated = await patchReport(reportId, {
      status: WF05_DECISION_STATUS.PENDING,
      approval_request_id: null,
      reviewed_by: null,
      reviewed_at: null,
      decision_notes: null,
      data: {
        ...(report.data || {}),
        decision: null,
        recall: {
          by: actorId,
          at: now,
          reason: trimmed,
          approval_request_id: approvalRequestId,
        },
      },
    })
    await writeDecisionAudit({
      environment: env,
      actorId,
      actorEmail,
      action: 'COMPARABLE_REPORT_REMOVE_RECALLED',
      reportId,
      beforeState: { status: report.status, approval_request_id: approvalRequestId },
      afterState: { status: updated.status },
      reasonCode: 'REMOVE_RECALLED',
      approvalRequestId,
    })
    return { success: true, status: updated.status, report: updated }
  }

  return {
    detectIsOwn,
    isOwnCase: detectIsOwn,
    confirmRemove,
    confirmQuarantine,
    rejectAsInvalid,
    requestInfo,
    applyRejectAsInvalid,
    applyRequestInfo,
    bulkRejectAsInvalid,
    bulkRequestInfo,
    undoDecision,
    castSecondApprovalVote,
    recallProposal,
    finalizeApprovedRemoval,
    listAffectedValuations,
    isRecalcCommitted,
    buildDecisionSnapshot,
    summarizeReport,
    tombstoneComparable,
    enqueueRecalcForProperties,
    dispatchComparableRemovedOutbox,
    writeUndoAttemptAudit,
  }
}

/** Stable hash helper exported for tests. */
export function hashDecisionPayload(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}
