import { describe, it, expect, vi, beforeEach } from 'vitest'

const completeTopUpFromWebhook = vi.fn(async () => ({ grant: { id: 'g1' } }))
vi.mock('../credits/tenant-routes.js', () => ({
  completeTopUpFromWebhook: (...args) => completeTopUpFromWebhook(...args),
}))

const transaction = vi.fn(async (fn) => fn({ query: vi.fn(async () => ({ rows: [] })) }))
const query = vi.fn(async () => [])
vi.mock('../../db.js', () => ({
  transaction: (...args) => transaction(...args),
  query: (...args) => query(...args),
}))

const { handlePaddleWebhookEvent } = await import('./paddle-webhook.js')
const { computePaddleSignature } = await import('../../fin/funding/psp/paddle.js')

const SECRET = 'whsec_test_secret'

function signed(event) {
  const raw = Buffer.from(JSON.stringify(event), 'utf8')
  const ts = Math.floor(Date.now() / 1000)
  const h1 = computePaddleSignature(SECRET, String(ts), raw)
  return { raw, headers: { 'paddle-signature': `ts=${ts};h1=${h1}` } }
}

beforeEach(() => {
  completeTopUpFromWebhook.mockClear()
  transaction.mockClear()
  query.mockClear()
})

describe('handlePaddleWebhookEvent', () => {
  it('401s when no secret is configured', async () => {
    const { raw, headers } = signed({ event_type: 'transaction.completed', data: {} })
    const res = await handlePaddleWebhookEvent(raw, headers, { secret: null })
    expect(res.httpStatus).toBe(401)
  })

  it('401s on a bad signature', async () => {
    const raw = Buffer.from(JSON.stringify({ event_type: 'transaction.completed', data: {} }))
    const res = await handlePaddleWebhookEvent(raw, { 'paddle-signature': 'ts=123;h1=deadbeef' }, { secret: SECRET })
    expect(res.httpStatus).toBe(401)
  })

  it('200-ignores an unhandled event type', async () => {
    const { raw, headers } = signed({ event_type: 'address.created', event_id: 'evt_1', data: { id: 'x' } })
    const res = await handlePaddleWebhookEvent(raw, headers, { secret: SECRET })
    expect(res.httpStatus).toBe(200)
    expect(res.body.ignored).toBe(true)
    expect(completeTopUpFromWebhook).not.toHaveBeenCalled()
  })

  it('ignores a non-top-up transaction.completed', async () => {
    const { raw, headers } = signed({
      event_type: 'transaction.completed',
      event_id: 'evt_2',
      data: { id: 'txn_1', custom_data: { kind: 'subscription' } },
    })
    const res = await handlePaddleWebhookEvent(raw, headers, { secret: SECRET })
    expect(res.httpStatus).toBe(200)
    expect(completeTopUpFromWebhook).not.toHaveBeenCalled()
  })

  it('grants a top-up with explicit units, idempotency keyed by transaction id', async () => {
    const { raw, headers } = signed({
      event_type: 'transaction.completed',
      notification_id: 'ntf_1',
      data: {
        id: 'txn_9',
        customer_id: 'ctm_1',
        custom_data: {
          kind: 'topup',
          credit_tenant_id: '11111111-1111-1111-1111-111111111111',
          units: 5000,
        },
      },
    })
    const res = await handlePaddleWebhookEvent(raw, headers, { secret: SECRET })
    expect(res.httpStatus).toBe(200)
    expect(completeTopUpFromWebhook).toHaveBeenCalledTimes(1)
    expect(completeTopUpFromWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '11111111-1111-1111-1111-111111111111',
        units: 5000,
        webhookEventId: 'txn:txn_9',
        source: 'topup.paddle',
      }),
    )
  })

  it('skips an incomplete top-up (missing tenant/units)', async () => {
    const { raw, headers } = signed({
      event_type: 'transaction.completed',
      notification_id: 'ntf_2',
      data: { id: 'txn_10', custom_data: { kind: 'topup' } },
    })
    const res = await handlePaddleWebhookEvent(raw, headers, { secret: SECRET })
    expect(res.httpStatus).toBe(200)
    expect(completeTopUpFromWebhook).not.toHaveBeenCalled()
  })
})
