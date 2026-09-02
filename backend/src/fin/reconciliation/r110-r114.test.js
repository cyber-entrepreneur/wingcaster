import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { NOW } from '../testing/seed.js'
import { finPostgresSuite } from '../testing/suite.js'
import { runReconciliation } from './runner.js'
import { consume, grant, reserve } from '../../lib/credits/engine.js'
import { FEATURES } from '../../lib/credits/features.js'
import { runCreditFinMirrorTick } from '../../lib/credits/fin-mirror-worker.js'

finPostgresSuite('reconciliation R110–R114', {}, ({ pool, world }) => {
  it('R110–R111 are GREEN after a grant+consume; each check DRIFTs when seeded dirty', async () => {
    const tenantId = world().tenantA.tenantId
    await grant({
      tenantId, source: 'promo', amount: 100, currency: 'USD',
      grantRef: { idempotency_key: `r110:${tenantId}`, reason: 'recon' },
    })
    const requestId = randomUUID()
    await reserve({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId, creditsAmount: 4,
    })
    await consume({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId,
      callType: 'draft', creditsAmount: 4,
    })

    const green = await runReconciliation(pool(), { now: NOW })
    const greenBy = Object.fromEntries(green.results.map((r) => [r.check_code, r]))
    expect(greenBy.R110.result).toBe('GREEN')
    expect(greenBy.R111.result).toBe('GREEN')
    expect(greenBy.R112.result).toBe('GREEN')

    await pool().query(
      `UPDATE public.credit_wallets SET credits_remaining = credits_remaining + 7 WHERE tenant_id = $1`,
      [tenantId],
    )
    const drifted = await runReconciliation(pool(), { now: NOW })
    const driftBy = Object.fromEntries(drifted.results.map((r) => [r.check_code, r]))
    expect(driftBy.R110.result).toBe('DRIFT')
    await pool().query(
      `UPDATE public.credit_wallets SET credits_remaining = credits_remaining - 7 WHERE tenant_id = $1`,
      [tenantId],
    )
  })

  it('R111 DRIFTs when reserved cache disagrees with HELD rows', async () => {
    const tenantId = world().tenantA.tenantId
    await grant({
      tenantId, source: 'promo', amount: 20, currency: 'USD',
      grantRef: { idempotency_key: `r111:${randomUUID()}`, reason: 'recon' },
    })
    await pool().query(
      `UPDATE public.credit_wallets SET credits_reserved = 3 WHERE tenant_id = $1`,
      [tenantId],
    )
    const run = await runReconciliation(pool(), { now: NOW })
    const by = Object.fromEntries(run.results.map((r) => [r.check_code, r]))
    expect(by.R111.result).toBe('DRIFT')
    await pool().query(
      `UPDATE public.credit_wallets SET credits_reserved = 0 WHERE tenant_id = $1`,
      [tenantId],
    )
  })

  it('R112 DRIFTs for a HELD reservation expired more than 10 minutes ago', async () => {
    const tenantId = world().tenantA.tenantId
    await grant({
      tenantId, source: 'promo', amount: 15, currency: 'USD',
      grantRef: { idempotency_key: `r112:${randomUUID()}`, reason: 'recon' },
    })
    const requestId = randomUUID()
    await reserve({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId, creditsAmount: 2,
    })
    await pool().query(
      `UPDATE public.credit_reservations
          SET expires_at = $2::timestamptz - interval '11 minutes'
        WHERE request_id = $1`,
      [requestId, NOW],
    )
    const run = await runReconciliation(pool(), { now: NOW })
    const by = Object.fromEntries(run.results.map((r) => [r.check_code, r]))
    expect(by.R112.result).toBe('DRIFT')
  })

  it('R113 DRIFTs when a large goodwill grant references a non-approved request', async () => {
    const tenantId = world().tenantA.tenantId
    const approvalId = randomUUID()
    await pool().query(
      `INSERT INTO fin.approval_requests (
         id, environment, tenant_id, action_kind, status, payload_hash,
         created_at, updated_at
       ) VALUES ($1, 'LIVE', $2, 'LARGE_GRANT', 'REQUESTED', 'x', NOW(), NOW())`,
      [approvalId, tenantId],
    )
    await grant({
      tenantId,
      source: 'goodwill',
      amount: 200_000,
      currency: 'USD',
      approvalRequestId: approvalId,
      grantRef: { reason: 'pending', note: 'r113', idempotency_key: `r113:${randomUUID()}` },
    })
    const run = await runReconciliation(pool(), { now: NOW })
    const by = Object.fromEntries(run.results.map((r) => [r.check_code, r]))
    expect(by.R113.result).toBe('DRIFT')
  })

  it('R114 is GREEN after the mirror worker; DRIFTs when a grant is older than 5 min without a mirror', async () => {
    const tenantId = world().tenantA.tenantId
    const granted = await grant({
      tenantId, source: 'promo', amount: 8, currency: 'USD',
      grantRef: { idempotency_key: `r114:${randomUUID()}`, reason: 'recon' },
    })
    await runCreditFinMirrorTick({ pool: pool(), environment: 'LIVE' })
    await pool().query(
      `UPDATE public.credit_grants SET granted_at = NOW() - interval '6 minutes' WHERE id = $1`,
      [granted.grant.id],
    )
    const green = await runReconciliation(pool(), { now: new Date().toISOString() })
    const greenBy = Object.fromEntries(green.results.map((r) => [r.check_code, r]))
    expect(greenBy.R114.result).toBe('GREEN')

    const orphan = await grant({
      tenantId, source: 'promo', amount: 3, currency: 'USD',
      grantRef: { idempotency_key: `r114-orphan:${randomUUID()}`, reason: 'unmirrored' },
    })
    await pool().query(
      `UPDATE public.credit_grants SET granted_at = NOW() - interval '6 minutes' WHERE id = $1`,
      [orphan.grant.id],
    )
    const drifted = await runReconciliation(pool(), { now: new Date().toISOString() })
    const driftBy = Object.fromEntries(drifted.results.map((r) => [r.check_code, r]))
    expect(driftBy.R114.result).toBe('DRIFT')
  })
})
