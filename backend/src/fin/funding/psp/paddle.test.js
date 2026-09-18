import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const intents = vi.hoisted(() => ({
  confirmPurchasePayment: vi.fn(),
  failPurchase: vi.fn(),
}))
vi.mock('../purchase-intents.js', () => intents)

import {
  computePaddleSignature,
  decodePaddleEvent,
  verifyPaddleSignature,
  confirmWebhook,
} from './paddle.js'

const SECRET = 'pdl_ntfset_test'
const NOW = '2026-09-18T12:00:00.000Z'
const TS = String(Math.floor(Date.parse(NOW) / 1000))
const INTENT = '11111111-1111-1111-1111-111111111111'

function sign(body, ts = TS, secret = SECRET) {
  return `ts=${ts};h1=${computePaddleSignature(secret, ts, body)}`
}

beforeEach(() => {
  intents.confirmPurchasePayment.mockReset()
  intents.failPurchase.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('paddle signature + decode (fast)', () => {
  it('accepts a matching h1 HMAC and rejects unsigned / wrong secret / stale ts / no secret', () => {
    const raw = '{"event_type":"transaction.completed"}'
    expect(verifyPaddleSignature({ rawBody: raw, header: sign(raw), secret: SECRET, now: NOW }).ok).toBe(true)
    expect(verifyPaddleSignature({ rawBody: raw, header: null, secret: SECRET, now: NOW })).toMatchObject({ ok: false, error: 'unsigned' })
    expect(verifyPaddleSignature({ rawBody: raw, header: sign(raw), secret: 'other', now: NOW })).toMatchObject({ ok: false, httpStatus: 401 })
    expect(verifyPaddleSignature({ rawBody: raw, header: sign(raw, '1'), secret: SECRET, now: NOW })).toMatchObject({ ok: false, error: 'timestamp_window' })
    expect(verifyPaddleSignature({ rawBody: raw, header: sign(raw), secret: null, now: NOW })).toMatchObject({ ok: false, error: 'missing_secret' })
  })

  it('decodes completed vs failed events and reads custom_data.purchase_intent_id', () => {
    const ok = decodePaddleEvent(JSON.stringify({
      notification_id: 'ntf_ok',
      event_type: 'transaction.completed',
      data: { id: 'txn_1', custom_data: { purchase_intent_id: INTENT } },
    }))
    expect(ok).toMatchObject({ id: 'ntf_ok', success: true, hardDecline: false, intentId: INTENT })
    const failed = decodePaddleEvent(JSON.stringify({
      notification_id: 'ntf_no',
      event_type: 'transaction.payment_failed',
      data: { custom_data: { purchase_intent_id: INTENT } },
    }))
    expect(failed).toMatchObject({ success: false, hardDecline: true, intentId: INTENT })
    const ignored = decodePaddleEvent(JSON.stringify({ notification_id: 'ntf_x', event_type: 'transaction.created', data: {} }))
    expect(ignored).toMatchObject({ success: false, hardDecline: false })
  })
})

describe('confirmWebhook wiring', () => {
  function body(overrides = {}) {
    return JSON.stringify({
      notification_id: 'ntf_ok',
      event_type: 'transaction.completed',
      data: { id: 'txn_1', custom_data: { purchase_intent_id: INTENT } },
      ...overrides,
    })
  }

  it('confirms a completed transaction via the purchase-intent engine with a PADDLE idempotency key', async () => {
    intents.confirmPurchasePayment.mockResolvedValue({ status: 'captured', id: 'pi_1', txId: 'tx_1', duplicate: false })
    const raw = body()
    const res = await confirmWebhook(raw, { 'paddle-signature': sign(raw) }, { secret: SECRET, now: NOW })
    expect(res.httpStatus).toBe(200)
    expect(intents.confirmPurchasePayment).toHaveBeenCalledWith(
      expect.objectContaining({ intentId: INTENT, provider: 'PADDLE', providerEventId: 'ntf_ok', idempotencyKey: 'wh:PADDLE:ntf_ok' }),
    )
  })

  it('rejects a bad signature with 401 and never touches the engine', async () => {
    const raw = body()
    const res = await confirmWebhook(raw, { 'paddle-signature': 'ts=1;h1=deadbeef' }, { secret: SECRET, now: NOW })
    expect(res.httpStatus).toBe(401)
    expect(intents.confirmPurchasePayment).not.toHaveBeenCalled()
  })

  it('ignores a non-terminal event (transaction.created) with 200 ignored', async () => {
    const raw = body({ event_type: 'transaction.created' })
    const res = await confirmWebhook(raw, { 'paddle-signature': sign(raw) }, { secret: SECRET, now: NOW })
    expect(res.httpStatus).toBe(200)
    expect(res.body.ignored).toBe(true)
    expect(intents.confirmPurchasePayment).not.toHaveBeenCalled()
  })

  it('fails a hard-decline via failPurchase', async () => {
    intents.failPurchase.mockResolvedValue({ status: 'failed', id: 'pi_1' })
    const raw = body({ event_type: 'transaction.payment_failed' })
    const res = await confirmWebhook(raw, { 'paddle-signature': sign(raw) }, { secret: SECRET, now: NOW })
    expect(res.httpStatus).toBe(200)
    expect(intents.failPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ intentId: INTENT, provider: 'PADDLE', reasonCode: 'PSP_DECLINE' }),
    )
  })
})
