import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { asRole } from '../../fin/testing/seed.js'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { CREDIT_ERROR } from './errors.js'
import { consume, grant, release, reserve, upsertSpendCap } from './engine.js'
import { runCreditJanitorTick } from './janitor.js'
import { runCreditFinMirrorTick } from './fin-mirror-worker.js'
import { FEATURES } from './features.js'

async function seedCredits(amount = 10_000) {
  const tenantId = randomUUID()
  const result = await grant({
    tenantId,
    source: 'promo',
    amount,
    currency: 'USD',
    grantRef: { idempotency_key: `seed:${tenantId}`, reason: 'test seed' },
  })
  return { tenantId, wallet: result.wallet }
}

finPostgresSuite('credit engine', {}, ({ pool, world }) => {
  it('grant / reserve / consume / release happy paths and replays', async () => {
    const { tenantId } = await seedCredits(1000)
    const requestId = randomUUID()
    const first = await reserve({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId, creditsAmount: 10,
    })
    expect(first.replay).toBe(false)
    expect(Number(first.wallet.credits_reserved)).toBe(10)
    const replayReserve = await reserve({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId, creditsAmount: 10,
    })
    expect(replayReserve.replay).toBe(true)
    expect(replayReserve.reservation.id).toBe(first.reservation.id)

    const consumed = await consume({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId,
      callType: 'draft', creditsAmount: 7, actualCostMicroUsd: 350,
    })
    expect(consumed.replay).toBe(false)
    expect(Number(consumed.wallet.credits_remaining)).toBe(993)
    expect(Number(consumed.wallet.credits_reserved)).toBe(0)
    const replayConsume = await consume({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId,
      callType: 'draft', creditsAmount: 7,
    })
    expect(replayConsume.replay).toBe(true)
    expect(replayConsume.consumption.id).toBe(consumed.consumption.id)

    const other = randomUUID()
    await reserve({ tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId: other, creditsAmount: 5 })
    const released = await release({ tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId: other })
    expect(released.replay).toBe(false)
    expect(Number(released.wallet.credits_reserved)).toBe(0)
    const replayRelease = await release({ tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId: other })
    expect(replayRelease.replay).toBe(true)
  })

  it('INSUFFICIENT_CREDITS, SPEND_CAP_EXCEEDED, CURRENCY_MISMATCH', async () => {
    const { tenantId } = await seedCredits(10)
    await expect(reserve({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId: randomUUID(), creditsAmount: 11,
    })).rejects.toMatchObject({ code: CREDIT_ERROR.INSUFFICIENT_CREDITS })

    await upsertSpendCap({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, windowKind: 'DAY', maxCredits: 3,
    })
    await expect(reserve({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId: randomUUID(), creditsAmount: 4,
    })).rejects.toMatchObject({ code: CREDIT_ERROR.SPEND_CAP_EXCEEDED })

    await expect(grant({
      tenantId, source: 'promo', amount: 1, currency: 'EUR',
      grantRef: { idempotency_key: randomUUID(), reason: 'fx' },
    })).rejects.toMatchObject({ code: CREDIT_ERROR.CURRENCY_MISMATCH })
  })

  it('grant idempotency returns the original row', async () => {
    const tenantId = randomUUID()
    const key = `idem:${randomUUID()}`
    const a = await grant({
      tenantId, source: 'promo', amount: 50, currency: 'USD',
      grantRef: { idempotency_key: key, reason: 'once' },
    })
    const b = await grant({
      tenantId, source: 'promo', amount: 50, currency: 'USD',
      grantRef: { idempotency_key: key, reason: 'once' },
    })
    expect(b.replay).toBe(true)
    expect(b.grant.id).toBe(a.grant.id)
    expect(Number(b.wallet.credits_remaining)).toBe(50)
  })

  it('concurrency: 100 parallel reserve+consume operations, zero lost updates', async () => {
    const { tenantId } = await seedCredits(10_000)
    const ops = Array.from({ length: 100 }, (_, i) => (async () => {
      const requestId = `conc:${i}:${randomUUID()}`
      await reserve({
        tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId, creditsAmount: 1,
      })
      await consume({
        tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId,
        callType: 'draft', creditsAmount: 1,
      })
    })())
    await Promise.all(ops)
    const { rows } = await pool().query(
      `SELECT credits_remaining, credits_reserved FROM public.credit_wallets WHERE tenant_id = $1`,
      [tenantId],
    )
    expect(Number(rows[0].credits_remaining)).toBe(9900)
    expect(Number(rows[0].credits_reserved)).toBe(0)
    const consumed = await pool().query(
      `SELECT COUNT(*)::int AS n FROM public.credit_consumptions WHERE tenant_id = $1`,
      [tenantId],
    )
    expect(consumed.rows[0].n).toBe(100)
  })

  it('janitor expires hanging reservations and decrements reserved', async () => {
    const { tenantId } = await seedCredits(100)
    const requestId = randomUUID()
    await reserve({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId, creditsAmount: 9,
    })
    await pool().query(
      `UPDATE public.credit_reservations SET expires_at = NOW() - interval '1 hour' WHERE request_id = $1`,
      [requestId],
    )
    const tick = await runCreditJanitorTick({ pool: pool(), now: new Date().toISOString() })
    expect(tick.processed).toBeGreaterThanOrEqual(1)
    const reservation = await pool().query(
      `SELECT status FROM public.credit_reservations WHERE request_id = $1`,
      [requestId],
    )
    expect(reservation.rows[0].status).toBe('EXPIRED')
    const wallet = await pool().query(
      `SELECT credits_reserved FROM public.credit_wallets WHERE tenant_id = $1`,
      [tenantId],
    )
    expect(Number(wallet.rows[0].credits_reserved)).toBe(0)
  })

  it('approval trigger rejects large goodwill grants without approval_request_id', async () => {
    const tenantId = randomUUID()
    await grant({
      tenantId, source: 'promo', amount: 1, currency: 'USD',
      grantRef: { idempotency_key: `base:${tenantId}`, reason: 'open wallet' },
    })
    await expect(grant({
      tenantId,
      source: 'goodwill',
      amount: 200_000,
      currency: 'USD',
      grantRef: { reason: 'too big', note: 'no approval' },
    })).rejects.toMatchObject({ code: CREDIT_ERROR.CREDIT_GRANT_APPROVAL_REQUIRED })

    const approvalId = randomUUID()
    await pool().query(
      `INSERT INTO fin.approval_requests (
         id, environment, tenant_id, action_kind, status, payload_hash,
         created_at, updated_at
       ) VALUES ($1, 'LIVE', $2, 'LARGE_GRANT', 'APPROVED', 'x', NOW(), NOW())`,
      [approvalId, world().tenantA.tenantId],
    )
    const ok = await grant({
      tenantId,
      source: 'goodwill',
      amount: 200_000,
      currency: 'USD',
      approvalRequestId: approvalId,
      grantRef: { reason: 'approved', note: 'ok', idempotency_key: `ok:${tenantId}` },
    })
    expect(ok.grant.approval_request_id).toBe(approvalId)
  })

  it('mirror worker writes GRANT_MIRROR + CONSUME_MIRROR with two balanced postings', async () => {
    const tenantId = world().tenantA.tenantId
    const granted = await grant({
      tenantId,
      source: 'promo',
      amount: 25,
      currency: 'USD',
      grantRef: { idempotency_key: `mirror:${tenantId}`, reason: 'mirror' },
    })
    const requestId = randomUUID()
    await reserve({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId, creditsAmount: 5,
    })
    const consumed = await consume({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId,
      callType: 'draft', creditsAmount: 5, actualCostMicroUsd: 500,
    })
    const tick = await runCreditFinMirrorTick({ pool: pool(), environment: 'LIVE' })
    expect(tick.processed).toBeGreaterThanOrEqual(2)

    const grantTx = await pool().query(
      `SELECT id, shape FROM fin.ledger_transactions
        WHERE economic_source_type = 'credit_grants' AND economic_source_id = $1`,
      [granted.grant.id],
    )
    expect(grantTx.rows[0].shape).toBe('GRANT_MIRROR')
    const grantPostings = await pool().query(
      `SELECT amount_units FROM fin.ledger_postings WHERE transaction_id = $1`,
      [grantTx.rows[0].id],
    )
    expect(grantPostings.rows).toHaveLength(2)
    expect(grantPostings.rows.reduce((s, r) => s + Number(r.amount_units), 0)).toBe(0)

    const consumeTx = await pool().query(
      `SELECT id, shape FROM fin.ledger_transactions
        WHERE economic_source_type = 'credit_consumptions' AND economic_source_id = $1`,
      [consumed.consumption.id],
    )
    expect(consumeTx.rows[0].shape).toBe('CONSUME_MIRROR')
    const consumePostings = await pool().query(
      `SELECT amount_units FROM fin.ledger_postings WHERE transaction_id = $1`,
      [consumeTx.rows[0].id],
    )
    expect(consumePostings.rows).toHaveLength(2)
    expect(consumePostings.rows.reduce((s, r) => s + Number(r.amount_units), 0)).toBe(0)
  })

  it('append-only REVOKEs: fin_app_role cannot UPDATE or DELETE grants/consumptions', async () => {
    const { tenantId } = await seedCredits(20)
    const requestId = randomUUID()
    await reserve({ tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId, creditsAmount: 2 })
    await consume({
      tenantId, feature: FEATURES.WHATSAPP_LISTINGS, requestId,
      callType: 'draft', creditsAmount: 2,
    })
    const grantRow = await pool().query(
      `SELECT id FROM public.credit_grants WHERE tenant_id = $1 LIMIT 1`,
      [tenantId],
    )
    const consumptionRow = await pool().query(
      `SELECT id FROM public.credit_consumptions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId],
    )
    const gucs = {
      'fin.environment': 'LIVE',
      'fin.tenant_id': world().tenantA.tenantId,
    }
    const client = await pool().connect()
    try {
      await expect(asRole(client, 'fin_app_role', gucs, (c) => c.query(
        `UPDATE public.credit_grants SET amount = 999 WHERE id = $1`,
        [grantRow.rows[0].id],
      ))).rejects.toThrow(/permission denied|insufficient privilege/i)

      await expect(asRole(client, 'fin_app_role', gucs, (c) => c.query(
        `DELETE FROM public.credit_grants WHERE id = $1`,
        [grantRow.rows[0].id],
      ))).rejects.toThrow(/permission denied|insufficient privilege/i)

      await expect(asRole(client, 'fin_app_role', gucs, (c) => c.query(
        `UPDATE public.credit_consumptions SET credits_amount = 1 WHERE id = $1`,
        [consumptionRow.rows[0].id],
      ))).rejects.toThrow(/permission denied|insufficient privilege/i)

      await expect(asRole(client, 'fin_app_role', gucs, (c) => c.query(
        `DELETE FROM public.credit_consumptions WHERE id = $1`,
        [consumptionRow.rows[0].id],
      ))).rejects.toThrow(/permission denied|insufficient privilege/i)
    } finally {
      client.release()
    }
  })
})
