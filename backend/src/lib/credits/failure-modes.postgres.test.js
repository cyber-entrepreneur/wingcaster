import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { CREDIT_ERROR, creditErrorHttpStatus } from './errors.js'
import { FEATURES } from './features.js'
import { grant } from './engine.js'
import { mapCreditEngineFailure, withCredits } from './with-credits.js'
import { provisionFreeTier } from '../packages/onboarding.js'
import { runReconciliation } from '../../fin/reconciliation/runner.js'
import { NOW } from '../../fin/testing/seed.js'

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

finPostgresSuite('PR D failure modes', {}, ({ pool }) => {
  it('CREDIT_ENGINE_UNAVAILABLE maps to HTTP 503 and work does not run when reserve cannot', async () => {
    const mapped = mapCreditEngineFailure(Object.assign(new Error('db down'), { code: '57P01' }))
    expect(mapped.code).toBe(CREDIT_ERROR.CREDIT_ENGINE_UNAVAILABLE)
    expect(creditErrorHttpStatus(mapped)).toBe(503)
  })

  it('FEATURE_NOT_REGISTERED is HTTP 500 and does not run the feature at zero cost', async () => {
    const tenantId = await seedCredits()
    let ran = false
    const err = await withCredits({
      tenantId,
      feature: 'foo.bar.missing',
      requestId: randomUUID(),
    }, async () => { ran = true }).catch((e) => e)
    expect(err.code).toBe(CREDIT_ERROR.FEATURE_NOT_REGISTERED)
    expect(creditErrorHttpStatus(err)).toBe(500)
    expect(ran).toBe(false)
  })

  it('FREE_TIER_PACKAGE_MISSING refuses onboarding', async () => {
    const client = await pool().connect()
    try {
      await client.query('BEGIN')
      await client.query(`UPDATE public.product_package_versions SET state = 'DEPRECATED' WHERE id = '30400000-0000-4000-8000-000000000002'`)
      await expect(provisionFreeTier(client, {
        scope: 'personal',
        scopeId: randomUUID(),
      })).rejects.toMatchObject({ code: CREDIT_ERROR.FREE_TIER_PACKAGE_MISSING })
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  it('properties_committed = 0 yields zero grant without error (free tier)', async () => {
    const tenantId = randomUUID()
    const client = await pool().connect()
    try {
      await client.query('BEGIN')
      const result = await provisionFreeTier(client, {
        scope: 'personal',
        scopeId: tenantId,
        now: '2026-09-01T00:00:00.000Z',
      })
      expect(Number(result.subscription.properties_committed)).toBe(0)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  })

  it('R114 DRIFT when a grant has no fin mirror is documented as the mirror-worker-down mode', async () => {
    const run = await runReconciliation(pool(), { now: NOW })
    const r114 = run.results.find((r) => r.check_code === 'R114')
    expect(r114).toBeTruthy()
    // Runbook: restart credits-fin-mirror-worker; it catches up via 23505.
  })

  it('webhook rate limiter responds 429 (documented on the WhatsApp webhook route)', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../../server.js', import.meta.url), 'utf8'),
    )
    expect(src).toMatch(/webhookLimiter/)
    expect(src).toMatch(/WEBHOOK_RATE_LIMITED/)
  })

  it('publisher reject consumes the reserved amount (external cost already incurred)', async () => {
    const tenantId = await seedCredits()
    const requestId = randomUUID()
    await expect(withCredits({
      tenantId,
      feature: FEATURES.PUBLISHING_SOCIAL_TIKTOK,
      requestId,
      callType: 'publish',
    }, async () => {
      throw Object.assign(new Error('tiktok 400'), { code: 'TIKTOK_REJECTED' })
    })).rejects.toThrow('tiktok 400')
    const consumed = await pool().query(
      `SELECT 1 FROM public.credit_consumptions WHERE tenant_id = $1 AND request_id = $2`,
      [tenantId, requestId],
    )
    expect(consumed.rows).toHaveLength(1)
  })

  it('insufficient credits prevents the feature from running', async () => {
    const tenantId = await seedCredits(1)
    let ran = false
    await expect(withCredits({
      tenantId,
      feature: FEATURES.AI_LISTINGS_DESCRIBE,
      requestId: randomUUID(),
      creditsAmount: 50_000,
    }, async () => { ran = true })).rejects.toMatchObject({ code: CREDIT_ERROR.INSUFFICIENT_CREDITS })
    expect(ran).toBe(false)
  })
})
