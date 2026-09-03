/**
 * Write-side package authoring. Routes delegate here.
 * Does not modify the compiler, lifecycle, or billing-cycle worker.
 */
import { createHash, randomUUID } from 'node:crypto'
import { insertAudit } from '../../fin/ledger/write.js'
import { PACKAGE_ERROR, PackageError } from './errors.js'
import { PACKAGES_ENVIRONMENT, writeOutbox } from './helpers.js'

export const PACKAGE_FLAG_CODES = [
  'white-label',
  'xml-feed',
  'command-center',
  'agency-management',
  'inspector',
  'crm.contacts',
  'crm.tasks',
  'crm.opportunities',
  'listings.crud',
]

/** Spec asked for PUBLISH_PACKAGE_VERSION; CHECK constraint has MASS_OPERATION. */
export const PUBLISH_ACTION_KIND = 'MASS_OPERATION'

function asUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''))
    ? String(value)
    : null
}

function fail(code, message, extra = {}) {
  throw new PackageError(code, message || code, extra)
}

export function canonicalPayload(version, quotas, flags) {
  const body = {
    version: {
      id: version.id,
      version_number: Number(version.version_number),
      properties_covered: Number(version.properties_covered),
      monthly_price_minor: Number(version.monthly_price_minor),
    },
    quotas: [...quotas]
      .map((q) => ({
        feature_id: q.feature_id,
        credits_per_property: Number(q.credits_per_property),
        rollover_policy: q.rollover_policy,
        overage_credit_price_micro_usd: q.overage_credit_price_micro_usd == null
          ? null
          : Number(q.overage_credit_price_micro_usd),
      }))
      .sort((a, b) => String(a.feature_id).localeCompare(String(b.feature_id))),
    flags: [...flags]
      .map((f) => ({ feature_code: f.feature_code, enabled: Boolean(f.enabled) }))
      .sort((a, b) => String(a.feature_code).localeCompare(String(b.feature_code))),
  }
  return JSON.stringify(body)
}

export function payloadHash(version, quotas, flags) {
  return createHash('sha256').update(canonicalPayload(version, quotas, flags)).digest('hex')
}

async function writeAudit(client, {
  actorId, actorEmail, action, targetType, targetId, beforeState, afterState, reason, approvalRequestId, now,
}) {
  await insertAudit(client, {
    environment: PACKAGES_ENVIRONMENT,
    actorType: actorId ? 'USER' : 'SYSTEM',
    actorId: asUuid(actorId),
    actorEmail: actorEmail || 'packages@admin',
    action,
    targetType,
    targetId,
    beforeState: beforeState || null,
    afterState: afterState || null,
    reasonCode: reason || action,
    approvalRequestId: approvalRequestId || null,
    now: now || new Date().toISOString(),
  })
}

async function loadPackage(client, packageId, { forUpdate = false } = {}) {
  const sql = `SELECT * FROM public.product_packages WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`
  const { rows } = await client.query(sql, [packageId])
  if (!rows[0]) fail(PACKAGE_ERROR.PACKAGE_NOT_FOUND, `Package ${packageId} not found`)
  return rows[0]
}

async function loadVersion(client, packageId, versionId, { forUpdate = false } = {}) {
  const sql = `SELECT * FROM public.product_package_versions WHERE id = $1 AND package_id = $2${forUpdate ? ' FOR UPDATE' : ''}`
  const { rows } = await client.query(sql, [versionId, packageId])
  if (!rows[0]) fail(PACKAGE_ERROR.PACKAGE_VERSION_NOT_FOUND, `Version ${versionId} not found`)
  return rows[0]
}

function assertDraft(version) {
  if (version.state !== 'DRAFT') {
    fail(PACKAGE_ERROR.DRAFT_ONLY, `Version is ${version.state}`, { state: version.state })
  }
}

async function loadQuotasAndFlags(client, versionId) {
  const quotas = await client.query(
    `SELECT * FROM public.package_feature_quotas WHERE package_version_id = $1 ORDER BY feature_id`,
    [versionId],
  )
  const flags = await client.query(
    `SELECT * FROM public.package_feature_flags WHERE package_version_id = $1 ORDER BY feature_code`,
    [versionId],
  )
  return { quotas: quotas.rows, flags: flags.rows }
}

export async function createPackageDraft(client, {
  code, displayName, display_name, tier, targetAudience, target_audience,
  currency = 'USD', billingCadence, billing_cadence, actorId, actorEmail, now,
}) {
  const name = displayName || display_name
  const audience = targetAudience || target_audience
  const cadence = billingCadence || billing_cadence
  if (!code || !name || !tier || !audience || !cadence) {
    fail(PACKAGE_ERROR.INVALID_INPUT, 'code, display_name, tier, target_audience, billing_cadence are required')
  }
  const id = randomUUID()
  const ts = now || new Date().toISOString()
  try {
    const { rows } = await client.query(
      `INSERT INTO public.product_packages (
         id, code, display_name, tier, target_audience, currency, billing_cadence,
         active, data, created_at, updated_at, created_by_actor_id, updated_by_actor_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,false,'{}'::jsonb,$8,$8,$9,$9)
       RETURNING *`,
      [id, code, name, tier, audience, currency, cadence, ts, asUuid(actorId)],
    )
    await writeAudit(client, {
      actorId, actorEmail, action: 'PACKAGE_CREATED', targetType: 'product_packages',
      targetId: id, afterState: rows[0], now: ts,
    })
    return rows[0]
  } catch (error) {
    if (error.code === '23505') fail(PACKAGE_ERROR.INVALID_INPUT, `Package code already exists: ${code}`)
    if (error.code === '23514') fail(PACKAGE_ERROR.INVALID_INPUT, error.message)
    throw error
  }
}

export async function updatePackage(client, {
  packageId, displayName, display_name, active, targetAudience, target_audience, actorId, actorEmail, now,
}) {
  const pkg = await loadPackage(client, packageId, { forUpdate: true })
  const ts = now || new Date().toISOString()
  const name = displayName ?? display_name
  const audience = targetAudience ?? target_audience
  const { rows } = await client.query(
    `UPDATE public.product_packages
        SET display_name = COALESCE($2, display_name),
            active = COALESCE($3, active),
            target_audience = COALESCE($4, target_audience),
            updated_at = $5::timestamptz,
            updated_by_actor_id = $6
      WHERE id = $1
      RETURNING *`,
    [packageId, name ?? null, typeof active === 'boolean' ? active : null, audience ?? null, ts, asUuid(actorId)],
  )
  await writeAudit(client, {
    actorId, actorEmail, action: 'PACKAGE_UPDATED', targetType: 'product_packages',
    targetId: packageId, beforeState: pkg, afterState: rows[0], now: ts,
  })
  return rows[0]
}

export async function createDraftVersion(client, {
  packageId, copyFromVersionId, copy_from_version_id,
  propertiesCovered, properties_covered, monthlyPriceMinor, monthly_price_minor,
  actorId, actorEmail, now,
}) {
  await loadPackage(client, packageId, { forUpdate: true })
  const ts = now || new Date().toISOString()
  const copyId = copyFromVersionId || copy_from_version_id
  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(version_number), 0)::int AS n FROM public.product_package_versions WHERE package_id = $1`,
    [packageId],
  )
  const versionNumber = maxRows[0].n + 1
  let properties = Number(propertiesCovered ?? properties_covered ?? 0)
  let price = Number(monthlyPriceMinor ?? monthly_price_minor ?? 0)
  let source = null
  if (copyId) {
    source = await loadVersion(client, packageId, copyId)
    properties = Number(source.properties_covered)
    price = Number(source.monthly_price_minor)
  }
  const id = randomUUID()
  const { rows } = await client.query(
    `INSERT INTO public.product_package_versions (
       id, package_id, version_number, state, properties_covered, monthly_price_minor, data, created_at
     ) VALUES ($1,$2,$3,'DRAFT',$4,$5,'{}'::jsonb,$6)
     RETURNING *`,
    [id, packageId, versionNumber, properties, price, ts],
  )
  if (copyId) {
    const copiedQuotas = await client.query(
      `SELECT feature_id, credits_per_property, rollover_policy, overage_credit_price_micro_usd, data
         FROM public.package_feature_quotas WHERE package_version_id = $1`,
      [copyId],
    )
    for (const quota of copiedQuotas.rows) {
      await client.query(
        `INSERT INTO public.package_feature_quotas (
           id, package_version_id, feature_id, credits_per_property, rollover_policy,
           overage_credit_price_micro_usd, data
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [
          randomUUID(), id, quota.feature_id, quota.credits_per_property,
          quota.rollover_policy, quota.overage_credit_price_micro_usd,
          JSON.stringify(quota.data || {}),
        ],
      )
    }
    const copiedFlags = await client.query(
      `SELECT feature_code, enabled, data FROM public.package_feature_flags WHERE package_version_id = $1`,
      [copyId],
    )
    for (const flag of copiedFlags.rows) {
      await client.query(
        `INSERT INTO public.package_feature_flags (
           id, package_version_id, feature_code, enabled, data
         ) VALUES ($1,$2,$3,$4,$5::jsonb)`,
        [randomUUID(), id, flag.feature_code, flag.enabled, JSON.stringify(flag.data || {})],
      )
    }
  }
  await writeAudit(client, {
    actorId, actorEmail, action: 'PACKAGE_VERSION_CREATED', targetType: 'product_package_versions',
    targetId: id, afterState: rows[0], reason: copyId ? 'copy' : 'fresh', now: ts,
  })
  return rows[0]
}

export async function updateDraft(client, {
  packageId, versionId, propertiesCovered, properties_covered,
  monthlyPriceMinor, monthly_price_minor, effectiveFrom, effective_from,
  actorId, actorEmail, now,
}) {
  const version = await loadVersion(client, packageId, versionId, { forUpdate: true })
  assertDraft(version)
  const ts = now || new Date().toISOString()
  const properties = propertiesCovered ?? properties_covered
  const price = monthlyPriceMinor ?? monthly_price_minor
  const effective = effectiveFrom ?? effective_from
  try {
    const { rows } = await client.query(
      `UPDATE public.product_package_versions
          SET properties_covered = COALESCE($3, properties_covered),
              monthly_price_minor = COALESCE($4, monthly_price_minor),
              effective_from = COALESCE($5::timestamptz, effective_from)
        WHERE id = $1 AND package_id = $2
        RETURNING *`,
      [versionId, packageId, properties == null ? null : Number(properties), price == null ? null : Number(price), effective || null],
    )
    await writeAudit(client, {
      actorId, actorEmail, action: 'PACKAGE_VERSION_UPDATED', targetType: 'product_package_versions',
      targetId: versionId, beforeState: version, afterState: rows[0], now: ts,
    })
    return rows[0]
  } catch (error) {
    if (String(error.message || '').includes('PACKAGE_VERSION_IMMUTABLE')) {
      fail(PACKAGE_ERROR.PACKAGE_VERSION_IMMUTABLE, error.message)
    }
    if (error.code === '23514') fail(PACKAGE_ERROR.INVALID_INPUT, error.message)
    throw error
  }
}

export async function addQuota(client, {
  packageId, versionId, featureId, feature_id,
  creditsPerProperty, credits_per_property, rolloverPolicy, rollover_policy,
  overageCreditPriceMicroUsd, overage_credit_price_micro_usd,
  actorId, actorEmail, now,
}) {
  const version = await loadVersion(client, packageId, versionId, { forUpdate: true })
  assertDraft(version)
  const featureIdResolved = featureId || feature_id
  const credits = Number(creditsPerProperty ?? credits_per_property)
  if (!featureIdResolved || !Number.isFinite(credits) || credits < 0) {
    fail(PACKAGE_ERROR.INVALID_INPUT, 'feature_id and credits_per_property (>= 0) are required')
  }
  const feature = await client.query(`SELECT id FROM public.metered_features WHERE id = $1`, [featureIdResolved])
  if (!feature.rows[0]) fail(PACKAGE_ERROR.FEATURE_NOT_FOUND, `Feature ${featureIdResolved} not found`)
  const ts = now || new Date().toISOString()
  const rollover = rolloverPolicy || rollover_policy || 'expire'
  const overage = overageCreditPriceMicroUsd ?? overage_credit_price_micro_usd ?? null
  const { rows } = await client.query(
    `INSERT INTO public.package_feature_quotas (
       id, package_version_id, feature_id, credits_per_property, rollover_policy,
       overage_credit_price_micro_usd, data
     ) VALUES ($1,$2,$3,$4,$5,$6,'{}'::jsonb)
     ON CONFLICT (package_version_id, feature_id) DO UPDATE
       SET credits_per_property = EXCLUDED.credits_per_property,
           rollover_policy = EXCLUDED.rollover_policy,
           overage_credit_price_micro_usd = EXCLUDED.overage_credit_price_micro_usd
     RETURNING *`,
    [randomUUID(), versionId, featureIdResolved, credits, rollover, overage],
  )
  await writeAudit(client, {
    actorId, actorEmail, action: 'PACKAGE_QUOTA_UPSERT', targetType: 'package_feature_quotas',
    targetId: rows[0].id, afterState: rows[0], now: ts,
  })
  return rows[0]
}

export async function removeQuota(client, { packageId, versionId, featureId, actorId, actorEmail, now }) {
  const version = await loadVersion(client, packageId, versionId, { forUpdate: true })
  assertDraft(version)
  const { rows } = await client.query(
    `DELETE FROM public.package_feature_quotas
      WHERE package_version_id = $1 AND feature_id = $2
      RETURNING *`,
    [versionId, featureId],
  )
  if (!rows[0]) fail(PACKAGE_ERROR.FEATURE_NOT_FOUND, 'Quota not found')
  await writeAudit(client, {
    actorId, actorEmail, action: 'PACKAGE_QUOTA_REMOVED', targetType: 'package_feature_quotas',
    targetId: rows[0].id, beforeState: rows[0], now: now || new Date().toISOString(),
  })
  return rows[0]
}

export async function addFlag(client, {
  packageId, versionId, featureCode, feature_code, enabled = true, actorId, actorEmail, now,
}) {
  const version = await loadVersion(client, packageId, versionId, { forUpdate: true })
  assertDraft(version)
  const code = featureCode || feature_code
  if (!code) fail(PACKAGE_ERROR.INVALID_INPUT, 'feature_code is required')
  const ts = now || new Date().toISOString()
  const { rows } = await client.query(
    `INSERT INTO public.package_feature_flags (
       id, package_version_id, feature_code, enabled, data
     ) VALUES ($1,$2,$3,$4,'{}'::jsonb)
     ON CONFLICT (package_version_id, feature_code) DO UPDATE
       SET enabled = EXCLUDED.enabled
     RETURNING *`,
    [randomUUID(), versionId, code, enabled !== false],
  )
  await writeAudit(client, {
    actorId, actorEmail, action: 'PACKAGE_FLAG_UPSERT', targetType: 'package_feature_flags',
    targetId: rows[0].id, afterState: rows[0], now: ts,
  })
  return rows[0]
}

export async function removeFlag(client, { packageId, versionId, featureCode, actorId, actorEmail, now }) {
  const version = await loadVersion(client, packageId, versionId, { forUpdate: true })
  assertDraft(version)
  const { rows } = await client.query(
    `DELETE FROM public.package_feature_flags
      WHERE package_version_id = $1 AND feature_code = $2
      RETURNING *`,
    [versionId, featureCode],
  )
  if (!rows[0]) fail(PACKAGE_ERROR.FEATURE_NOT_FOUND, 'Flag not found')
  await writeAudit(client, {
    actorId, actorEmail, action: 'PACKAGE_FLAG_REMOVED', targetType: 'package_feature_flags',
    targetId: rows[0].id, beforeState: rows[0], now: now || new Date().toISOString(),
  })
  return rows[0]
}

export async function submitForApproval(client, { packageId, versionId, actorId, actorEmail, now }) {
  const actor = asUuid(actorId)
  if (!actor) fail(PACKAGE_ERROR.INVALID_INPUT, 'requester id must be a UUID')
  const version = await loadVersion(client, packageId, versionId, { forUpdate: true })
  assertDraft(version)
  const { quotas, flags } = await loadQuotasAndFlags(client, versionId)
  const hash = payloadHash(version, quotas, flags)
  const ts = now || new Date().toISOString()
  const approvalId = randomUUID()
  await client.query(
    `INSERT INTO fin.approval_requests (
       id, environment, tenant_id, action_kind, status, subject_type, subject_id,
       payload_hash, min_distinct_approvers, created_at, created_by_actor_type,
       created_by_actor_id, updated_at
     ) VALUES (
       $1, 'LIVE', NULL, $2, 'REQUESTED', 'product_package_versions', $3,
       $4, 1, $5::timestamptz, 'USER', $6, $5::timestamptz
     )`,
    [approvalId, PUBLISH_ACTION_KIND, versionId, hash, ts, actor],
  )
  const { rows } = await client.query(
    `UPDATE public.product_package_versions
        SET state = 'PENDING_APPROVAL', approval_request_id = $2
      WHERE id = $1
      RETURNING *`,
    [versionId, approvalId],
  )
  await writeOutbox(client, {
    topic: 'package.version.pending_approval',
    dedupeKey: `package.version.pending_approval:${versionId}:${approvalId}`,
    payload: { package_id: packageId, version_id: versionId, approval_request_id: approvalId },
    now: ts,
  })
  await writeAudit(client, {
    actorId: actor, actorEmail, action: 'PACKAGE_VERSION_SUBMITTED',
    targetType: 'product_package_versions', targetId: versionId,
    beforeState: version, afterState: rows[0], approvalRequestId: approvalId, now: ts,
  })
  return { version: rows[0], approval_request_id: approvalId }
}

export async function approvePublish(client, { packageId, versionId, actorId, actorEmail, now }) {
  const actor = asUuid(actorId)
  if (!actor) fail(PACKAGE_ERROR.INVALID_INPUT, 'approver id must be a UUID')
  const version = await loadVersion(client, packageId, versionId, { forUpdate: true })
  if (version.state !== 'PENDING_APPROVAL') {
    fail(PACKAGE_ERROR.INVALID_TRANSITION, `Cannot approve from ${version.state}`)
  }
  if (!version.approval_request_id) fail(PACKAGE_ERROR.APPROVAL_NOT_FOUND, 'No approval request')
  const locked = await client.query(
    `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
    [version.approval_request_id],
  )
  const approval = locked.rows[0]
  if (!approval) fail(PACKAGE_ERROR.APPROVAL_NOT_FOUND, 'Approval not found')
  if (approval.created_by_actor_id && String(approval.created_by_actor_id) === String(actor)) {
    fail(PACKAGE_ERROR.APPROVAL_SELF_APPROVAL_FORBIDDEN, 'APPROVAL_SELF_APPROVAL_FORBIDDEN')
  }
  if (approval.status !== 'REQUESTED') {
    fail(PACKAGE_ERROR.APPROVAL_ALREADY_RESOLVED, `Approval is ${approval.status}`, { status: approval.status })
  }
  const ts = now || new Date().toISOString()
  try {
    await client.query(
      `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
       VALUES ($1, $2, $3, 'APPROVED', $4::timestamptz)`,
      [randomUUID(), approval.id, actor, ts],
    )
  } catch (error) {
    if (String(error.message || '').includes('self-approval')) {
      fail(PACKAGE_ERROR.APPROVAL_SELF_APPROVAL_FORBIDDEN, 'APPROVAL_SELF_APPROVAL_FORBIDDEN')
    }
    throw error
  }
  await client.query(
    `UPDATE fin.approval_requests
        SET status = 'APPROVED', updated_at = $3::timestamptz, updated_by_actor_id = $2
      WHERE id = $1`,
    [approval.id, actor, ts],
  )
  await writeAudit(client, {
    actorId: actor, actorEmail, action: 'PACKAGE_VERSION_APPROVED',
    targetType: 'product_package_versions', targetId: versionId,
    afterState: { approval_request_id: approval.id, status: 'APPROVED' },
    approvalRequestId: approval.id, now: ts,
  })
  return { version, approval_request_id: approval.id, status: 'APPROVED' }
}

export async function rejectPublish(client, { packageId, versionId, reason, actorId, actorEmail, now }) {
  const actor = asUuid(actorId)
  if (!actor) fail(PACKAGE_ERROR.INVALID_INPUT, 'actor id must be a UUID')
  const reasonText = String(reason || '').trim()
  if (!reasonText) fail(PACKAGE_ERROR.REASON_REQUIRED, 'reject requires a reason')
  const version = await loadVersion(client, packageId, versionId, { forUpdate: true })
  if (version.state !== 'PENDING_APPROVAL') {
    fail(PACKAGE_ERROR.INVALID_TRANSITION, `Cannot reject from ${version.state}`)
  }
  if (!version.approval_request_id) fail(PACKAGE_ERROR.APPROVAL_NOT_FOUND, 'No approval request')
  const locked = await client.query(
    `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
    [version.approval_request_id],
  )
  const approval = locked.rows[0]
  if (!approval) fail(PACKAGE_ERROR.APPROVAL_NOT_FOUND, 'Approval not found')
  if (approval.status !== 'REQUESTED') {
    fail(PACKAGE_ERROR.APPROVAL_ALREADY_RESOLVED, `Approval is ${approval.status}`)
  }
  const ts = now || new Date().toISOString()
  await client.query(
    `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
     VALUES ($1, $2, $3, 'REJECTED', $4::timestamptz)`,
    [randomUUID(), approval.id, actor, ts],
  )
  await client.query(
    `UPDATE fin.approval_requests
        SET status = 'REJECTED', updated_at = $3::timestamptz, updated_by_actor_id = $2
      WHERE id = $1`,
    [approval.id, actor, ts],
  )
  const { rows } = await client.query(
    `UPDATE public.product_package_versions
        SET state = 'DRAFT'
      WHERE id = $1
      RETURNING *`,
    [versionId],
  )
  await writeAudit(client, {
    actorId: actor, actorEmail, action: 'PACKAGE_VERSION_REJECTED',
    targetType: 'product_package_versions', targetId: versionId,
    beforeState: version, afterState: rows[0], reason: reasonText,
    approvalRequestId: approval.id, now: ts,
  })
  return { version: rows[0], approval_request_id: approval.id, status: 'REJECTED', reason: reasonText }
}

export async function publishVersion(client, {
  packageId, versionId, effectiveFrom, effective_from, actorId, actorEmail, now,
}) {
  const actor = asUuid(actorId)
  const version = await loadVersion(client, packageId, versionId, { forUpdate: true })
  if (version.state !== 'PENDING_APPROVAL') {
    fail(PACKAGE_ERROR.PUBLISH_REQUIRES_APPROVAL, `Cannot publish from ${version.state}`)
  }
  if (!version.approval_request_id) fail(PACKAGE_ERROR.PUBLISH_REQUIRES_APPROVAL, 'approval_request_id missing')
  const approval = await client.query(
    `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
    [version.approval_request_id],
  )
  if (!approval.rows[0] || approval.rows[0].status !== 'APPROVED') {
    fail(PACKAGE_ERROR.PUBLISH_REQUIRES_APPROVAL, 'Publish blocked without prior approve')
  }
  const ts = now || new Date().toISOString()
  const from = effectiveFrom || effective_from || ts
  const previous = await client.query(
    `SELECT * FROM public.product_package_versions
      WHERE package_id = $1 AND state = 'PUBLISHED' AND id <> $2
        AND (effective_to IS NULL OR effective_to > $3::timestamptz)
      FOR UPDATE`,
    [packageId, versionId, from],
  )
  for (const sibling of previous.rows) {
    await client.query(
      `UPDATE public.product_package_versions SET effective_to = $2::timestamptz WHERE id = $1`,
      [sibling.id, from],
    )
  }
  const { rows } = await client.query(
    `UPDATE public.product_package_versions
        SET state = 'PUBLISHED',
            published_at = $3::timestamptz,
            published_by_actor_id = $4,
            effective_from = $2::timestamptz
      WHERE id = $1
      RETURNING *`,
    [versionId, from, ts, actor],
  )
  await client.query(
    `UPDATE public.product_packages SET active = true, updated_at = $2::timestamptz WHERE id = $1`,
    [packageId, ts],
  )
  await client.query(
    `UPDATE fin.approval_requests SET status = 'EXECUTED', updated_at = $2::timestamptz WHERE id = $1`,
    [version.approval_request_id, ts],
  )
  await writeOutbox(client, {
    topic: 'package.version.published',
    dedupeKey: `package.version.published:${versionId}:${from}`,
    payload: { package_id: packageId, version_id: versionId, effective_from: from },
    now: ts,
  })
  await writeAudit(client, {
    actorId: actor, actorEmail, action: 'PACKAGE_VERSION_PUBLISHED',
    targetType: 'product_package_versions', targetId: versionId,
    beforeState: version, afterState: rows[0], approvalRequestId: version.approval_request_id, now: ts,
  })
  return rows[0]
}

export async function deprecateVersion(client, { packageId, versionId, reason, actorId, actorEmail, now }) {
  const reasonText = String(reason || '').trim()
  if (!reasonText) fail(PACKAGE_ERROR.REASON_REQUIRED, 'deprecate requires a reason')
  const version = await loadVersion(client, packageId, versionId, { forUpdate: true })
  if (version.state !== 'PUBLISHED') {
    fail(PACKAGE_ERROR.INVALID_TRANSITION, `Cannot deprecate from ${version.state}`)
  }
  const ts = now || new Date().toISOString()
  const { rows } = await client.query(
    `UPDATE public.product_package_versions
        SET state = 'DEPRECATED',
            deprecated_at = $2::timestamptz,
            deprecated_by_actor_id = $3,
            effective_to = COALESCE(effective_to, $2::timestamptz)
      WHERE id = $1
      RETURNING *`,
    [versionId, ts, asUuid(actorId)],
  )
  await writeAudit(client, {
    actorId, actorEmail, action: 'PACKAGE_VERSION_DEPRECATED',
    targetType: 'product_package_versions', targetId: versionId,
    beforeState: version, afterState: rows[0], reason: reasonText, now: ts,
  })
  return rows[0]
}

export async function updateMeteredFeature(client, {
  featureId, displayName, display_name, active, data, reason, actorId, actorEmail, now,
}) {
  const reasonText = String(reason || '').trim()
  if (!reasonText) fail(PACKAGE_ERROR.REASON_REQUIRED, 'feature registry patch requires a reason')
  const { rows: found } = await client.query(
    `SELECT * FROM public.metered_features WHERE id = $1 FOR UPDATE`,
    [featureId],
  )
  if (!found[0]) fail(PACKAGE_ERROR.FEATURE_NOT_FOUND, `Feature ${featureId} not found`)
  const ts = now || new Date().toISOString()
  const name = displayName ?? display_name
  const { rows } = await client.query(
    `UPDATE public.metered_features
        SET display_name = COALESCE($2, display_name),
            active = COALESCE($3, active),
            data = COALESCE($4::jsonb, data),
            updated_at = $5::timestamptz
      WHERE id = $1
      RETURNING *`,
    [featureId, name ?? null, typeof active === 'boolean' ? active : null, data ? JSON.stringify(data) : null, ts],
  )
  await writeAudit(client, {
    actorId, actorEmail, action: 'METERED_FEATURE_UPDATED',
    targetType: 'metered_features', targetId: featureId,
    beforeState: found[0], afterState: rows[0], reason: reasonText, now: ts,
  })
  return rows[0]
}

export { asUuid, loadPackage, loadVersion, writeAudit }
