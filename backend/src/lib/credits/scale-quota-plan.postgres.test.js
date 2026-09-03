import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { tenantQuotaSql } from './feature-check.js'
import { grant } from './engine.js'
import { FEATURES } from './features.js'

finPostgresSuite('tenant quota query plan', {}, ({ pool }) => {
  it('per-feature quota query uses the composite tenant+feature index (index-only or index scan)', async () => {
    const tenantId = randomUUID()
    await grant({
      tenantId, source: 'promo', amount: 5_000_000, currency: 'USD',
      grantRef: { idempotency_key: `scale:${tenantId}`, reason: 'scale seed' },
    })
    await pool().query(
      `INSERT INTO public.credit_consumptions (
         id, tenant_id, feature, call_type, request_id, credits_amount, consumed_at
       )
       SELECT gen_random_uuid(), $1, $2, 'publish', 'bulk-' || g::text, 100,
              TIMESTAMPTZ '2026-06-01+00' + (g || ' seconds')::interval
         FROM generate_series(1, 20000) AS g`,
      [tenantId, FEATURES.PUBLISHING_SOCIAL_INSTAGRAM],
    )
    await pool().query('VACUUM ANALYZE public.credit_consumptions')
    const client = await pool().connect()
    try {
      await client.query('SET enable_seqscan = off')
      const start = '2026-01-01T00:00:00.000Z'
      const end = '2026-12-31T00:00:00.000Z'
      const plan = await client.query(
        `EXPLAIN (FORMAT JSON) ${tenantQuotaSql()}`,
        [tenantId, start, end, FEATURES.PUBLISHING_SOCIAL_INSTAGRAM],
      )
      const text = JSON.stringify(plan.rows)
      expect(text).toMatch(/Index Only Scan|Index Scan/)
      expect(text).toMatch(/idx_credit_consumptions_tenant_feature_consumed|idx_credit_consumptions_tenant_consumed/)
    } finally {
      await client.query('SET enable_seqscan = on').catch(() => {})
      client.release()
    }
  }, 120_000)
})
