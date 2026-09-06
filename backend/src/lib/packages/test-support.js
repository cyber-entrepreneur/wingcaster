import { randomUUID } from 'node:crypto'
import { getFeatureByCode } from './registry.js'

export const FREE_PACKAGE_ID = '30400000-0000-4000-8000-000000000001'
export const FREE_VERSION_ID = '30400000-0000-4000-8000-000000000002'

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
} = {}) {
  const packageId = randomUUID()
  const versionId = randomUUID()
  await client.query(
    `INSERT INTO public.product_packages (
       id, code, display_name, tier, target_audience, currency, billing_cadence,
       active, data
     ) VALUES ($1,$2,$3,$4,$5,'USD',$6,true,'{}'::jsonb)`,
    [packageId, code, displayName, tier, audience, cadence],
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
