/**
 * Shared submit gates for price / comparable reports (Wave 5 / PR #127).
 * Entitlement · daily rate limit · anti-dup · audit.
 *
 * Entitlement is a boolean package_feature_flags capability
 * (`valuation.price_reports.submit` on Pro / Pro Elite — migration 338).
 * It is intentionally NOT a metered_features row; do not route through
 * checkEntitlement (that helper requires metered_features registration).
 */

import { randomUUID } from 'node:crypto'
import { findAll, findOne, insert, query } from '../../../db.js'
import { resolveRequestCreditTenant } from '../../../lib/credits/tenant-context.js'
import { PRICE_REPORTS_SUBMIT_FEATURE_CODE } from '../../../lib/packages/registry.js'
import logger from '../../../lib/logger.js'

const OPEN_SUBSCRIPTION_STATUSES = Object.freeze([
  'PENDING_START',
  'ACTIVE',
  'PAUSED',
  'CANCELED_AT_PERIOD_END',
])

export const DEFAULT_DAILY_SUBMIT_CAP = 200
export const PRICE_REPORT_SUBJECT_DAILY_CAP = 3
export const UPSELL_URL = '/plans?highlight=wf06'

export const OPEN_COMPARABLE_STATUSES = Object.freeze([
  'pending',
  'in_review',
  'pending_review',
  'awaiting_info',
])

export const REPORTER_CONFIDENCE_VALUES = Object.freeze([
  'self_witnessed',
  'hearsay',
  'hard_evidence',
])

function featureNotEnabledBody() {
  return {
    error: 'FEATURE_NOT_ENABLED',
    code: 'FEATURE_NOT_ENABLED',
    required_capability: PRICE_REPORTS_SUBMIT_FEATURE_CODE,
    upsell_url: UPSELL_URL,
  }
}

/**
 * Package-flag entitlement for AGT-APR-004 / AGT-APR-005.
 * Enabled iff the tenant has an open subscription whose package_version
 * carries `valuation.price_reports.submit` with enabled=true.
 * Absence of the flag (Free / lower tiers) = disabled — matches migration 338.
 *
 * @returns {{ ok: true, tenant: object, entitlement: object } | { ok: false, status: number, body: object }}
 */
export async function requirePriceReportsSubmitEntitlement(req) {
  const tenant = resolveRequestCreditTenant(req)
  if (!tenant) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Authentication required', code: 'UNAUTHORIZED' },
    }
  }

  let flagEnabled = false
  try {
    const subRows = await query(
      `SELECT s.package_version_id
         FROM public.tenant_subscriptions s
        WHERE s.tenant_id = $1
          AND s.status = ANY($2::text[])
        LIMIT 1`,
      [tenant.creditTenantId, [...OPEN_SUBSCRIPTION_STATUSES]],
    )
    const subscription = subRows[0] || null
    if (subscription?.package_version_id) {
      const flagRows = await query(
        `SELECT enabled FROM public.package_feature_flags
          WHERE package_version_id = $1 AND feature_code = $2`,
        [subscription.package_version_id, PRICE_REPORTS_SUBMIT_FEATURE_CODE],
      )
      flagEnabled = Boolean(flagRows[0]?.enabled)
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'package_feature_flags lookup failed for price reports submit')
    return {
      ok: false,
      status: 403,
      body: featureNotEnabledBody(),
    }
  }

  if (!flagEnabled) {
    return {
      ok: false,
      status: 403,
      body: featureNotEnabledBody(),
    }
  }

  return {
    ok: true,
    tenant,
    entitlement: {
      enabled: true,
      registered: true,
      feature_code: PRICE_REPORTS_SUBMIT_FEATURE_CODE,
    },
  }
}

async function resolveDailyCap(req) {
  const agencyId = req.agent?.agency_id || null
  const userId = req.user?.id
  if (agencyId && userId) {
    try {
      const row = await findOne(
        'agency_ai_settings',
        (r) => r.agency_id === agencyId && r.user_id === userId,
      )
      if (row && Number(row.daily_cap) > 0) return Number(row.daily_cap)
    } catch {
      /* collection may be missing in unit tests — fall through */
    }
    // Postgres path when memory DAL lacks the collection.
    try {
      const rows = await query(
        `SELECT daily_cap FROM public.agency_ai_settings
          WHERE agency_id = $1 AND user_id = $2 LIMIT 1`,
        [agencyId, userId],
      )
      if (rows[0] && Number(rows[0].daily_cap) > 0) return Number(rows[0].daily_cap)
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_DAILY_SUBMIT_CAP
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

async function safeFindAll(dal, collection, filter) {
  const find = typeof dal?.findAll === 'function' ? dal.findAll.bind(dal) : findAll
  try {
    const rows = await find(collection, filter)
    return Array.isArray(rows) ? rows : []
  } catch (err) {
    const message = String(err?.message || err || '')
    // Memory-DAL test harness may omit collections; treat as empty.
    if (/unknown collection|not found|ENOENT|no such table/i.test(message)) {
      return []
    }
    const wrapped = new Error('SUBMIT_GUARD_LOOKUP_FAILED')
    wrapped.code = 'SUBMIT_GUARD_LOOKUP_FAILED'
    wrapped.cause = err
    throw wrapped
  }
}

/**
 * Count today's comparable + price-report submissions for the user.
 */
export async function countTodaySubmissions(userId, dal) {
  const start = startOfUtcDay()
  const startIso = start.toISOString()

  const [comparables, priceReports] = await Promise.all([
    safeFindAll(dal, 'comparable_reports', (r) => r.reporter_id === userId && r.created_at >= startIso),
    safeFindAll(dal, 'agent_price_reports', (r) => r.reporter_id === userId && r.created_at >= startIso),
  ])
  return {
    used: comparables.length + priceReports.length,
    startIso,
  }
}

/**
 * @returns {{ ok: true, daily_quota: number, used: number } | { ok: false, status: number, body: object }}
 */
export async function enforceDailySubmitRateLimit(req, dal) {
  const dailyQuota = await resolveDailyCap(req)
  const { used } = await countTodaySubmissions(req.user.id, dal)
  if (used >= dailyQuota) {
    const tomorrow = startOfUtcDay(new Date(Date.now() + 24 * 60 * 60 * 1000))
    const retryAfterSeconds = Math.max(1, Math.ceil((tomorrow.getTime() - Date.now()) / 1000))
    return {
      ok: false,
      status: 429,
      body: {
        error: 'RATE_LIMITED',
        code: 'RATE_LIMITED',
        retry_after_seconds: retryAfterSeconds,
        daily_quota: dailyQuota,
        used,
      },
    }
  }
  return { ok: true, daily_quota: dailyQuota, used }
}

/**
 * Anti-dup for bad-comparable reports.
 * @returns {{ ok: true } | { ok: false, status: number, body: object }}
 */
export async function assertNoOpenComparableDuplicate({ reporterId, comparableId, dal }) {
  const open = await safeFindAll(
    dal,
    'comparable_reports',
    (r) =>
      r.reporter_id === reporterId &&
      r.comparable_id === comparableId &&
      OPEN_COMPARABLE_STATUSES.includes(r.status),
  )
  if (open.length > 0) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'DUPLICATE_REPORT',
        code: 'DUPLICATE_REPORT',
        existing_report_id: open[0].id,
      },
    }
  }
  return { ok: true }
}

/**
 * Cap 3/day per subject listing (property_id or external title key).
 */
export async function assertPriceReportSubjectDailyCap({
  reporterId,
  propertyId,
  externalTitle,
  dal,
}) {
  const startIso = startOfUtcDay().toISOString()
  const subjectKey = propertyId
    ? `property:${propertyId}`
    : externalTitle
      ? `external:${String(externalTitle).trim().toLowerCase()}`
      : null
  if (!subjectKey) return { ok: true }

  const todays = await safeFindAll(
    dal,
    'agent_price_reports',
    (r) => {
      if (r.reporter_id !== reporterId || !(r.created_at >= startIso)) return false
      if (propertyId) return r.property_id === propertyId
      return (
        String(r.external_property_title || '')
          .trim()
          .toLowerCase() === String(externalTitle).trim().toLowerCase()
      )
    },
  )
  if (todays.length >= PRICE_REPORT_SUBJECT_DAILY_CAP) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'RATE_LIMITED',
        code: 'RATE_LIMITED',
        retry_after_seconds: Math.max(
          1,
          Math.ceil(
            (startOfUtcDay(new Date(Date.now() + 24 * 60 * 60 * 1000)).getTime() - Date.now()) /
              1000,
          ),
        ),
        daily_quota: PRICE_REPORT_SUBJECT_DAILY_CAP,
        used: todays.length,
        subject_key: subjectKey,
      },
    }
  }
  return { ok: true }
}

export async function writeSubmitAudit({
  type,
  req,
  tenant,
  reportId,
  subject = {},
}) {
  const now = new Date().toISOString()
  try {
    await insert('audit_log', {
      id: randomUUID(),
      agent_id: req.user?.id || null,
      agency_id: req.agent?.agency_id || null,
      tenant_id: tenant?.publicTenantId || null,
      type,
      action: 'submit',
      entity_type: type === 'price_report_submit' ? 'agent_price_report' : 'comparable_report',
      entity_id: reportId,
      ip: req.ip || null,
      user_agent: typeof req.get === 'function' ? req.get('user-agent') : null,
      metadata: {
        user_id: req.user?.id || null,
        subject: { report_id: reportId, ...subject },
      },
      created_at: now,
    })
  } catch (err) {
    logger.warn({ err: err.message, type, reportId }, 'submit audit_log write failed')
  }
}

export function normalizeReporterConfidence(value) {
  if (value == null || value === '') return null
  const v = String(value)
  if (!REPORTER_CONFIDENCE_VALUES.includes(v)) return undefined
  return v
}

export function normalizeSupportingDocumentIds(value) {
  if (value == null) return []
  if (!Array.isArray(value)) return null
  return [...new Set(value.map(String).filter(Boolean))]
}
