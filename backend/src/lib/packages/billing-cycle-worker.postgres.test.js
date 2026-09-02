import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { runBillingCycleWorkerTick } from './billing-cycle-worker.js'
import { startSubscription } from './lifecycle.js'
import { seedPublishedPackage, withTx } from './test-support.js'

finPostgresSuite('billing-cycle worker', {}, ({ pool }) => {
  it('grants the compiled amount, advances next_grant_at, and is idempotent', async () => {
    const tenantId = randomUUID()
    const cycleStart = '2026-09-01T00:00:00.000Z'
    const sub = await withTx(pool(), async (client) => {
      const paid = await seedPublishedPackage(client, {
        quotas: [
          { code: 'publishing.social.instagram', creditsPerProperty: 10 },
          { code: 'ai.post_creation', creditsPerProperty: 2 },
        ],
      })
      return startSubscription(client, {
        tenantId,
        packageVersionId: paid.versionId,
        propertiesCommitted: 4,
        billingCycleStart: cycleStart,
        now: cycleStart,
      })
    })

    const expected = 4 * 10 + 4 * 2
    const tick = await runBillingCycleWorkerTick({
      pool: pool(),
      now: cycleStart,
    })
    expect(tick.skipped).toBe(false)
    expect(tick.granted).toBeGreaterThanOrEqual(1)

    const grants = await pool().query(
      `SELECT amount, source, grant_ref FROM public.credit_grants
        WHERE tenant_id = $1 AND source = 'subscription_cycle'`,
      [tenantId],
    )
    expect(grants.rows).toHaveLength(1)
    expect(Number(grants.rows[0].amount)).toBe(expected)
    expect(grants.rows[0].grant_ref.subscription_id).toBe(sub.id)
    expect(grants.rows[0].grant_ref.idempotency_key).toBe(
      `subscription_cycle:${sub.id}:${cycleStart}`,
    )

    const after = await pool().query(
      `SELECT billing_cycle_start, billing_cycle_end, next_grant_at
         FROM public.tenant_subscriptions WHERE id = $1`,
      [sub.id],
    )
    expect(new Date(after.rows[0].billing_cycle_start).toISOString()).toBe(
      new Date(sub.billing_cycle_end).toISOString(),
    )
    expect(new Date(after.rows[0].next_grant_at).toISOString()).toBe(
      new Date(after.rows[0].billing_cycle_start).toISOString(),
    )
    expect(new Date(after.rows[0].billing_cycle_end).getTime()).toBeGreaterThan(
      new Date(after.rows[0].billing_cycle_start).getTime(),
    )

    const again = await runBillingCycleWorkerTick({
      pool: pool(),
      now: cycleStart,
    })
    expect(again.granted).toBe(0)
    const grantsAgain = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.credit_grants
        WHERE tenant_id = $1 AND source = 'subscription_cycle'`,
      [tenantId],
    )
    expect(grantsAgain.rows[0].n).toBe(1)
  })
})
