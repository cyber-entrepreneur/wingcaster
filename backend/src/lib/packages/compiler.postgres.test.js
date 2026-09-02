import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { compileSubscriptionCycleGrant } from './compiler.js'
import { startSubscription } from './lifecycle.js'
import { FREE_TIER_FLAG_CODES, SEEDED_FEATURE_CODES } from './registry.js'
import { FREE_VERSION_ID, seedPublishedPackage, withTx } from './test-support.js'

finPostgresSuite('packages compiler (postgres)', {}, ({ pool }) => {
  it('DB compiler matches snapshot totals for a seeded paid package', async () => {
    const tenantId = randomUUID()
    const cycleStart = '2026-09-01T00:00:00.000Z'
    const compiled = await withTx(pool(), async (client) => {
      const paid = await seedPublishedPackage(client, {
        quotas: [
          { code: 'publishing.social.instagram', creditsPerProperty: 5 },
          { code: 'ai.post_creation', creditsPerProperty: 3 },
        ],
      })
      const sub = await startSubscription(client, {
        tenantId,
        packageVersionId: paid.versionId,
        propertiesCommitted: 10,
        billingCycleStart: cycleStart,
        now: cycleStart,
      })
      return compileSubscriptionCycleGrant(client, {
        subscriptionId: sub.id,
        cycleStart,
      })
    })
    expect(compiled.total_credits).toBe(80)
    expect(compiled.breakdown).toHaveLength(2)
    expect(compiled.grant_ref.idempotency_key).toBe(
      `subscription_cycle:${compiled.grant_ref.subscription_id}:${cycleStart}`,
    )
  })

  it('seeds every metered feature the platform runs today plus free-tier flags', async () => {
    const features = await pool().query(
      `SELECT code FROM public.metered_features WHERE active = true ORDER BY code`,
    )
    const codes = features.rows.map((r) => r.code)
    for (const code of SEEDED_FEATURE_CODES) {
      expect(codes).toContain(code)
    }
    const flags = await pool().query(
      `SELECT feature_code FROM public.package_feature_flags
        WHERE package_version_id = $1
        ORDER BY feature_code`,
      [FREE_VERSION_ID],
    )
    expect(flags.rows.map((r) => r.feature_code).sort()).toEqual([...FREE_TIER_FLAG_CODES].sort())
    const quotas = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.package_feature_quotas
        WHERE package_version_id = $1`,
      [FREE_VERSION_ID],
    )
    expect(quotas.rows[0].n).toBe(0)
  })
})
