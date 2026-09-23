/**
 * Minimal server-side Paddle REST client.
 *
 * Hand-rolled (no SDK) to match the existing hand-rolled Paddle webhook adapter
 * (backend/src/fin/funding/psp/paddle.js) and to avoid a new runtime dependency.
 * Used for the write/read actions Paddle.js can't do from the browser: minting
 * customer-portal sessions, and (via the seed script) catalog setup.
 *
 * Money capture and provisioning never happen here — they happen on the signed
 * `/webhooks/paddle` events. This client is only for authenticated API calls.
 */

const SANDBOX_BASE = 'https://sandbox-api.paddle.com'
const PRODUCTION_BASE = 'https://api.paddle.com'

export function paddleEnvironment() {
  return String(process.env.PADDLE_ENV || 'sandbox').toLowerCase() === 'production'
    ? 'production'
    : 'sandbox'
}

export function paddleApiBase() {
  return paddleEnvironment() === 'production' ? PRODUCTION_BASE : SANDBOX_BASE
}

/**
 * True only when a server-side API key is present. Callers gate on this so the
 * integration degrades gracefully (HTTP 501) before the Paddle account exists.
 */
export function isPaddleApiConfigured() {
  return Boolean(process.env.PADDLE_API_KEY)
}

export class PaddleApiError extends Error {
  constructor(message, { httpStatus = 502, paddleCode = null, detail = null } = {}) {
    super(message)
    this.name = 'PaddleApiError'
    this.httpStatus = httpStatus
    this.paddleCode = paddleCode
    this.detail = detail
  }
}

/**
 * Perform an authenticated Paddle API request. Resolves with the parsed `data`
 * payload; throws PaddleApiError on transport or API-level failure.
 */
export async function paddleRequest(method, path, { body, apiKey, signal } = {}) {
  const key = apiKey || process.env.PADDLE_API_KEY
  if (!key) {
    throw new PaddleApiError('Paddle API key not configured', {
      httpStatus: 501,
      paddleCode: 'not_configured',
    })
  }
  const url = `${paddleApiBase()}${path}`
  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    throw new PaddleApiError(`Paddle request failed: ${error.message}`, { httpStatus: 502 })
  }

  let payload = null
  const text = await res.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!res.ok) {
    const apiError = payload?.error || {}
    throw new PaddleApiError(apiError.detail || `Paddle API ${res.status}`, {
      // 4xx from Paddle is our (server) fault → surface as 502 to the client,
      // except 404 which callers may want to special-case (missing customer).
      httpStatus: res.status === 404 ? 404 : 502,
      paddleCode: apiError.code || null,
      detail: apiError.detail || null,
    })
  }
  return payload?.data ?? payload
}

/**
 * Create a customer portal session. Paddle returns one-time, time-limited URLs
 * — never cache them. `subscriptionIds` (up to 25) yields per-subscription deep
 * links in the response.
 *
 * @returns {{ overview: string, subscriptions: Array<{ id: string, cancelSubscription?: string, updateSubscriptionPaymentMethod?: string }> }}
 */
export async function createPortalSession(customerId, subscriptionIds = [], opts = {}) {
  if (!customerId) {
    throw new PaddleApiError('customerId is required', { httpStatus: 400 })
  }
  const ids = Array.isArray(subscriptionIds) ? subscriptionIds.filter(Boolean).slice(0, 25) : []
  const data = await paddleRequest(
    'POST',
    `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    { body: { subscription_ids: ids }, ...opts },
  )
  const urls = data?.urls || {}
  return {
    overview: urls.general?.overview || null,
    subscriptions: Array.isArray(urls.subscriptions)
      ? urls.subscriptions.map((s) => ({
          id: s.id,
          cancelSubscription: s.cancel_subscription || null,
          updateSubscriptionPaymentMethod: s.update_subscription_payment_method || null,
        }))
      : [],
  }
}
