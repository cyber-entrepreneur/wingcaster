import { insertAudit, insertOutbox } from '../../fin/ledger/write.js'

export const PACKAGES_ENVIRONMENT = 'LIVE'

export async function writeTransitionArtifacts(client, {
  action,
  topic,
  subscription,
  beforeState,
  afterState,
  actorId = null,
  reason = null,
  extra = {},
  now,
}) {
  const ts = now || new Date().toISOString()
  await insertAudit(client, {
    environment: PACKAGES_ENVIRONMENT,
    actorType: actorId ? 'USER' : 'SYSTEM',
    actorId,
    actorEmail: 'packages@system',
    action,
    targetType: 'tenant_subscriptions',
    targetId: subscription.id,
    beforeState,
    afterState,
    reasonCode: reason || action,
    now: ts,
  })
  try {
    await insertOutbox(client, {
      environment: PACKAGES_ENVIRONMENT,
      topic,
      dedupeKey: `${topic}:${subscription.id}:${ts}:${action}`,
      payload: {
        subscription_id: subscription.id,
        tenant_id: subscription.tenant_id,
        status: afterState?.status || subscription.status,
        package_version_id: subscription.package_version_id,
        reason,
        ...extra,
      },
      now: ts,
    })
  } catch (error) {
    if (error.code !== '23505') throw error
  }
}

export async function writeOutbox(client, { topic, dedupeKey, payload, now }) {
  try {
    await insertOutbox(client, {
      environment: PACKAGES_ENVIRONMENT,
      topic,
      dedupeKey,
      payload,
      now: now || new Date().toISOString(),
    })
  } catch (error) {
    if (error.code !== '23505') throw error
  }
}

export function snapshotSubscription(row) {
  if (!row) return null
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    package_version_id: row.package_version_id,
    status: row.status,
    billing_cycle_start: row.billing_cycle_start,
    billing_cycle_end: row.billing_cycle_end,
    next_grant_at: row.next_grant_at,
    properties_committed: Number(row.properties_committed),
    auto_renew: row.auto_renew,
    version: Number(row.version),
  }
}
