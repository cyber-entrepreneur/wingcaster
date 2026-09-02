import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { NOW } from '../testing/seed.js'
import { finPostgresSuite } from '../testing/suite.js'
import { runReconciliation } from './runner.js'
import { runBillingCycleWorkerTick } from '../../lib/packages/billing-cycle-worker.js'
import { startSubscription } from '../../lib/packages/lifecycle.js'
import { FREE_VERSION_ID, seedPublishedPackage, withTx } from '../../lib/packages/test-support.js'

async function byCode(pool, now = NOW) {
  const run = await runReconciliation(pool, { now })
  return Object.fromEntries(run.results.map((r) => [r.check_code, r]))
}

finPostgresSuite('reconciliation R115–R118', {}, ({ pool, world }) => {
  it('R115 is GREEN with a valid PENDING_APPROVAL approval; DRIFTs without one', async () => {
    const packageId = randomUUID()
    const versionId = randomUUID()
    await pool().query(
      `INSERT INTO public.product_packages (
         id, code, display_name, tier, target_audience, currency, billing_cadence, active
       ) VALUES ($1,$2,'Pending','starter','agent','USD','monthly',false)`,
      [packageId, `pend-${versionId.slice(0, 8)}`],
    )
    await pool().query(
      `INSERT INTO public.product_package_versions (
         id, package_id, version_number, state, properties_covered, monthly_price_minor
       ) VALUES ($1,$2,1,'PENDING_APPROVAL',1,100)`,
      [versionId, packageId],
    )
    try {
      const drifted = await byCode(pool())
      expect(drifted.R115.result).toBe('DRIFT')

      const approvalId = randomUUID()
      await pool().query(
        `INSERT INTO fin.approval_requests (
           id, environment, tenant_id, action_kind, status, payload_hash,
           created_at, updated_at
         ) VALUES ($1,'LIVE',$2,'MASS_OPERATION','REQUESTED','r115',NOW(),NOW())`,
        [approvalId, world().tenantA.tenantId],
      )
      await pool().query(
        `UPDATE public.product_package_versions
            SET approval_request_id = $2
          WHERE id = $1`,
        [versionId, approvalId],
      )
      const green = await byCode(pool())
      expect(green.R115.result).toBe('GREEN')
    } finally {
      await pool().query(`UPDATE public.product_package_versions SET state = 'DRAFT', approval_request_id = NULL WHERE id = $1`, [versionId])
    }
  })

  it('R116 is GREEN for ACTIVE+PUBLISHED; DRIFTs when the version is not published', async () => {
    const tenantId = randomUUID()
    const now = '2026-09-01T00:00:00.000Z'
    await withTx(pool(), (client) => startSubscription(client, {
      tenantId, packageVersionId: FREE_VERSION_ID, propertiesCommitted: 0, billingCycleStart: now, now,
    }))
    const green = await byCode(pool(), now)
    expect(green.R116.result).toBe('GREEN')

    const draftId = randomUUID()
    const packageId = randomUUID()
    const dirtyTenant = randomUUID()
    await pool().query(
      `INSERT INTO public.product_packages (
         id, code, display_name, tier, target_audience, currency, billing_cadence, active
       ) VALUES ($1,$2,'Draft','starter','agent','USD','monthly',false)`,
      [packageId, `draft-${draftId.slice(0, 8)}`],
    )
    await pool().query(
      `INSERT INTO public.product_package_versions (
         id, package_id, version_number, state, properties_covered, monthly_price_minor,
         effective_from
       ) VALUES ($1,$2,1,'DRAFT',1,100, TIMESTAMPTZ '2020-01-01+00')`,
      [draftId, packageId],
    )
    await pool().query(
      `INSERT INTO public.credit_wallets (tenant_id, currency, credits_remaining, credits_reserved, updated_at)
       VALUES ($1,'USD',0,0,NOW())`,
      [dirtyTenant],
    )
    const subId = randomUUID()
    await pool().query(
      `INSERT INTO public.tenant_subscriptions (
         id, tenant_id, package_version_id, status, billing_cycle_start, billing_cycle_end,
         properties_committed, auto_renew, data
       ) VALUES ($1,$2,$3,'ACTIVE',$4::timestamptz,$5::timestamptz,1,true,'{}'::jsonb)`,
      [subId, dirtyTenant, draftId, now, '2026-10-01T00:00:00.000Z'],
    )
    try {
      const drifted = await byCode(pool(), now)
      expect(drifted.R116.result).toBe('DRIFT')
    } finally {
      await pool().query(`UPDATE public.tenant_subscriptions SET status = 'ENDED', ended_at = NOW() WHERE id = $1`, [subId])
    }
  })

  it('R117 is GREEN under the cap and DRIFTs when active properties exceed it', async () => {
    const tenantId = randomUUID()
    const now = '2026-09-01T00:00:00.000Z'
    await withTx(pool(), (client) => startSubscription(client, {
      tenantId, packageVersionId: FREE_VERSION_ID, propertiesCommitted: 0, billingCycleStart: now, now,
    }))
    const green = await byCode(pool(), now)
    expect(green.R117.result).toBe('GREEN')

    const extra = randomUUID()
    await pool().query(
      `INSERT INTO public.tenant_active_properties (id, tenant_id, property_id, activated_at)
       VALUES ($1,$2,$3,$4::timestamptz)`,
      [extra, tenantId, randomUUID(), now],
    )
    try {
      const drifted = await byCode(pool(), now)
      expect(drifted.R117.result).toBe('DRIFT')
    } finally {
      await pool().query(`UPDATE public.tenant_active_properties SET deactivated_at = NOW() WHERE id = $1`, [extra])
    }
  })

  it('R118 is GREEN after a cycle grant; DRIFTs when last_granted is set without a credit_grants row; R110 stays GREEN', async () => {
    const tenantId = randomUUID()
    const cycleStart = '2026-09-01T00:00:00.000Z'
    await withTx(pool(), async (client) => {
      const paid = await seedPublishedPackage(client, {
        quotas: [{ code: 'publishing.social.instagram', creditsPerProperty: 7 }],
      })
      await startSubscription(client, {
        tenantId,
        packageVersionId: paid.versionId,
        propertiesCommitted: 3,
        billingCycleStart: cycleStart,
        now: cycleStart,
      })
    })
    await runBillingCycleWorkerTick({ pool: pool(), now: cycleStart })
    const wall = new Date().toISOString()
    const green = await byCode(pool(), wall)
    expect(green.R118.result).toBe('GREEN')
    expect(green.R110.result).toBe('GREEN')

    const dirtyId = randomUUID()
    const dirtyTenant = randomUUID()
    await pool().query(
      `INSERT INTO public.credit_wallets (tenant_id, currency, credits_remaining, credits_reserved, updated_at)
       VALUES ($1,'USD',0,0,NOW())`,
      [dirtyTenant],
    )
    await pool().query(
      `INSERT INTO public.tenant_subscriptions (
         id, tenant_id, package_version_id, status, billing_cycle_start, billing_cycle_end,
         properties_committed, auto_renew, data
       ) VALUES ($1,$2,$3,'ENDED',$4::timestamptz,$5::timestamptz,1,false,
                 '{"last_granted_cycle_start":"2026-08-01T00:00:00.000Z","last_granted_credits":10}'::jsonb)`,
      [dirtyId, dirtyTenant, FREE_VERSION_ID, '2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'],
    )
    try {
      const drifted = await byCode(pool(), wall)
      expect(drifted.R118.result).toBe('DRIFT')
    } finally {
      await pool().query(
        `UPDATE public.tenant_subscriptions SET data = '{}'::jsonb WHERE id = $1`,
        [dirtyId],
      )
    }
  })
})
