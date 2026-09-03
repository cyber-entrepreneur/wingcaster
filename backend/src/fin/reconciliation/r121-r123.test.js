import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { NOW } from '../testing/seed.js'
import { finPostgresSuite } from '../testing/suite.js'
import { runReconciliation } from './runner.js'
import { startSubscription } from '../../lib/packages/lifecycle.js'
import { FREE_VERSION_ID, seedPublishedPackage, withTx } from '../../lib/packages/test-support.js'
import { grant, consume, reserve } from '../../lib/credits/engine.js'
import { FEATURES } from '../../lib/credits/features.js'

async function byCode(pool, now = NOW) {
  const run = await runReconciliation(pool, { now })
  return Object.fromEntries(run.results.map((r) => [r.check_code, r]))
}

finPostgresSuite('reconciliation R121–R123', {}, ({ pool }) => {
  it('R121 is GREEN when ACTIVE subscriptions have wallets; DRIFTs if the wallet is missing', async () => {
    const tenantId = randomUUID()
    const now = '2026-09-01T00:00:00.000Z'
    await withTx(pool(), (client) => startSubscription(client, {
      tenantId, packageVersionId: FREE_VERSION_ID, propertiesCommitted: 0, billingCycleStart: now, now,
    }))
    const green = await byCode(pool(), now)
    expect(green.R121.result).toBe('GREEN')

    const dirtyTenant = randomUUID()
    const subId = randomUUID()
    await pool().query(
      `INSERT INTO public.credit_wallets (tenant_id, currency, credits_remaining, credits_reserved, updated_at)
       VALUES ($1,'USD',0,0,NOW())`,
      [dirtyTenant],
    )
    await pool().query(
      `INSERT INTO public.tenant_subscriptions (
         id, tenant_id, package_version_id, status, billing_cycle_start, billing_cycle_end,
         properties_committed, auto_renew, data
       ) VALUES ($1,$2,$3,'ACTIVE',$4::timestamptz,$5::timestamptz,0,true,'{}'::jsonb)`,
      [subId, dirtyTenant, FREE_VERSION_ID, now, '2026-10-01T00:00:00.000Z'],
    )
    const client = await pool().connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL session_replication_role = replica')
      await client.query(`DELETE FROM public.credit_wallets WHERE tenant_id = $1`, [dirtyTenant])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
    try {
      const drifted = await byCode(pool(), now)
      expect(drifted.R121.result).toBe('DRIFT')
    } finally {
      await pool().query(`UPDATE public.tenant_subscriptions SET status = 'ENDED', ended_at = NOW() WHERE id = $1`, [subId])
    }
  })

  it('R122 is GREEN for registry features; DRIFTs on an unknown consumption feature', async () => {
    const tenantId = randomUUID()
    await grant({
      tenantId, source: 'promo', amount: 500, currency: 'USD',
      grantRef: { idempotency_key: `r122:${tenantId}`, reason: 'seed' },
    })
    const requestId = randomUUID()
    await reserve({ tenantId, feature: FEATURES.PUBLISHING_SOCIAL_X, requestId, creditsAmount: 100 })
    await consume({
      tenantId, feature: FEATURES.PUBLISHING_SOCIAL_X, requestId, callType: 'publish', creditsAmount: 100,
    })
    const green = await byCode(pool())
    expect(green.R122.result).toBe('GREEN')

    await pool().query(
      `INSERT INTO public.credit_consumptions (
         id, tenant_id, feature, call_type, request_id, credits_amount, consumed_at
       ) VALUES ($1,$2,'retired.feature.gone','x',$3,1,NOW())`,
      [randomUUID(), tenantId, randomUUID()],
    )
    try {
      const drifted = await byCode(pool())
      expect(drifted.R122.result).toBe('DRIFT')
    } finally {
      const cleaner = await pool().connect()
      try {
        await cleaner.query('BEGIN')
        await cleaner.query('SET LOCAL session_replication_role = replica')
        await cleaner.query(`DELETE FROM public.credit_consumptions WHERE feature = 'retired.feature.gone'`)
        await cleaner.query('COMMIT')
      } catch (error) {
        await cleaner.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        cleaner.release()
      }
    }
  })

  it('R123 is GREEN under 2× typical use; DRIFTs when usage exceeds 2× quota', async () => {
    const tenantId = randomUUID()
    const now = '2026-09-01T00:00:00.000Z'
    await withTx(pool(), async (client) => {
      const paid = await seedPublishedPackage(client, {
        quotas: [{ code: 'publishing.social.instagram', creditsPerProperty: 10 }],
      })
      await startSubscription(client, {
        tenantId,
        packageVersionId: paid.versionId,
        propertiesCommitted: 1,
        billingCycleStart: now,
        now,
      })
    })
    const green = await byCode(pool(), now)
    expect(green.R123.result).toBe('GREEN')

    await grant({
      tenantId, source: 'promo', amount: 5_000, currency: 'USD',
      grantRef: { idempotency_key: `r123:${tenantId}`, reason: 'over' },
    })
    for (let i = 0; i < 3; i += 1) {
      const requestId = `r123-${i}-${randomUUID()}`
      await reserve({
        tenantId, feature: FEATURES.PUBLISHING_SOCIAL_INSTAGRAM, requestId, creditsAmount: 10,
      })
      await consume({
        tenantId, feature: FEATURES.PUBLISHING_SOCIAL_INSTAGRAM, requestId,
        callType: 'publish', creditsAmount: 10,
      })
    }
    const drifted = await byCode(pool(), now)
    expect(drifted.R123.result).toBe('DRIFT')
  })
})
