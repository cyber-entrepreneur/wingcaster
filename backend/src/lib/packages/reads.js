/**
 * Read queries for package admin. No writes.
 */
import { PACKAGE_ERROR, PackageError } from './errors.js'
import { countActive } from './property-tracker.js'

const VERSION_COMPARE_FIELDS = [
  'properties_covered',
  'monthly_price_minor',
  'state',
  'version_number',
  'effective_from',
  'effective_to',
]

function normalizeEnv(environment) {
  if (!environment) return null
  return String(environment).toUpperCase() === 'TEST' ? 'TEST' : 'LIVE'
}

export async function listPackages(client, {
  tier, audience, target_audience, active, environment,
} = {}) {
  const audienceFilter = audience || target_audience
  const env = normalizeEnv(environment)
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
        AND ($4::text IS NULL OR p.environment = $4)
      ORDER BY p.code`,
    [
      tier || null,
      audienceFilter || null,
      active === undefined || active === '' ? null : active === true || active === 'true',
      env,
    ],
  )
  return rows
}

export async function getPackage(client, packageId, { environment = null } = {}) {
  const env = normalizeEnv(environment)
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
      WHERE p.id = $1
        AND ($2::text IS NULL OR p.environment = $2)`,
    [packageId, env],
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

export async function getVersionDetail(client, packageId, versionId, { environment = null } = {}) {
  const env = normalizeEnv(environment)
  const { rows } = await client.query(
    `SELECT v.*, p.code AS package_code, p.display_name AS package_display_name,
            p.tier, p.target_audience, p.currency, p.billing_cadence, p.active AS package_active,
            p.environment AS package_environment
       FROM public.product_package_versions v
       JOIN public.product_packages p ON p.id = v.package_id
      WHERE v.id = $1 AND v.package_id = $2
        AND ($3::text IS NULL OR p.environment = $3)`,
    [versionId, packageId, env],
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

export async function listPendingApprovals(client, {
  environment = null,
  viewerActorId = null,
} = {}) {
  const env = normalizeEnv(environment)
  const viewer = viewerActorId || null
  const { rows } = await client.query(
    `SELECT v.*, p.display_name AS package_display_name, p.code AS package_code, p.tier,
            p.environment AS package_environment,
            a.id AS approval_id, a.status AS approval_status, a.created_by_actor_id AS requester_actor_id,
            a.created_at AS submitted_at, a.payload_hash,
            CASE
              WHEN $2::uuid IS NULL THEN false
              WHEN a.created_by_actor_id IS NOT NULL AND a.created_by_actor_id = $2::uuid THEN true
              ELSE false
            END AS is_own_submission
       FROM public.product_package_versions v
       JOIN public.product_packages p ON p.id = v.package_id
       LEFT JOIN fin.approval_requests a ON a.id = v.approval_request_id
      WHERE v.state = 'PENDING_APPROVAL'
        AND ($1::text IS NULL OR p.environment = $1)
      ORDER BY a.created_at ASC NULLS LAST, v.created_at ASC`,
    [env, viewer],
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
      is_own_submission: Boolean(row.is_own_submission),
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

export async function diffPackageVersions(client, packageId, versionARef, versionBRef, {
  environment = null,
} = {}) {
  const env = normalizeEnv(environment)
  const pkg = await client.query(
    `SELECT * FROM public.product_packages
      WHERE id = $1 AND ($2::text IS NULL OR environment = $2)`,
    [packageId, env],
  )
  if (!pkg.rows[0]) {
    throw new PackageError(PACKAGE_ERROR.PACKAGE_NOT_FOUND, `Package ${packageId} not found`)
  }

  async function loadRef(ref) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(ref || ''))
    const { rows } = isUuid
      ? await client.query(
        `SELECT * FROM public.product_package_versions WHERE package_id = $1 AND id = $2`,
        [packageId, ref],
      )
      : await client.query(
        `SELECT * FROM public.product_package_versions WHERE package_id = $1 AND version_number = $2::int`,
        [packageId, Number(ref)],
      )
    if (!rows[0]) {
      throw new PackageError(PACKAGE_ERROR.PACKAGE_VERSION_NOT_FOUND, `Version ${ref} not found`)
    }
    const quotas = await client.query(
      `SELECT feature_id, credits_per_property FROM public.package_feature_quotas WHERE package_version_id = $1`,
      [rows[0].id],
    )
    const flags = await client.query(
      `SELECT feature_code, enabled FROM public.package_feature_flags WHERE package_version_id = $1`,
      [rows[0].id],
    )
    return { version: rows[0], quotas: quotas.rows, flags: flags.rows }
  }

  const a = await loadRef(versionARef)
  const b = await loadRef(versionBRef)

  const fieldChanges = []
  for (const field of VERSION_COMPARE_FIELDS) {
    const left = a.version[field] == null ? null : String(a.version[field])
    const right = b.version[field] == null ? null : String(b.version[field])
    if (left !== right) {
      fieldChanges.push({ field, a: a.version[field] ?? null, b: b.version[field] ?? null })
    }
  }

  const aQuota = new Map(a.quotas.map((q) => [q.feature_id, Number(q.credits_per_property)]))
  const bQuota = new Map(b.quotas.map((q) => [q.feature_id, Number(q.credits_per_property)]))
  const quotaChanges = []
  for (const id of new Set([...aQuota.keys(), ...bQuota.keys()])) {
    if (aQuota.get(id) !== bQuota.get(id)) {
      quotaChanges.push({
        feature_id: id,
        a: aQuota.has(id) ? aQuota.get(id) : null,
        b: bQuota.has(id) ? bQuota.get(id) : null,
      })
    }
  }

  const aFlags = new Map(a.flags.map((f) => [f.feature_code, Boolean(f.enabled)]))
  const bFlags = new Map(b.flags.map((f) => [f.feature_code, Boolean(f.enabled)]))
  const flagChanges = []
  for (const code of new Set([...aFlags.keys(), ...bFlags.keys()])) {
    if (aFlags.get(code) !== bFlags.get(code)) {
      flagChanges.push({
        feature_code: code,
        a: aFlags.has(code) ? aFlags.get(code) : null,
        b: bFlags.has(code) ? bFlags.get(code) : null,
      })
    }
  }

  const summary = diffVersions(a.version, b.version, a.quotas, b.quotas, a.flags, b.flags)
  return {
    package_id: packageId,
    a_version: Number(a.version.version_number),
    b_version: Number(b.version.version_number),
    a_version_id: a.version.id,
    b_version_id: b.version.id,
    changes: { fields: fieldChanges, quotas: quotaChanges, flags: flagChanges },
    summary,
    unchanged_count: VERSION_COMPARE_FIELDS.length - fieldChanges.length,
    env: pkg.rows[0].environment,
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
