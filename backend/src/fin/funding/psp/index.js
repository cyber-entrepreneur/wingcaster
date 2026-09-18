/**
 * Pluggable PSP adapters. STRIPE (stage 7) + PADDLE (go-live merchant-of-record).
 */
import * as stripe from './stripe.js'
import * as paddle from './paddle.js'

const adapters = {
  STRIPE: stripe,
  PADDLE: paddle,
}

export function getAdapter(provider = 'STRIPE') {
  const adapter = adapters[provider]
  if (!adapter) return null
  return adapter
}

export async function submitPayment(intent, providerHint = {}) {
  const provider = providerHint.provider || intent.provider || 'STRIPE'
  const adapter = getAdapter(provider)
  if (!adapter) {
    return { provider, action: { type: 'unsupported' } }
  }
  return adapter.submitPayment(intent, providerHint)
}

export async function confirmWebhook(rawBody, headers, opts = {}) {
  const provider = opts.provider || 'STRIPE'
  const adapter = getAdapter(provider)
  if (!adapter) {
    return { httpStatus: 400, body: { error: 'unknown_provider' } }
  }
  return adapter.confirmWebhook(rawBody, headers, opts)
}

export {
  verifyStripeSignature,
  decodeStripeEvent,
  computeStripeSignature,
  parseStripeSignatureHeader,
} from './stripe.js'

export {
  verifyPaddleSignature,
  decodePaddleEvent,
  computePaddleSignature,
  parsePaddleSignatureHeader,
} from './paddle.js'
