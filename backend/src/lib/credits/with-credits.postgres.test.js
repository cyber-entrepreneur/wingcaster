import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { CREDIT_ERROR } from './errors.js'
import { FEATURES } from './features.js'
import { consume, grant, release, reserve, upsertSpendCap } from './engine.js'
import { withCredits, mapCreditEngineFailure } from './with-credits.js'
import { checkEntitlement } from './feature-check.js'
import { createAiPost, rateProperty, activateLeadGen } from './ai-stubs.js'
import { publishOlx } from '../notifications/realestate.js'
import { approvalThresholdMicroUsd, DEFAULT_APPROVAL_THRESHOLD_MICRO_USD } from './pricing.js'

async function seedCredits(amount = 10_000) {
  const tenantId = randomUUID()
  await grant({
    tenantId,
    source: 'promo',
    amount,
    currency: 'USD',
    grantRef: { idempotency_key: `seed:${tenantId}`, reason: 'test seed' },
  })
  return tenantId
}

finPostgresSuite('withCredits feature wiring', {}, ({ pool }) => {
  it('reserves, runs work, consumes at registry credits_per_unit', async () => {
    const tenantId = await seedCredits(50_000)
    const requestId = randomUUID()
    const result = await withCredits({
      tenantId,
      feature: FEATURES.AI_LISTINGS_DESCRIBE,
      requestId,
      callType: 'describe',
      relatedEntityType: 'listing',
      relatedEntityId: 'listing-1',
    }, async () => ({ ok: true }))
    expect(result).toEqual({ ok: true })
    const consumed = await pool().query(
      `SELECT credits_amount, feature, call_type FROM public.credit_consumptions
        WHERE tenant_id = $1 AND request_id = $2`,
      [tenantId, requestId],
    )
    expect(consumed.rows[0].feature).toBe(FEATURES.AI_LISTINGS_DESCRIBE)
    expect(Number(consumed.rows[0].credits_amount)).toBe(500)
  })

  it('accepts the spec two-argument callback form', async () => {
    const tenantId = await seedCredits()
    const out = await withCredits({
      tenantId,
      feature: FEATURES.COMMUNICATION_SMS_PER_MESSAGE,
      requestId: randomUUID(),
      callType: 'send',
    }, async () => 42)
    expect(out).toBe(42)
  })

  it('FEATURE_NOT_REGISTERED fails closed without running work', async () => {
    const tenantId = await seedCredits()
    let ran = false
    await expect(withCredits({
      tenantId,
      feature: 'not.a.real.feature',
      requestId: randomUUID(),
    }, async () => { ran = true })).rejects.toMatchObject({ code: CREDIT_ERROR.FEATURE_NOT_REGISTERED })
    expect(ran).toBe(false)
  })

  it('spend caps fire on the withCredits reserve hot path', async () => {
    const tenantId = await seedCredits()
    await upsertSpendCap({
      tenantId, feature: FEATURES.PUBLISHING_SOCIAL_INSTAGRAM, windowKind: 'DAY', maxCredits: 50,
    })
    await expect(withCredits({
      tenantId,
      feature: FEATURES.PUBLISHING_SOCIAL_INSTAGRAM,
      requestId: randomUUID(),
      callType: 'publish',
    }, async () => true)).rejects.toMatchObject({ code: CREDIT_ERROR.SPEND_CAP_EXCEEDED })
  })

  it('publisher reject still consumes the reserved amount (not overcharged)', async () => {
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    await expect(withCredits({
      tenantId,
      feature: FEATURES.PUBLISHING_SOCIAL_INSTAGRAM,
      requestId,
      callType: 'publish',
    }, async () => {
      const err = new Error('IG rejected')
      err.code = 'INSTAGRAM_FEED_PUBLISH_FAILED'
      throw err
    })).rejects.toMatchObject({ message: 'IG rejected' })
    const consumed = await pool().query(
      `SELECT credits_amount FROM public.credit_consumptions WHERE tenant_id = $1 AND request_id = $2`,
      [tenantId, requestId],
    )
    expect(consumed.rows).toHaveLength(1)
    expect(Number(consumed.rows[0].credits_amount)).toBe(100)
  })

  it('AI failure releases the reservation (no consume)', async () => {
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    await expect(withCredits({
      tenantId,
      feature: FEATURES.AI_LISTINGS_DESCRIBE,
      requestId,
      callType: 'describe',
    }, async () => { throw new Error('model down') })).rejects.toThrow('model down')
    const consumed = await pool().query(
      `SELECT 1 FROM public.credit_consumptions WHERE tenant_id = $1 AND request_id = $2`,
      [tenantId, requestId],
    )
    expect(consumed.rows).toHaveLength(0)
    const reservation = await pool().query(
      `SELECT status FROM public.credit_reservations WHERE tenant_id = $1 AND request_id = $2`,
      [tenantId, requestId],
    )
    expect(reservation.rows[0].status).toBe('RELEASED')
  })

  it('UNIQUE consume is idempotent for the same request_id', async () => {
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    await withCredits({
      tenantId, feature: FEATURES.ASSETS_RENDER_SOCIAL_CARD, requestId, callType: 'render',
    }, async () => 'a')
    await reserve({
      tenantId, feature: FEATURES.ASSETS_RENDER_SOCIAL_CARD, requestId, creditsAmount: 100,
    })
    const second = await consume({
      tenantId, feature: FEATURES.ASSETS_RENDER_SOCIAL_CARD, requestId,
      callType: 'render', creditsAmount: 100,
    })
    expect(second.replay).toBe(true)
  })

  it('checkEntitlement reports soft warning without hard-blocking remaining balance', async () => {
    const tenantId = await seedCredits()
    const entitlement = await checkEntitlement(tenantId, FEATURES.PUBLISHING_SOCIAL_INSTAGRAM)
    expect(entitlement.registered).toBe(true)
    expect(entitlement.enabled).toBe(true)
    expect(entitlement.quota_used_this_cycle).toBe(0)
  })

  it('opts.work override still bypasses real producers; activateLeadGen stays stubbed', async () => {
    const tenantId = await seedCredits()
    await expect(publishOlx({
      creditContext: { tenantId, requestId: randomUUID() },
    })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    await expect(rateProperty({
      creditContext: { tenantId, requestId: randomUUID() },
      work: async () => ({ rating: 5 }),
    })).resolves.toEqual({ rating: 5 })
    await expect(activateLeadGen({
      creditContext: { tenantId, requestId: randomUUID() },
      work: async () => ({ activated: true }),
    })).resolves.toEqual({ activated: true })
    await expect(activateLeadGen({
      creditContext: { tenantId, requestId: randomUUID() },
    })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
    await expect(createAiPost({
      creditContext: { tenantId, requestId: randomUUID() },
      work: async () => ({ copy: 'hi' }),
    })).resolves.toEqual({ copy: 'hi' })
  })

  it('approval threshold default is $10 and maps engine-unavailable codes', () => {
    expect(DEFAULT_APPROVAL_THRESHOLD_MICRO_USD).toBe(10_000_000)
    expect(approvalThresholdMicroUsd()).toBe(10_000_000)
    const mapped = mapCreditEngineFailure(Object.assign(new Error('down'), { code: 'ECONNREFUSED' }))
    expect(mapped.code).toBe(CREDIT_ERROR.CREDIT_ENGINE_UNAVAILABLE)
  })
})
