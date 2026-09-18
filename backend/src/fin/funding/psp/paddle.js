/**
 * Paddle PSP adapter — mirrors the Stripe adapter's interface so the pluggable
 * `psp/index.js` layer can route to either provider. Called OUTSIDE
 * fin.* transaction(fn) (I-14), same as Stripe.
 *
 * Paddle is WingCaster's merchant-of-record for go-live. Checkout is opened
 * CLIENT-SIDE via Paddle.js (see web/src/lib/billing/paddle.ts); provisioning
 * (crediting the wallet) happens HERE on the signed `transaction.completed`
 * webhook — never on the browser redirect, which users can lose.
 *
 * Webhook signature: Paddle sends `Paddle-Signature: ts=<unix>;h1=<hex>`.
 * Signed payload is `${ts}:${rawBody}`, HMAC-SHA256 with the notification
 * destination's secret key. Same shape as Stripe, different separators.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { CATEGORY, FinError, finError } from '../../errors.js'
import { iso } from '../helpers.js'
import { confirmPurchasePayment, failPurchase } from '../purchase-intents.js'

export const PADDLE_SIGNATURE_TOLERANCE_SEC = 300

export function paddleSignedPayload(timestamp, rawBody) {
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '')
  return `${timestamp}:${body}`
}

export function computePaddleSignature(secret, timestamp, rawBody) {
  return createHmac('sha256', secret)
    .update(paddleSignedPayload(timestamp, rawBody), 'utf8')
    .digest('hex')
}

export function parsePaddleSignatureHeader(header) {
  const parts = Object.fromEntries(
    String(header || '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter((pair) => pair.length === 2),
  )
  return { timestamp: parts.ts || null, h1: parts.h1 || null }
}

export function verifyPaddleSignature({ rawBody, header, secret, now, toleranceSec = PADDLE_SIGNATURE_TOLERANCE_SEC }) {
  if (!secret) {
    return { ok: false, error: 'missing_secret', httpStatus: 401 }
  }
  if (!header) {
    return { ok: false, error: 'unsigned', httpStatus: 401 }
  }
  const { timestamp, h1 } = parsePaddleSignatureHeader(header)
  if (!timestamp || !h1) {
    return { ok: false, error: 'malformed_signature', httpStatus: 401 }
  }
  const clock = now ? Date.parse(iso(now)) / 1000 : Date.now() / 1000
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(clock - ts) > toleranceSec) {
    return { ok: false, error: 'timestamp_window', httpStatus: 401 }
  }
  const expected = computePaddleSignature(secret, timestamp, rawBody)
  const left = Buffer.from(h1, 'utf8')
  const right = Buffer.from(expected, 'utf8')
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, error: 'bad_signature', httpStatus: 401 }
  }
  return { ok: true, timestamp, h1 }
}

export function decodePaddleEvent(rawBody) {
  const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '')
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw finError('QUOTE_INVALID', { category: CATEGORY.VALIDATION, details: { field: 'body' } })
  }
  const type = parsed.event_type
  const data = parsed.data || {}
  const custom = data.custom_data || {}
  return {
    // Paddle's stable per-notification id; fall back to event_id.
    id: parsed.notification_id || parsed.event_id,
    type,
    data,
    intentId: custom.purchase_intent_id || custom.intentId || custom.intent_id || null,
    hardDecline: type === 'transaction.payment_failed' || type === 'transaction.canceled',
    success: type === 'transaction.completed' || type === 'transaction.paid',
    raw: parsed,
  }
}

/**
 * Paddle checkout is opened client-side, so there is no server-created
 * client_secret like Stripe. `submitPayment` returns an action telling the
 * client which price to open the overlay with; without a configured API key
 * it returns a deterministic TEST-shaped action (parity with Stripe).
 */
export async function submitPayment(intent, providerHint = {}) {
  const provider = providerHint.provider || intent.provider || 'PADDLE'
  if (provider !== 'PADDLE') {
    return { provider, action: { type: 'none' } }
  }
  const priceId = providerHint.priceId || intent.price_id || null
  const configured = Boolean(providerHint.apiKey || process.env.PADDLE_API_KEY)
  return {
    provider: 'PADDLE',
    action: {
      type: 'paddle_checkout',
      price_id: priceId,
      // The client passes this back as custom_data so the webhook can
      // correlate the transaction to this purchase intent.
      custom_data: { purchase_intent_id: intent.id },
      simulated: !configured,
    },
  }
}

export async function confirmWebhook(rawBody, headers, {
  secret, now, environment = 'LIVE', actorType = 'PSP', actorId = null,
  reasonCode = 'PSP_CAPTURE',
} = {}) {
  const header = headers?.['paddle-signature'] || headers?.['Paddle-Signature']
  const verified = verifyPaddleSignature({
    rawBody,
    header,
    secret: secret || process.env.PADDLE_WEBHOOK_SECRET,
    now,
  })
  if (!verified.ok) {
    return { httpStatus: verified.httpStatus, body: { error: verified.error } }
  }

  let event
  try {
    event = decodePaddleEvent(rawBody)
  } catch {
    return { httpStatus: 400, body: { error: 'unparseable' } }
  }
  if (!event.id) {
    return { httpStatus: 400, body: { error: 'missing_event_id' } }
  }
  if (!event.success && !event.hardDecline) {
    return { httpStatus: 200, body: { received: true, duplicate: false, ignored: true } }
  }
  if (!event.intentId) {
    return { httpStatus: 400, body: { error: 'missing_intent_id' } }
  }

  try {
    if (event.hardDecline) {
      const failed = await failPurchase({
        intentId: event.intentId,
        provider: 'PADDLE',
        providerEventId: event.id,
        environment,
        actorType,
        actorId,
        reasonCode: 'PSP_DECLINE',
        now,
        idempotencyKey: `wh:PADDLE:${event.id}`,
      })
      return {
        httpStatus: 200,
        body: { received: true, duplicate: false, status: failed.status, id: failed.id },
      }
    }
    const confirmed = await confirmPurchasePayment({
      intentId: event.intentId,
      provider: 'PADDLE',
      providerEventId: event.id,
      environment,
      actorType,
      actorId,
      reasonCode,
      now,
      idempotencyKey: `wh:PADDLE:${event.id}`,
    })
    return {
      httpStatus: 200,
      body: {
        received: true,
        duplicate: Boolean(confirmed.duplicate),
        status: confirmed.status,
        id: confirmed.id,
        txId: confirmed.txId,
      },
    }
  } catch (error) {
    if (error instanceof FinError && error.code === 'IDEMPOTENCY_KEY_IN_FLIGHT') {
      return { httpStatus: 409, retryAfter: error.retryAfter || 2, body: { code: 'IDEMPOTENCY_IN_FLIGHT' } }
    }
    if (error instanceof FinError && error.code === 'PURCHASE_PROVIDER_EVENT_REUSED') {
      return { httpStatus: 409, body: error.toJSON() }
    }
    if (error instanceof FinError && error.code === 'PURCHASE_ILLEGAL_TRANSITION') {
      return { httpStatus: 400, body: error.toJSON() }
    }
    throw error
  }
}
