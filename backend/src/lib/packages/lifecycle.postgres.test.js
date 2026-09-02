import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { PACKAGE_ERROR } from './errors.js'
import {
  cancelAtPeriodEnd, cancelImmediate, changePlan, pauseSubscription,
  resumeSubscription, startSubscription,
} from './lifecycle.js'
import { FREE_VERSION_ID, seedPublishedPackage, withTx } from './test-support.js'

finPostgresSuite('subscription lifecycle', {}, ({ pool }) => {
  it('start → pause → resume → cancel at period end → immediate end', async () => {
    const tenantId = randomUUID()
    const now = '2026-09-01T00:00:00.000Z'
    const sub = await withTx(pool(), async (client) => {
      return startSubscription(client, {
        tenantId,
        packageVersionId: FREE_VERSION_ID,
        propertiesCommitted: 0,
        billingCycleStart: now,
        now,
      })
    })
    expect(sub.status).toBe('ACTIVE')

    const paused = await withTx(pool(), (client) => pauseSubscription(client, {
      subscriptionId: sub.id, actorId: randomUUID(), reason: 'admin', now,
    }))
    expect(paused.status).toBe('PAUSED')

    const resumed = await withTx(pool(), (client) => resumeSubscription(client, {
      subscriptionId: sub.id, actorId: randomUUID(), now,
    }))
    expect(resumed.status).toBe('ACTIVE')

    const pendingEnd = await withTx(pool(), (client) => cancelAtPeriodEnd(client, {
      subscriptionId: sub.id, actorId: randomUUID(), reason: 'user', now,
    }))
    expect(pendingEnd.status).toBe('CANCELED_AT_PERIOD_END')
    expect(pendingEnd.auto_renew).toBe(false)

    const ended = await withTx(pool(), (client) => cancelImmediate(client, {
      subscriptionId: sub.id, actorId: randomUUID(), reason: 'now', now,
    }))
    expect(ended.status).toBe('ENDED')

    const future = await withTx(pool(), (client) => startSubscription(client, {
      tenantId: randomUUID(),
      packageVersionId: FREE_VERSION_ID,
      propertiesCommitted: 0,
      billingCycleStart: '2027-01-01T00:00:00.000Z',
      now: '2026-09-01T00:00:00.000Z',
    }))
    expect(future.status).toBe('PENDING_START')

    await expect(withTx(pool(), (client) => pauseSubscription(client, {
      subscriptionId: future.id,
    }))).rejects.toMatchObject({ code: PACKAGE_ERROR.INVALID_TRANSITION })

    const audits = await pool().query(
      `SELECT action FROM fin.financial_audit_events
        WHERE target_id = $1 ORDER BY created_at`,
      [sub.id],
    )
    expect(audits.rows.map((r) => r.action)).toEqual(expect.arrayContaining([
      'subscription.start',
      'subscription.pause',
      'subscription.resume',
      'subscription.cancel_at_period_end',
      'subscription.cancel_immediate',
    ]))
  })

  it('enforces one non-ended subscription per tenant', async () => {
    const tenantId = randomUUID()
    const now = '2026-09-01T00:00:00.000Z'
    await withTx(pool(), (client) => startSubscription(client, {
      tenantId, packageVersionId: FREE_VERSION_ID, propertiesCommitted: 0, billingCycleStart: now, now,
    }))
    await expect(withTx(pool(), (client) => startSubscription(client, {
      tenantId, packageVersionId: FREE_VERSION_ID, propertiesCommitted: 0, billingCycleStart: now, now,
    }))).rejects.toMatchObject({ code: PACKAGE_ERROR.ACTIVE_SUBSCRIPTION_EXISTS })
  })

  it('changePlan ends the current subscription and starts a new one; prorate grants the net remaining', async () => {
    const tenantId = randomUUID()
    const now = '2026-09-15T00:00:00.000Z'
    const cycleStart = '2026-09-01T00:00:00.000Z'
    const { currentId, growthVersionId } = await withTx(pool(), async (client) => {
      const starter = await seedPublishedPackage(client, {
        code: `starter-${randomUUID().slice(0, 8)}`,
        quotas: [{ code: 'publishing.social.instagram', creditsPerProperty: 10 }],
      })
      const growth = await seedPublishedPackage(client, {
        code: `growth-${randomUUID().slice(0, 8)}`,
        tier: 'growth',
        quotas: [{ code: 'publishing.social.instagram', creditsPerProperty: 40 }],
      })
      const current = await startSubscription(client, {
        tenantId,
        packageVersionId: starter.versionId,
        propertiesCommitted: 2,
        billingCycleStart: cycleStart,
        now: cycleStart,
      })
      return { currentId: current.id, growthVersionId: growth.versionId }
    })
    const result = await withTx(pool(), (client) => changePlan(client, {
      subscriptionId: currentId,
      newPackageVersionId: growthVersionId,
      prorate: true,
      actorId: randomUUID(),
      now,
    }))
    expect(result.previous.status).toBe('ENDED')
    expect(result.subscription.status).toBe('ACTIVE')
    expect(result.subscription.id).not.toBe(result.previous.id)
    expect(result.fraction).toBeGreaterThan(0)
    expect(result.net).toBeGreaterThan(0)
    expect(result.prorateGrant.replay).toBe(false)
    expect(Number(result.prorateGrant.grant.amount)).toBe(result.net)

    const grants = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.credit_grants
        WHERE tenant_id = $1 AND source = 'subscription_cycle'`,
      [tenantId],
    )
    expect(grants.rows[0].n).toBe(1)
  })
})
