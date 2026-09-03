/**
 * Read queries for package admin. No writes.
 */
import { PACKAGE_ERROR, PackageError } from './errors.js'
import { countActive } from './property-tracker.js'

export async function listPackages(client, { tier, audience, target_audience, active } = {}) {
  const audienceFilter = audience || target_audience
  const { rows } = await client.query(
    `SELECT
        p.*,
        (
          SELECT COUNT(*)::int
            FROM public.tenant_subscriptions s
            JOIN public.product_package_versions v ON v.id = s.package_version_id
           WHERE v.package_id = p.id
             AND s.status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END')
        ) AS subscribers_count,
        (
          SELECT json_build_object(
            'id', v.id,
            'version_number', v.version_number,
            'state', v.state,
            'properties_covered', v.properties_covered,
            'monthly_price_minor', v.monthly_price_minor,
            'effective_from', v.effective_from,
            'effective_to', v.effective_to
          )
            FROM public.product_package_versions v
           WHERE v.package_id = p.id
             AND v.state = 'PUBLISHED'
             AND COALESCE(v.effective_from, '-infinity'::timestamptz) <= NOW()
             AND (v.effective_to IS NULL OR v.effective_to > NOW())
           ORDER BY v.version_number DESC
           LIMIT 1
        ) AS active_version
       FROM public.product_packages p
      WHERE ($1::text IS NULL OR p.tier = $1)
        AND ($2::text IS NULL OR p.target_audience = $2)
        AND ($3::boolean IS NULL OR p.active = $3)
      ORDER BY p.code`,
    [tier || null, audienceFilter || null, active === undefined || active === '' ? null : active === true || active === 'true'],
  )
  return rows
}

export async function getPackage(client, packageId) {
  const { rows } = await client.query(
    `SELECT p.*,
            (
              SELECT COUNT(*)::int
                FROM public.tenant_subscriptions s
                JOIN public.product_package_versions v ON v.id = s.package_version_id
               WHERE v.package_id = p.id
                 AND s.status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END')
            ) AS subscribers_count
       FROM public.product_packages p
      WHERE p.id = $1`,
    [packageId],
  )
  if (!rows[0]) {
    throw new PackageError(PACKAGE_ERROR.PACKAGE_NOT_FOUND, `Package ${packageId} not found`)
  }
  const versions = await client.query(
    `SELECT * FROM public.product_package_versions WHERE package_id = $1 ORDER BY version_number`,
    [packageId],
  )
  return { ...rows[0], versions: versions.rows }
}

export async function getVersionDetail(client, packageId, versionId) {
  const { rows } = await client.query(
    `SELECT v.*, p.code AS package_code, p.display_name AS package_display_name,
            p.tier, p.target_audience, p.currency, p.billing_cadence, p.active AS package_active
       FROM public.product_package_versions v
       JOIN public.product_packages p ON p.id = v.package_id
      WHERE v.id = $1 AND v.package_id = $2`,
    [versionId, packageId],
  )
  if (!rows[0]) {
    throw new PackageError(PACKAGE_ERROR.PACKAGE_VERSION_NOT_FOUND, `Version ${versionId} not found`)
  }
  const quotas = await client.query(
    `SELECT q.*, f.code AS feature_code, f.display_name, f.category, f.meter_unit,
            f.credits_per_unit, f.cost_per_unit_micro_usd, f.cost_source, f.active AS feature_active
       FROM public.package_feature_quotas q
       JOIN public.metered_features f ON f.id = q.feature_id
      WHERE q.package_version_id = $1
      ORDER BY f.code`,
    [versionId],
  )
  const flags = await client.query(
    `SELECT * FROM public.package_feature_flags WHERE package_version_id = $1 ORDER BY feature_code`,
    [versionId],
  )
  const approval = rows[0].approval_request_id
    ? (await client.query(`SELECT * FROM fin.approval_requests WHERE id = $1`, [rows[0].approval_request_id])).rows[0]
    : null
  return { ...rows[0], quotas: quotas.rows, flags: flags.rows, approval }
}

export async function listPendingApprovals(client) {
  const { rows } = await client.query(
    `SELECT v.*, p.display_name AS package_display_name, p.code AS package_code, p.tier,
            a.id AS approval_id, a.status AS approval_status, a.created_by_actor_id AS requester_actor_id,
            a.created_at AS submitted_at, a.payload_hash
       FROM public.product_package_versions v
       JOIN public.product_packages p ON p.id = v.package_id
       LEFT JOIN fin.approval_requests a ON a.id = v.approval_request_id
      WHERE v.state = 'PENDING_APPROVAL'
      ORDER BY a.created_at ASC NULLS LAST, v.created_at ASC`,
  )
  const out = []
  for (const row of rows) {
    const published = await client.query(
      `SELECT * FROM public.product_package_versions
        WHERE package_id = $1 AND state = 'PUBLISHED'
          AND COALESCE(effective_from, '-infinity'::timestamptz) <= NOW()
          AND (effective_to IS NULL OR effective_to > NOW())
        ORDER BY version_number DESC
        LIMIT 1`,
      [row.package_id],
    )
    const current = published.rows[0] || null
    const draftQuotas = await client.query(
      `SELECT feature_id, credits_per_property FROM public.package_feature_quotas WHERE package_version_id = $1`,
      [row.id],
    )
    const liveQuotas = current
      ? await client.query(
        `SELECT feature_id, credits_per_property FROM public.package_feature_quotas WHERE package_version_id = $1`,
        [current.id],
      )
      : { rows: [] }
    const draftFlags = await client.query(
      `SELECT feature_code, enabled FROM public.package_feature_flags WHERE package_version_id = $1`,
      [row.id],
    )
    const liveFlags = current
      ? await client.query(
        `SELECT feature_code, enabled FROM public.package_feature_flags WHERE package_version_id = $1`,
        [current.id],
      )
      : { rows: [] }
    out.push({
      ...row,
      diff: diffVersions(current, row, liveQuotas.rows, draftQuotas.rows, liveFlags.rows, draftFlags.rows),
    })
  }
  return out
}

export function diffVersions(published, draft, publishedQuotas = [], draftQuotas = [], publishedFlags = [], draftFlags = []) {
  const pubMap = new Map(publishedQuotas.map((q) => [q.feature_id, Number(q.credits_per_property)]))
  const draftMap = new Map(draftQuotas.map((q) => [q.feature_id, Number(q.credits_per_property)]))
  let quotasAdded = 0
  let quotasRemoved = 0
  let quotasChanged = 0
  for (const [id, credits] of draftMap) {
    if (!pubMap.has(id)) quotasAdded += 1
    else if (pubMap.get(id) !== credits) quotasChanged += 1
  }
  for (const id of pubMap.keys()) {
    if (!draftMap.has(id)) quotasRemoved += 1
  }
  const pubFlags = new Map(publishedFlags.map((f) => [f.feature_code, Boolean(f.enabled)]))
  const draftFlagMap = new Map(draftFlags.map((f) => [f.feature_code, Boolean(f.enabled)]))
  let flagsChanged = 0
  const codes = new Set([...pubFlags.keys(), ...draftFlagMap.keys()])
  for (const code of codes) {
    if (pubFlags.get(code) !== draftFlagMap.get(code)) flagsChanged += 1
  }
  return {
    properties_covered_delta: Number(draft.properties_covered) - Number(published?.properties_covered || 0),
    monthly_price_minor_delta: Number(draft.monthly_price_minor) - Number(published?.monthly_price_minor || 0),
    quotas_added: quotasAdded,
    quotas_removed: quotasRemoved,
    quotas_changed: quotasChanged,
    flags_changed: flagsChanged,
    versus_version_id: published?.id || null,
    versus_version_number: published?.version_number || null,
  }
}

export async function listMeteredFeaturesAdmin(client, { category, active } = {}) {
  const { rows } = await client.query(
    `SELECT * FROM public.metered_features
      WHERE ($1::text IS NULL OR category = $1)
        AND ($2::boolean IS NULL OR active = $2)
      ORDER BY code`,
    [category || null, active === undefined || active === '' ? null : active === true || active === 'true'],
  )
  return rows
}

export async function getMeteredFeature(client, featureId) {
  const { rows } = await client.query(`SELECT * FROM public.metered_features WHERE id = $1`, [featureId])
  if (!rows[0]) throw new PackageError(PACKAGE_ERROR.FEATURE_NOT_FOUND, `Feature ${featureId} not found`)
  return rows[0]
}

export async function listSubscriptions(client, { tenantId, tenant_id, packageId, package_id, status } = {}) {
  const tenant = tenantId || tenant_id
  const pkg = packageId || package_id
  const { rows } = await client.query(
    `SELECT s.*, p.code AS package_code, p.display_name AS package_display_name, p.tier,
            v.version_number, v.state AS version_state, v.monthly_price_minor, v.properties_covered
       FROM public.tenant_subscriptions s
       JOIN public.product_package_versions v ON v.id = s.package_version_id
       JOIN public.product_packages p ON p.id = v.package_id
      WHERE ($1::uuid IS NULL OR s.tenant_id = $1)
        AND ($2::uuid IS NULL OR v.package_id = $2)
        AND ($3::text IS NULL OR s.status = $3)
      ORDER BY s.created_at DESC
      LIMIT 500`,
    [tenant || null, pkg || null, status || null],
  )
  return rows
}

export async function getSubscriptionDetail(client, subscriptionId) {
  const { rows } = await client.query(
    `SELECT s.*, p.id AS package_id, p.code AS package_code, p.display_name AS package_display_name,
            p.tier, p.currency, p.billing_cadence,
            v.version_number, v.state AS version_state, v.monthly_price_minor, v.properties_covered
       FROM public.tenant_subscriptions s
       JOIN public.product_package_versions v ON v.id = s.package_version_id
       JOIN public.product_packages p ON p.id = v.package_id
      WHERE s.id = $1`,
    [subscriptionId],
  )
  if (!rows[0]) {
    throw new PackageError(PACKAGE_ERROR.SUBSCRIPTION_NOT_FOUND, `Subscription ${subscriptionId} not found`)
  }
  const activeProperties = await countActive(client, rows[0].tenant_id)
  return { ...rows[0], active_properties_count: activeProperties }
}
