import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { startSubscription, changePlan, cancelAtPeriodEnd, cancelImmediate } from './lifecycle.js'
import { FREE_PACKAGE_ID, FREE_VERSION_ID, seedPublishedPackage, withTx } from './test-support.js'

finPostgresSuite('packages migrations 302–304', {}, ({ pool }) => {
  it('applies schema, seeds free-tier, and supports start → paid → cancel-end → ended', async () => {
    const tables = await pool().query(
      `SELECT to_regclass('public.metered_features') AS features,
              to_regclass('public.product_packages') AS packages,
              to_regclass('public.tenant_subscriptions') AS subs`,
    )
    expect(tables.rows[0].features).toBeTruthy()
    expect(tables.rows[0].packages).toBeTruthy()
    expect(tables.rows[0].subs).toBeTruthy()

    const free = await pool().query(
      `SELECT p.code, p.tier, p.active, v.state, v.properties_covered, v.monthly_price_minor
         FROM public.product_packages p
         JOIN public.product_package_versions v ON v.package_id = p.id
        WHERE p.id = $1 AND v.id = $2`,
      [FREE_PACKAGE_ID, FREE_VERSION_ID],
    )
    expect(free.rows[0].code).toBe('free-agent')
    expect(free.rows[0].tier).toBe('free')
    expect(free.rows[0].active).toBe(true)
    expect(free.rows[0].state).toBe('PUBLISHED')
    expect(Number(free.rows[0].properties_covered)).toBe(0)
    expect(Number(free.rows[0].monthly_price_minor)).toBe(0)

    const tenantId = randomUUID()
    const now = '2026-09-01T00:00:00.000Z'
    const { started, paidSub, canceled, ended } = await withTx(pool(), async (client) => {
      const startedRow = await startSubscription(client, {
        tenantId,
        packageVersionId: FREE_VERSION_ID,
        propertiesCommitted: 0,
        billingCycleStart: now,
        now,
      })
      const paid = await seedPublishedPackage(client, {
        quotas: [{ code: 'publishing.social.instagram', creditsPerProperty: 1 }],
      })
      const changed = await changePlan(client, {
        subscriptionId: startedRow.id,
        newPackageVersionId: paid.versionId,
        prorate: false,
        now,
      })
      const canceledRow = await cancelAtPeriodEnd(client, {
        subscriptionId: changed.subscription.id,
        reason: 'eop',
        now,
      })
      const endedRow = await cancelImmediate(client, {
        subscriptionId: changed.subscription.id,
        reason: 'close',
        now,
      })
      return {
        started: startedRow,
        paidSub: changed.subscription,
        canceled: canceledRow,
        ended: endedRow,
      }
    })
    expect(started.status).toBe('ACTIVE')
    expect(paidSub.package_version_id).not.toBe(FREE_VERSION_ID)
    expect(canceled.status).toBe('CANCELED_AT_PERIOD_END')
    expect(ended.status).toBe('ENDED')
  })

  it('blocks UPDATE of properties_covered on a PUBLISHED version', async () => {
    await expect(pool().query(
      `UPDATE public.product_package_versions
          SET properties_covered = 99
        WHERE id = $1`,
      [FREE_VERSION_ID],
    )).rejects.toThrow(/PACKAGE_VERSION_IMMUTABLE/)
  })
})
