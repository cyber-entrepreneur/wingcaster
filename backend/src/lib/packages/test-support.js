import { randomUUID } from 'node:crypto'
import { getFeatureByCode, PRICE_REPORTS_SUBMIT_FEATURE_CODE } from './registry.js'
import { syntheticTenantId } from '../credits/wallets.js'

/** Subscription statuses the submit gate treats as an open/entitling subscription. */
export const OPEN_SUBSCRIPTION_STATUSES = Object.freeze([
  'PENDING_START',
  'ACTIVE',
  'PAUSED',
  'CANCELED_AT_PERIOD_END',
])

export const FREE_PACKAGE_ID = '30400000-0000-4000-8000-000000000001'
export const FREE_VERSION_ID = '30400000-0000-4000-8000-000000000002'
export const FREE_AGENCY_PACKAGE_ID = '31900000-0000-4000-8000-000000000001'
export const FREE_AGENCY_VERSION_ID = '31900000-0000-4000-8000-000000000002'
export const PRO_PACKAGE_ID = '33000000-0000-4000-8000-000000000001'
export const PRO_VERSION_ID = '33000000-0000-4000-8000-000000000002'
export const PRO_ELITE_PACKAGE_ID = '33000000-0000-4000-8000-000000000003'
export const PRO_ELITE_VERSION_ID = '33000000-0000-4000-8000-000000000004'

export const MARKETING_PACKAGE_IDS = {
  semsar: '31600000-0000-4000-8000-000000000001',
  boutique: '31600000-0000-4000-8000-000000000002',
  small_team: '31600000-0000-4000-8000-000000000003',
  agency: '31600000-0000-4000-8000-000000000004',
  brokerage: '31600000-0000-4000-8000-000000000005',
  enterprise: '31600000-0000-4000-8000-000000000006',
}

export const MARKETING_VERSION_IDS = {
  semsar: '31600000-0000-4000-8000-000000000011',
  boutique: '31600000-0000-4000-8000-000000000012',
  small_team: '31600000-0000-4000-8000-000000000013',
  agency: '31600000-0000-4000-8000-000000000014',
  brokerage: '31600000-0000-4000-8000-000000000015',
  enterprise: '31600000-0000-4000-8000-000000000016',
}

/**
 * Grant the `valuation.price_reports.submit` capability to a personal-tenant
 * agent by pointing their open subscription at the Pro agent package version.
 *
 * This is the canonical way to seed price/comparable-report submit entitlement
 * in Real-PG tests. The capability is a boolean `package_feature_flags` flag on
 * Pro / Pro Elite agent packages (migration 338:93-121) — it is intentionally
 * NOT a `metered_features` row, so `checkEntitlement`/credit seeding does not
 * apply. Granting Pro mirrors production reality: a paying Pro agent can submit;
 * a Free/plain agent (no flag) is correctly rejected with 403 FEATURE_NOT_ENABLED
 * by `requirePriceReportsSubmitEntitlement`.
 *
 * `createAgentAccount` provisions a Free-tier open subscription, so this UPDATE
 * swaps that subscription's package_version_id to Pro.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} client
 * @param {{ userId: string, versionId?: string }} opts
 */
export async function grantPriceReportsSubmit(client, { userId, versionId = PRO_VERSION_ID }) {
  if (!userId) throw new Error('grantPriceReportsSubmit: userId is required')
  const tenantId = syntheticTenantId('personal', userId)
  const updated = await client.query(
    `UPDATE public.tenant_subscriptions
        SET package_version_id = $2,
            updated_at = NOW(),
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('package_code', 'pro-agent')
      WHERE tenant_id = $1
        AND status = ANY($3::text[])
      RETURNING id`,
    [tenantId, versionId, [...OPEN_SUBSCRIPTION_STATUSES]],
  )
  if (!updated.rowCount) {
    throw new Error(`grantPriceReportsSubmit: no open subscription for tenant ${tenantId}`)
  }
  return { tenantId, featureCode: PRICE_REPORTS_SUBMIT_FEATURE_CODE }
}

export async function withTx(pool, fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export async function seedPublishedPackage(client, {
  code = `paid-${randomUUID().slice(0, 8)}`,
  displayName = 'Test Paid',
  tier = 'starter',
  audience = 'agent',
  cadence = 'monthly',
  propertiesCovered = 5,
  monthlyPriceMinor = 1000,
  quotas = [{ code: 'publishing.social.instagram', creditsPerProperty: 10 }],
  flags = [],
  environment = 'LIVE',
} = {}) {
  const packageId = randomUUID()
  const versionId = randomUUID()
  const env = String(environment).toUpperCase() === 'TEST' ? 'TEST' : 'LIVE'
  await client.query(
    `INSERT INTO public.product_packages (
       id, code, display_name, tier, target_audience, currency, billing_cadence,
       active, environment, data
     ) VALUES ($1,$2,$3,$4,$5,'USD',$6,true,$7,'{}'::jsonb)`,
    [packageId, code, displayName, tier, audience, cadence, env],
  )
  await client.query(
    `INSERT INTO public.product_package_versions (
       id, package_id, version_number, state, properties_covered, monthly_price_minor,
       effective_from, data
     ) VALUES ($1,$2,1,'DRAFT',$3,$4, TIMESTAMPTZ '2020-01-01 00:00:00+00', '{}'::jsonb)`,
    [versionId, packageId, propertiesCovered, monthlyPriceMinor],
  )
  for (const quota of quotas) {
    const feature = await getFeatureByCode(client, quota.code)
    if (!feature) throw new Error(`Unknown feature ${quota.code}`)
    await client.query(
      `INSERT INTO public.package_feature_quotas (
         id, package_version_id, feature_id, credits_per_property, rollover_policy, data
       ) VALUES ($1,$2,$3,$4,'expire','{}'::jsonb)`,
      [randomUUID(), versionId, feature.id, quota.creditsPerProperty],
    )
  }
  for (const flag of flags) {
    await client.query(
      `INSERT INTO public.package_feature_flags (
         id, package_version_id, feature_code, enabled, data
       ) VALUES ($1,$2,$3,true,'{}'::jsonb)`,
      [randomUUID(), versionId, flag],
    )
  }
  await client.query(
    `UPDATE public.product_package_versions
        SET state = 'PUBLISHED', published_at = NOW()
      WHERE id = $1`,
    [versionId],
  )
  return { packageId, versionId, code }
}
