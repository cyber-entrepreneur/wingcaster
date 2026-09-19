/**
 * PA-EXC-002 — unified exception item reads for index + detail surfaces.
 */
import { query } from '../../db.js'
import { EXCEPTION_TYPES } from './exceptions.js'

const TYPE_SET = new Set(EXCEPTION_TYPES.map((row) => row.type))

export function encodeExceptionId(type, sourceId) {
  return `${type}:${sourceId}`
}

export function parseExceptionId(raw) {
  const decoded = decodeURIComponent(String(raw || ''))
  const splitAt = decoded.indexOf(':')
  if (splitAt <= 0) return null
  const type = decoded.slice(0, splitAt)
  const sourceId = decoded.slice(splitAt + 1)
  if (!TYPE_SET.has(type) || !sourceId) return null
  return { type, sourceId }
}

function metaFor(type) {
  return EXCEPTION_TYPES.find((row) => row.type === type) || null
}

function itemRow({
  type,
  sourceId,
  createdAt,
  severity = 'MED',
  status = 'OPEN',
  tenantId = null,
  resourceType = null,
  resourceId = null,
  description = '',
}) {
  return {
    id: encodeExceptionId(type, sourceId),
    exception_type: type,
    source_id: sourceId,
    severity,
    status,
    tenant_id: tenantId,
    resource_type: resourceType,
    resource_id: resourceId,
    description,
    created_at: createdAt,
  }
}

async function listReconciliationDrift(environment, limit) {
  const rows = await query(
    `SELECT r.id AS source_id, r.created_at, r.action,
            d.entity_type, d.entity_id, d.expected, d.actual, d.delta,
            c.severity, c.check_code
       FROM fin.reconciliation_resolution r
       JOIN fin.reconciliation_drift d ON d.id = r.drift_id
       JOIN fin.reconciliation_checks c ON c.id = d.check_id
      WHERE r.environment = $1 AND r.resolved_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'RECONCILIATION_DRIFT',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: row.severity === 'CRITICAL' ? 'CRITICAL' : row.severity === 'HIGH' ? 'HIGH' : 'MED',
    resourceType: row.entity_type,
    resourceId: row.entity_id,
    description: `${row.check_code} drift (${row.action})`,
  }))
}

async function listUsageDlq(environment, limit) {
  const rows = await query(
    `SELECT id AS source_id, tenant_id, error_code, error_message, created_at
       FROM fin.usage_events_dlq
      WHERE environment = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'USAGE_DLQ',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'HIGH',
    tenantId: row.tenant_id,
    resourceType: 'USAGE_EVENT_DLQ',
    resourceId: row.source_id,
    description: `${row.error_code}: ${row.error_message}`,
  }))
}

async function listAuthDenied(environment, limit) {
  const rows = await query(
    `SELECT a.id AS source_id, a.holder_id, a.denial_code, a.created_at,
            h.tenant_id
       FROM fin.authorization_attempts a
       LEFT JOIN fin.holders h ON h.id = a.holder_id
      WHERE a.environment = $1 AND a.result = 'DENIED'
      ORDER BY a.created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'AUTH_DENIED',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'MED',
    tenantId: row.tenant_id,
    resourceType: 'HOLDER',
    resourceId: row.holder_id,
    description: row.denial_code || 'Authorization denied',
  }))
}

async function listHoldExpired(environment, limit) {
  const rows = await query(
    `SELECT id AS source_id, tenant_id, subject_type, subject_id, created_at
       FROM fin.holds
      WHERE environment = $1 AND status = 'EXPIRED'
      ORDER BY created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'HOLD_EXPIRED',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'MED',
    tenantId: row.tenant_id,
    resourceType: row.subject_type,
    resourceId: row.subject_id,
    description: 'Hold expired without release',
  }))
}

async function listLateUsage(environment, limit) {
  const rows = await query(
    `SELECT id AS source_id, tenant_id, late_class, rated_at AS created_at
       FROM fin.rated_usage
      WHERE environment = $1 AND late_class IN ('POST_INVOICE', 'CLOSED_ACCOUNTING')
      ORDER BY rated_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'LATE_USAGE',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'HIGH',
    tenantId: row.tenant_id,
    resourceType: 'RATED_USAGE',
    resourceId: row.source_id,
    description: `Late usage (${row.late_class})`,
  }))
}

async function listDunningOpen(environment, limit) {
  const rows = await query(
    `SELECT id AS source_id, tenant_id, invoice_id, status, created_at
       FROM fin.dunning_cases
      WHERE environment = $1
        AND status NOT IN ('CURED', 'WRITTEN_OFF', 'CANCELED')
      ORDER BY created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'DUNNING_OPEN',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'HIGH',
    tenantId: row.tenant_id,
    resourceType: 'DUNNING_CASE',
    resourceId: row.source_id,
    description: `Dunning case ${row.status}`,
  }))
}

async function listInvoiceOverdue(environment, limit) {
  const rows = await query(
    `SELECT id AS source_id, tenant_id, invoice_number, status, due_at, created_at
       FROM fin.invoices
      WHERE environment = $1 AND status IN ('ISSUED', 'PART_PAID')
        AND due_at IS NOT NULL AND due_at < NOW()
      ORDER BY due_at ASC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'INVOICE_OVERDUE',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'HIGH',
    tenantId: row.tenant_id,
    resourceType: 'INVOICE',
    resourceId: row.source_id,
    description: `Invoice ${row.invoice_number || row.source_id} overdue (${row.status})`,
  }))
}

async function listPaymentUnapplied(environment, limit) {
  const rows = await query(
    `SELECT billing_account_id AS source_id, tenant_id, balance_minor, currency,
            updated_at AS created_at
       FROM fin.unapplied_cash
      WHERE environment = $1 AND balance_minor > 0
      ORDER BY updated_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'PAYMENT_UNAPPLIED',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'MED',
    tenantId: row.tenant_id,
    resourceType: 'BILLING_ACCOUNT',
    resourceId: row.source_id,
    description: `Unapplied cash ${row.balance_minor} ${row.currency}`,
  }))
}

async function listApprovalPending(environment, limit) {
  const rows = await query(
    `SELECT id AS source_id, tenant_id, action_kind, status, created_at
       FROM fin.approval_requests
      WHERE environment = $1 AND status = 'REQUESTED'
      ORDER BY created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'APPROVAL_PENDING',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'MED',
    tenantId: row.tenant_id,
    resourceType: 'APPROVAL_REQUEST',
    resourceId: row.source_id,
    description: `Pending approval (${row.action_kind})`,
  }))
}

async function listPeriodCloseBlocked(environment, limit) {
  const rows = await query(
    `SELECT id AS source_id, status, created_at
       FROM fin.billing_periods
      WHERE environment = $1 AND status NOT IN ('OPEN', 'FINAL')
      ORDER BY created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'PERIOD_CLOSE_BLOCKED',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'CRITICAL',
    resourceType: 'BILLING_PERIOD',
    resourceId: row.source_id,
    description: `Billing period blocked (${row.status})`,
  }))
}

async function listEnvIsolation(environment, limit) {
  const rows = await query(
    `SELECT c.id AS source_id, c.check_code, c.severity, c.created_at
       FROM fin.reconciliation_checks c
      WHERE c.environment = $1 AND c.check_code = 'R016' AND c.result = 'DRIFT'
      ORDER BY c.created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'ENV_ISOLATION',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'CRITICAL',
    resourceType: 'RECONCILIATION_CHECK',
    resourceId: row.source_id,
    description: `${row.check_code} environment isolation drift`,
  }))
}

async function listIdempotencyInFlight(environment, limit) {
  const rows = await query(
    `SELECT id AS source_id, tenant_id, key, created_at
       FROM fin.idempotency_keys
      WHERE environment = $1 AND status = 'IN_FLIGHT'
      ORDER BY created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'IDEMPOTENCY_IN_FLIGHT',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'MED',
    tenantId: row.tenant_id,
    resourceType: 'IDEMPOTENCY_KEY',
    resourceId: row.source_id,
    description: `In-flight idempotency (${row.key || 'unknown'})`,
  }))
}

async function listTaxMismatch(environment, limit) {
  const rows = await query(
    `SELECT c.id AS source_id, c.check_code, c.severity, c.created_at
       FROM fin.reconciliation_checks c
      WHERE c.environment = $1 AND c.check_code = 'R073' AND c.result = 'DRIFT'
      ORDER BY c.created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'TAX_MISMATCH',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'HIGH',
    resourceType: 'RECONCILIATION_CHECK',
    resourceId: row.source_id,
    description: `${row.check_code} tax mismatch drift`,
  }))
}

async function listAccountingHardClosed(environment, limit) {
  const rows = await query(
    `SELECT id AS source_id, status, created_at
       FROM fin.accounting_periods
      WHERE environment = $1 AND status = 'HARD_CLOSED'
      ORDER BY created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'ACCOUNTING_HARD_CLOSED',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'CRITICAL',
    resourceType: 'ACCOUNTING_PERIOD',
    resourceId: row.source_id,
    description: 'Accounting period hard-closed',
  }))
}

async function listFacilityLimit(environment, limit) {
  const rows = await query(
    `SELECT a.id AS source_id, a.holder_id, a.created_at, h.tenant_id
       FROM fin.authorization_attempts a
       LEFT JOIN fin.holders h ON h.id = a.holder_id
      WHERE a.environment = $1 AND a.denial_code = 'FACILITY_LIMIT_EXCEEDED'
      ORDER BY a.created_at DESC
      LIMIT $2`,
    [environment, limit],
  )
  return rows.map((row) => itemRow({
    type: 'FACILITY_LIMIT',
    sourceId: row.source_id,
    createdAt: row.created_at,
    severity: 'MED',
    tenantId: row.tenant_id,
    resourceType: 'HOLDER',
    resourceId: row.holder_id,
    description: 'Facility limit exceeded',
  }))
}

const LISTERS = {
  RECONCILIATION_DRIFT: listReconciliationDrift,
  USAGE_DLQ: listUsageDlq,
  AUTH_DENIED: listAuthDenied,
  HOLD_EXPIRED: listHoldExpired,
  LATE_USAGE: listLateUsage,
  DUNNING_OPEN: listDunningOpen,
  INVOICE_OVERDUE: listInvoiceOverdue,
  PAYMENT_UNAPPLIED: listPaymentUnapplied,
  APPROVAL_PENDING: listApprovalPending,
  PERIOD_CLOSE_BLOCKED: listPeriodCloseBlocked,
  ENV_ISOLATION: listEnvIsolation,
  IDEMPOTENCY_IN_FLIGHT: listIdempotencyInFlight,
  TAX_MISMATCH: listTaxMismatch,
  ACCOUNTING_HARD_CLOSED: listAccountingHardClosed,
  FACILITY_LIMIT: listFacilityLimit,
}

export async function listExceptionItems({ environment, type, limit = 200 }) {
  const perTypeLimit = type ? limit : Math.max(20, Math.ceil(limit / 12))
  const types = type ? [type] : Object.keys(LISTERS)
  const chunks = await Promise.all(
    types
      .filter((key) => LISTERS[key])
      .map((key) => LISTERS[key](environment, perTypeLimit)),
  )
  const items = chunks.flat()
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return items.slice(0, limit)
}

async function loadPayload(type, environment, sourceId) {
  switch (type) {
    case 'RECONCILIATION_DRIFT': {
      const rows = await query(
        `SELECT r.*, d.entity_type, d.entity_id, d.expected, d.actual, d.delta,
                c.check_code, c.severity, c.run_id
           FROM fin.reconciliation_resolution r
           JOIN fin.reconciliation_drift d ON d.id = r.drift_id
           JOIN fin.reconciliation_checks c ON c.id = d.check_id
          WHERE r.environment = $1 AND r.id = $2`,
        [environment, sourceId],
      )
      return rows[0] || null
    }
    case 'USAGE_DLQ':
      return (await query(
        `SELECT * FROM fin.usage_events_dlq WHERE environment = $1 AND id = $2`,
        [environment, sourceId],
      ))[0] || null
    case 'AUTH_DENIED':
    case 'FACILITY_LIMIT':
      return (await query(
        `SELECT a.*, h.tenant_id
           FROM fin.authorization_attempts a
           LEFT JOIN fin.holders h ON h.id = a.holder_id
          WHERE a.environment = $1 AND a.id = $2`,
        [environment, sourceId],
      ))[0] || null
    case 'HOLD_EXPIRED':
      return (await query(
        `SELECT * FROM fin.holds WHERE environment = $1 AND id = $2`,
        [environment, sourceId],
      ))[0] || null
    case 'LATE_USAGE':
      return (await query(
        `SELECT * FROM fin.rated_usage WHERE environment = $1 AND id = $2`,
        [environment, sourceId],
      ))[0] || null
    case 'DUNNING_OPEN':
      return (await query(
        `SELECT * FROM fin.dunning_cases WHERE environment = $1 AND id = $2`,
        [environment, sourceId],
      ))[0] || null
    case 'INVOICE_OVERDUE':
      return (await query(
        `SELECT * FROM fin.invoices WHERE environment = $1 AND id = $2`,
        [environment, sourceId],
      ))[0] || null
    case 'PAYMENT_UNAPPLIED':
      return (await query(
        `SELECT * FROM fin.unapplied_cash
          WHERE environment = $1 AND billing_account_id = $2
          ORDER BY updated_at DESC
          LIMIT 1`,
        [environment, sourceId],
      ))[0] || null
    case 'APPROVAL_PENDING':
      return (await query(
        `SELECT * FROM fin.approval_requests WHERE environment = $1 AND id = $2`,
        [environment, sourceId],
      ))[0] || null
    case 'PERIOD_CLOSE_BLOCKED':
      return (await query(
        `SELECT * FROM fin.billing_periods WHERE environment = $1 AND id = $2`,
        [environment, sourceId],
      ))[0] || null
    case 'ENV_ISOLATION':
    case 'TAX_MISMATCH':
      return (await query(
        `SELECT * FROM fin.reconciliation_checks WHERE environment = $1 AND id = $2`,
        [environment, sourceId],
      ))[0] || null
    case 'IDEMPOTENCY_IN_FLIGHT':
      return (await query(
        `SELECT * FROM fin.idempotency_keys WHERE environment = $1 AND id = $2`,
        [environment, sourceId],
      ))[0] || null
    case 'ACCOUNTING_HARD_CLOSED':
      return (await query(
        `SELECT * FROM fin.accounting_periods WHERE environment = $1 AND id = $2`,
        [environment, sourceId],
      ))[0] || null
    default:
      return null
  }
}

export async function listExceptionNotes({ environment, type, sourceId }) {
  return query(
    `SELECT id, body, wont_fix, created_at, created_by_actor_type, created_by_actor_id
       FROM fin.exception_notes
      WHERE environment = $1 AND exception_type = $2 AND source_id = $3
      ORDER BY created_at DESC`,
    [environment, type, sourceId],
  )
}

export async function addExceptionNote({
  environment, type, sourceId, body, wontFix = false, actorType, actorId,
}) {
  const rows = await query(
    `INSERT INTO fin.exception_notes (
       environment, exception_type, source_id, body, wont_fix,
       created_by_actor_type, created_by_actor_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, body, wont_fix, created_at, created_by_actor_type, created_by_actor_id`,
    [environment, type, sourceId, body, wontFix, actorType || null, actorId || null],
  )
  return rows[0]
}

function relatedDrifts(type, payload) {
  if (!payload) return []
  if (type === 'RECONCILIATION_DRIFT' && payload.drift_id) {
    return [{ drift_id: payload.drift_id, check_code: payload.check_code, run_id: payload.run_id }]
  }
  if ((type === 'ENV_ISOLATION' || type === 'TAX_MISMATCH') && payload.id) {
    return [{ drift_id: payload.id, check_code: payload.check_code, run_id: payload.run_id }]
  }
  return []
}

export async function getExceptionDetail({ environment, id }) {
  const parsed = parseExceptionId(id)
  if (!parsed) return null
  const { type, sourceId } = parsed
  const meta = metaFor(type)
  if (!meta) return null

  const payload = await loadPayload(type, environment, sourceId)
  if (!payload) return null

  const items = await listExceptionItems({ environment, type, limit: 500 })
  const summary = items.find((row) => row.source_id === sourceId)
  const notes = await listExceptionNotes({ environment, type, sourceId })

  return {
    id: encodeExceptionId(type, sourceId),
    environment,
    exception_type: type,
    source_id: sourceId,
    severity: summary?.severity || 'MED',
    status: summary?.status || 'OPEN',
    tenant_id: summary?.tenant_id || payload.tenant_id || null,
    resource_type: summary?.resource_type || payload.entity_type || payload.subject_type || null,
    resource_id: summary?.resource_id || payload.entity_id || payload.subject_id || payload.id || null,
    description: summary?.description || type,
    created_at: summary?.created_at || payload.created_at || payload.rated_at || null,
    deferred: Boolean(meta.dl && !meta.resolve),
    resolve_command: meta.resolve,
    dl: meta.dl,
    payload,
    related_drifts: relatedDrifts(type, payload),
    notes,
  }
}
