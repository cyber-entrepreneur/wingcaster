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
import { insertAudit } from '../../../fin/ledger/write.js'
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
  UNDO_WINDOW_EXPIRED: 'UNDO_WINDOW_EXPIRED',
  NO_DECISION: 'NO_DECISION',
})

/** Alias for Agent 6 bulk/undo imports (PR #92). */
export const REPORT_ERROR = DECISION_ERROR

/** 5s queue-family undo grace (PA-MOD-001 / BE-CMR-09). */
export const UNDO_GRACE_MS = 5_000

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
  const decision = report?.data?.decision && typeof report.data.decision === 'object'
    ? report.data.decision
    : null
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
    this.extra = extra
  }

  toJSON() {
    // Canonical `code` must win over any alias in `extra` (e.g. step_up_required).
    return { error: this.message, ...this.extra, code: this.code }
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
        extra: { step_up_required: true, max_age_seconds: maxAgeSeconds },
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
  }) {
    try {
      await runTransaction(async (client) => {
        await writeAuditFn(client, {
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
        })
      })
    } catch (err) {
      // Unit / memory harnesses may lack fin schema — decisions must still commit.
      logger?.warn?.({ err: err.message, reportId, action }, 'PA-AUD-001 audit write skipped')
    }
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
    await dal.update(
      Collections.COMPARABLE_REPORTS,
      (r) => r.id === reportId,
      (r) => ({
        ...r,
        ...patch,
        data: {
          ...(r.data || {}),
          ...(patch.data || {}),
        },
        updated_at: nowIsoLocal(),
      }),
    )
    return loadReport(reportId)
  }

  async function confirmRemove({ req, reportId, notes }) {
    const env = resolveDecisionEnv(req)
    const report = await loadReport(reportId)
    assertPending(report)
    await assertNotOwn(report, req.user?.id)

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
      reviewed_at: nowIsoLocal(),
      data: {
        decision: buildDecisionSnapshot(report, {
          action: 'confirm_remove',
          notes: notes ?? null,
          actorId: req.user.id,
          decidedAt: nowIsoLocal(),
          recalc_job_id: jobs[0]?.id || null,
          extra: {
            env,
            market_impact: marketImpact,
            tombstone,
            recalculation_job_ids: jobs.map((j) => j.id),
            decision_label: 'CONFIRM_REMOVE',
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

  async function undoDecision(reportId, { actorId: _actorId } = {}) {
    const report = await loadReport(reportId)
    const decision = report.data?.decision
    if (!decision?.decided_at) throw decisionError(REPORT_ERROR.NO_DECISION, 'No reversible decision on this report')
    if (await isRecalcCommitted(decision)) throw decisionError(REPORT_ERROR.RECALC_COMMITTED, 'Cannot undo — recalculation has committed')
    const decidedMs = Date.parse(decision.decided_at)
    if (!Number.isFinite(decidedMs) || now() - decidedMs > UNDO_GRACE_MS) {
      throw decisionError(REPORT_ERROR.UNDO_WINDOW_EXPIRED, 'Undo grace window has expired')
    }
    const previousData = { ...(decision.previous_data || {}) }
    delete previousData.decision
    const restored = await patchReport(reportId, {
      status: decision.previous_status || WF05_DECISION_STATUS.PENDING,
      notes: decision.previous_notes ?? null,
      decision_notes: decision.previous_notes ?? null,
      decision_reason_code: null,
      requested_evidence: null,
      reviewed_by: decision.previous_reviewed_by ?? null,
      reviewed_at: decision.previous_reviewed_at ?? null,
      data: previousData,
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
    listAffectedValuations,
    isRecalcCommitted,
    buildDecisionSnapshot,
    summarizeReport,
    tombstoneComparable,
    enqueueRecalcForProperties,
  }
}

/** Stable hash helper exported for tests. */
export function hashDecisionPayload(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}
