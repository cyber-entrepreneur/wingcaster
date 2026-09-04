/**
 * Vendor admin writes. Calls registry.js exports only — no domain changes.
 * POST /rates wraps upsert + activate (and draft) in one transaction (§2.3).
 * Reconcile holds advisory lock 1021 via lockVendorStatementRecon (§2.7).
 */
import { randomUUID } from 'node:crypto'
import { CATEGORY, finError } from '../../errors.js'
import { requestFingerprint } from '../../idempotency/fingerprint.js'
import { insertAudit } from '../../ledger/write.js'
import { lockVendorStatementRecon } from '../../vendors/helpers.js'
import { reconcileStatement } from '../../vendors/reconciliation.js'
import * as vendorRegistry from '../../vendors/registry.js'
import { getVendorRateApprovalThresholdPct } from './config.js'

export const VENDOR_RATE_ACTION_KIND = 'VENDOR_RATE_CHANGE'
export const VENDOR_RATE_WORKFLOW = 'WF-20'

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] != null && obj[key] !== '') return obj[key]
  }
  return undefined
}

function num(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function buildRates(body) {
  if (body.rates && typeof body.rates === 'object' && !Array.isArray(body.rates)) {
    return body.rates
  }
  const rateKey = pick(body, 'rate_key', 'rateKey', 'product_code', 'productCode')
  const unitCostMinor = pick(body, 'unit_cost_minor', 'unitCostMinor')
  const currency = pick(body, 'currency') || 'USD'
  if (!rateKey || unitCostMinor == null) {
    throw finError('FIN_VENDOR_RATES_INVALID', { category: CATEGORY.VALIDATION })
  }
  return { [rateKey]: { unit_cost_minor: unitCostMinor, currency } }
}

export function primaryRateKey(rates) {
  return Object.keys(rates)[0] || null
}

/**
 * Percent change vs the prior unit cost.
 *
 * New-SKU governance: a missing or zero prior (first listing of this
 * rate_key) returns 0 so the change applies directly. WF-20 two-person
 * approval is for revising an existing rate above
 * VENDOR_RATE_APPROVAL_THRESHOLD_PCT, not for introducing a SKU. A $0
 * prior would otherwise yield an infinite delta and force approval on
 * every new product.
 */
export function deltaPct(fromMinor, toMinor) {
  const from = num(fromMinor)
  const to = num(toMinor)
  if (from == null || from === 0 || to == null) return 0
  return ((to - from) / from) * 100
}

function priceShape(minor, currency) {
  if (minor == null) return null
  return { price: String(minor), unit: `${currency || 'USD'}/minor`, unit_cost_minor: num(minor) }
}

async function loadVendor(client, vendorId, environment) {
  const { rows } = await client.query(
    `SELECT * FROM fin.vendors WHERE id = $1`,
    [vendorId],
  )
  const vendor = rows[0]
  if (!vendor) {
    throw finError('FIN_VENDOR_NOT_FOUND', { category: CATEGORY.PRECONDITION, httpStatus: 404 })
  }
  if (vendor.environment !== environment) {
    throw finError('ENV_MISMATCH', { category: CATEGORY.VALIDATION })
  }
  return vendor
}

async function loadActiveRates(client, vendorId) {
  const { rows } = await client.query(
    `SELECT vrv.rates
       FROM fin.vendor_rate_versions vrv
       JOIN fin.vendor_rate_cards vrc ON vrc.id = vrv.rate_card_id
      WHERE vrc.vendor_id = $1 AND vrv.status = 'ACTIVE'
      ORDER BY vrv.effective_from DESC
      LIMIT 1`,
    [vendorId],
  )
  return rows[0]?.rates || {}
}

async function affectedTenantsEstimate(client, vendorId, rateKey) {
  const { rows } = await client.query(
    `SELECT COUNT(DISTINCT tenant_id)::int AS n
       FROM fin.vendor_usage_events
      WHERE vendor_id = $1 AND vendor_product_code = $2 AND tenant_id IS NOT NULL`,
    [vendorId, rateKey],
  )
  return rows[0]?.n ?? 0
}

async function monthlyUnits(client, vendorId, rateKey, now) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(quantity_units), 0)::bigint AS units
       FROM fin.vendor_usage_events
      WHERE vendor_id = $1
        AND vendor_product_code = $2
        AND occurred_at >= date_trunc('month', $3::timestamptz)
        AND occurred_at <= $3::timestamptz`,
    [vendorId, rateKey, now],
  )
  return num(rows[0]?.units) || 0
}

export async function buildImpactSummary(client, {
  vendor, rateKey, fromMinor, toMinor, currency, effectiveFrom, now,
}) {
  const units = await monthlyUnits(client, vendor.id, rateKey, now)
  const from = num(fromMinor) || 0
  const to = num(toMinor) || 0
  return {
    vendor_name: vendor.name,
    rate_key: rateKey,
    change: {
      from: priceShape(fromMinor, currency),
      to: priceShape(toMinor, currency),
    },
    delta_pct: deltaPct(fromMinor, toMinor),
    effective_from: effectiveFrom,
    affected_tenants_estimate: await affectedTenantsEstimate(client, vendor.id, rateKey),
    monthly_cost_delta_micro_usd: units * (to - from),
  }
}

export async function insertVendorRateApproval(client, {
  environment, actorId, actorType, now, impactSummary, payload, reason,
}) {
  const id = randomUUID()
  const approvalPayload = {
    workflow: VENDOR_RATE_WORKFLOW,
    actor_summary: {
      submitter: actorId,
      submitted_at: now,
      reason: reason || null,
    },
    impact_summary: impactSummary,
    payload,
  }
  await client.query(
    `INSERT INTO fin.approval_requests (
       id, environment, tenant_id, action_kind, status, subject_type, subject_id,
       payload_hash, payload, min_distinct_approvers,
       created_at, created_by_actor_type, created_by_actor_id, updated_at
     ) VALUES (
       $1, $2, NULL, $3, 'REQUESTED', 'vendor_rate_versions', $4,
       $5, $6::jsonb, 1,
       $7::timestamptz, $8, $9, $7::timestamptz
     )`,
    [
      id,
      environment,
      VENDOR_RATE_ACTION_KIND,
      payload.rate_version_id || payload.vendor_id || id,
      requestFingerprint(approvalPayload),
      JSON.stringify(approvalPayload),
      now,
      actorType || 'USER',
      actorId,
    ],
  )
  return { id, payload: approvalPayload }
}

async function maybeApprove(client, env, { vendor, rateKey, fromMinor, toMinor, currency, effectiveFrom, payload }) {
  const threshold = await getVendorRateApprovalThresholdPct()
  const delta = deltaPct(fromMinor, toMinor)
  if (Math.abs(delta) <= threshold) {
    return { required: false, delta_pct: delta, threshold }
  }
  const impactSummary = await buildImpactSummary(client, {
    vendor, rateKey, fromMinor, toMinor, currency, effectiveFrom, now: env.now,
  })
  const approval = await insertVendorRateApproval(client, {
    environment: env.environment,
    actorId: env.actorId,
    actorType: env.actorType,
    now: env.now,
    impactSummary,
    payload,
    reason: env.reasonCode,
  })
  return {
    required: true,
    delta_pct: delta,
    threshold,
    approval_request_id: approval.id,
    impact_summary: impactSummary,
    payload: approval.payload,
  }
}

export async function applyVendorRate(client, env, { vendorId, body }) {
  const vendor = await loadVendor(client, vendorId, env.environment)
  const rates = buildRates(body)
  const rateKey = primaryRateKey(rates)
  const toMinor = rates[rateKey]?.unit_cost_minor
  const currency = rates[rateKey]?.currency || vendor.currency
  const effectiveFrom = pick(body, 'effective_from', 'effectiveFrom') || env.now
  const productCode = pick(body, 'product_code', 'productCode') || rateKey
  const productClass = pick(body, 'product_class', 'productClass') || null
  const prior = await loadActiveRates(client, vendorId)
  const fromMinor = prior?.[rateKey]?.unit_cost_minor ?? null

  const pending = await maybeApprove(client, env, {
    vendor,
    rateKey,
    fromMinor,
    toMinor,
    currency,
    effectiveFrom,
    payload: {
      op: 'activate_rate',
      vendor_id: vendorId,
      product_code: productCode,
      product_class: productClass,
      rates,
      effective_from: effectiveFrom,
      rate_card_id: pick(body, 'rate_card_id', 'rateCardId') || null,
      rate_version_id: pick(body, 'rate_version_id', 'rateVersionId') || null,
    },
  })
  if (pending.required) {
    return {
      status: 'PENDING_APPROVAL',
      approval_request_id: pending.approval_request_id,
      impact_summary: pending.impact_summary,
      workflow: VENDOR_RATE_WORKFLOW,
    }
  }

  const commandEnv = { ...env, expectedVersion: undefined }

  const product = await vendorRegistry.upsertVendorProduct({
    ...commandEnv,
    vendorId,
    productCode,
    productClass,
  })

  let rateCardId = pick(body, 'rate_card_id', 'rateCardId')
  if (!rateCardId) {
    const existing = (await client.query(
      `SELECT id FROM fin.vendor_rate_cards WHERE vendor_id = $1 ORDER BY name LIMIT 1`,
      [vendorId],
    )).rows[0]
    if (existing) {
      rateCardId = existing.id
    } else {
      const created = await vendorRegistry.createRateCard({
        ...commandEnv,
        vendorId,
        name: pick(body, 'rate_card_name', 'rateCardName') || `${vendor.name}-card`,
      })
      rateCardId = created.id
    }
  }

  let rateVersionId = pick(body, 'rate_version_id', 'rateVersionId')
  if (!rateVersionId) {
    const drafted = await vendorRegistry.draftRateVersion({
      ...commandEnv,
      rateCardId,
      rates,
      effectiveFrom,
    })
    rateVersionId = drafted.id
  }

  const activated = await vendorRegistry.activateRateVersion({
    ...commandEnv,
    rateCardId,
    rateVersionId,
  })
  return {
    status: 'ACTIVE',
    product,
    rate_card_id: rateCardId,
    ...activated,
  }
}

export async function deprecateVendorRate(client, env, { vendorId, versionId }) {
  const vendor = await loadVendor(client, vendorId, env.environment)
  const version = (await client.query(
    `SELECT vrv.*, vrc.vendor_id, vrc.id AS rate_card_id
       FROM fin.vendor_rate_versions vrv
       JOIN fin.vendor_rate_cards vrc ON vrc.id = vrv.rate_card_id
      WHERE vrv.id = $1`,
    [versionId],
  )).rows[0]
  if (!version || version.vendor_id !== vendorId) {
    throw finError('FIN_VENDOR_RATE_VERSION_NOT_FOUND', {
      category: CATEGORY.PRECONDITION,
      httpStatus: 404,
    })
  }
  const rates = version.rates || {}
  const rateKey = primaryRateKey(rates)
  const fromMinor = rateKey ? rates[rateKey]?.unit_cost_minor : null
  const currency = rateKey ? rates[rateKey]?.currency : vendor.currency
  const pending = await maybeApprove(client, env, {
    vendor,
    rateKey: rateKey || versionId,
    fromMinor,
    toMinor: 0,
    currency,
    effectiveFrom: env.now,
    payload: {
      op: 'deprecate_rate',
      vendor_id: vendorId,
      rate_card_id: version.rate_card_id,
      rate_version_id: versionId,
    },
  })
  if (pending.required) {
    return {
      status: 'PENDING_APPROVAL',
      approval_request_id: pending.approval_request_id,
      impact_summary: pending.impact_summary,
      workflow: VENDOR_RATE_WORKFLOW,
    }
  }
  return vendorRegistry.deprecateRateVersion({
    ...env,
    expectedVersion: undefined,
    rateCardId: version.rate_card_id,
    rateVersionId: versionId,
  })
}

export async function reconcileVendorStatement(client, env, { vendorId, month, evidence }) {
  await loadVendor(client, vendorId, env.environment)
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) {
    throw finError('VALIDATION', {
      category: CATEGORY.VALIDATION,
      details: { field: 'month' },
    })
  }
  const statement = (await client.query(
    `SELECT * FROM fin.vendor_statements
      WHERE vendor_id = $1 AND environment = $2 AND statement_period_key = $3`,
    [vendorId, env.environment, month],
  )).rows[0]
  if (!statement) {
    throw finError('VENDOR_STATEMENT_NOT_FOUND', {
      category: CATEGORY.PRECONDITION,
      httpStatus: 404,
    })
  }
  await lockVendorStatementRecon(client, statement.id)
  const result = await reconcileStatement({
    ...env,
    statementId: statement.id,
  })
  await insertAudit(client, {
    environment: env.environment,
    actorType: env.actorType,
    actorId: env.actorId,
    actorEmail: env.actorEmail,
    action: 'VENDOR_STATEMENT_RECONCILE_EVIDENCE',
    targetType: 'VENDOR_STATEMENT',
    targetId: statement.id,
    afterState: {
      month,
      evidence: evidence || null,
      lock_class: 1021,
    },
    reasonCode: env.reasonCode,
    now: env.now,
  })
  return result
}
