import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { FEATURES } from '../credits/features.js'
import { grant } from '../credits/engine.js'
import { publishInstagramCarousel } from './instagram.js'

function graphOk(id) {
  return {
    ok: true,
    json: async () => ({ id }),
  }
}

finPostgresSuite('instagram metering', {}, ({ pool }) => {
  beforeEach(() => {
    process.env.INSTAGRAM_PAGE_ACCESS_TOKEN = 'test-token'
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'ig-account-1'
    vi.stubGlobal('fetch', vi.fn(async () => graphOk(`media-${randomUUID().slice(0, 8)}`)))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.INSTAGRAM_PAGE_ACCESS_TOKEN
    delete process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  })

  it('publishInstagramCarousel meters exactly once per publish', async () => {
    const tenantId = randomUUID()
    await grant({
      tenantId,
      source: 'promo',
      amount: 10_000,
      currency: 'USD',
      grantRef: { idempotency_key: `seed:${tenantId}`, reason: 'instagram meter test' },
    })

    const before = await pool().query(
      `SELECT count(*)::int AS n FROM public.credit_consumptions WHERE tenant_id = $1 AND feature = $2`,
      [tenantId, FEATURES.PUBLISHING_SOCIAL_INSTAGRAM],
    )

    await publishInstagramCarousel({
      tenantId,
      imageUrls: ['https://example.test/a.jpg', 'https://example.test/b.jpg'],
      caption: 'carousel',
      businessAccountId: 'ig-account-1',
      accessToken: 'test-token',
    })

    const after = await pool().query(
      `SELECT count(*)::int AS n FROM public.credit_consumptions WHERE tenant_id = $1 AND feature = $2`,
      [tenantId, FEATURES.PUBLISHING_SOCIAL_INSTAGRAM],
    )
    expect(after.rows[0].n - before.rows[0].n).toBe(1)
  })
})
