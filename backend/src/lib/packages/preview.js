/**
 * Pro-ration preview for plan changes. Consumes compiler APIs; does not
 * mutate lifecycle or grant credits. UpgradeDialog uses this before
 * calling lifecycle.changePlan.
 */
import { randomUUID } from 'node:crypto'
import { addCadence, compileGrantFromSnapshot, compileSubscriptionCycleGrant } from './compiler.js'
import { PACKAGE_ERROR, PackageError } from './errors.js'

export async function previewChangePlan(client, {
  subscriptionId,
  newPackageVersionId,
  now = new Date().toISOString(),
} = {}) {
  const { rows: subRows } = await client.query(
    `SELECT * FROM public.tenant_subscriptions WHERE id = $1`,
    [subscriptionId],
  )
  const current = subRows[0]
  if (!current) {
    throw new PackageError(PACKAGE_ERROR.SUBSCRIPTION_NOT_FOUND, `Subscription ${subscriptionId} not found`)
  }
  const { rows: versionRows } = await client.query(
    `SELECT v.*, p.billing_cadence, p.currency, p.code AS package_code, p.display_name
       FROM public.product_package_versions v
       JOIN public.product_packages p ON p.id = v.package_id
      WHERE v.id = $1`,
    [newPackageVersionId],
  )
  const newVersion = versionRows[0]
  if (!newVersion) {
    throw new PackageError(PACKAGE_ERROR.PACKAGE_VERSION_NOT_FOUND, `Package version ${newPackageVersionId} not found`)
  }
  if (newVersion.state !== 'PUBLISHED') {
    throw new PackageError(
      PACKAGE_ERROR.VERSION_NOT_PUBLISHED,
      `Package version ${newPackageVersionId} is ${newVersion.state}`,
    )
  }

  const remainingMs = new Date(current.billing_cycle_end) - new Date(now)
  const totalMs = new Date(current.billing_cycle_end) - new Date(current.billing_cycle_start)
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const oldCompiled = await compileSubscriptionCycleGrant(client, {
    subscriptionId: current.id,
    cycleStart: current.billing_cycle_start,
  })
  const cycleEnd = await addCadence(client, now, newVersion.billing_cadence)
  const quotaRows = await client.query(
    `SELECT q.feature_id, q.credits_per_property, f.code AS feature_code
       FROM public.package_feature_quotas q
       JOIN public.metered_features f ON f.id = q.feature_id
      WHERE q.package_version_id = $1`,
    [newPackageVersionId],
  )
  const newCompiled = compileGrantFromSnapshot({
    subscription: {
      id: randomUUID(),
      package_version_id: newPackageVersionId,
      properties_committed: Number(current.properties_committed),
    },
    quotas: quotaRows.rows.map((row) => ({
      feature_id: row.feature_id,
      feature_code: row.feature_code,
      credits_per_property: Number(row.credits_per_property),
    })),
    cycleStart: now,
    cycleEnd,
  })
  const oldRemaining = Math.floor(oldCompiled.total_credits * fraction)
  const newRemaining = Math.floor(newCompiled.total_credits * fraction)
  const net = newRemaining - oldRemaining
  return {
    subscription_id: current.id,
    current_package_version_id: current.package_version_id,
    new_package_version_id: newPackageVersionId,
    new_package_code: newVersion.package_code,
    new_package_display_name: newVersion.display_name,
    fraction,
    old_remaining: oldRemaining,
    new_remaining: newRemaining,
    net,
    currency: newVersion.currency,
    new_monthly_price_minor: Number(newVersion.monthly_price_minor),
  }
}
