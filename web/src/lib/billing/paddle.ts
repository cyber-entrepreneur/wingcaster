/**
 * Paddle.js (v2) loader + inline-checkout helper.
 *
 * Loaded straight from Paddle's CDN (hand-rolled, no @paddle/paddle-js dep) so
 * we always run Paddle's latest, matching the backend's hand-rolled adapter.
 * The client token + environment come from build-time Vite env; with no token
 * the checkout is disabled and every helper degrades to a no-op / clear error.
 *
 * Provisioning never depends on the browser — the signed `/webhooks/paddle`
 * event is the source of truth. `successUrl` / events here are UX only.
 */
import type { CheckoutConfig } from '@/api/client'

const CDN_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js'

type PaddleCheckoutEvent = { name?: string; data?: unknown }

interface PaddleGlobal {
  Environment: { set: (env: string) => void }
  Initialize: (opts: { token: string; eventCallback?: (event: PaddleCheckoutEvent) => void }) => void
  Checkout: {
    open: (opts: Record<string, unknown>) => void
    updateItems?: (items: Array<{ priceId: string; quantity: number }>) => void
    close?: () => void
  }
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal
  }
}

export function paddleClientToken(): string {
  return String(import.meta.env.VITE_PADDLE_CLIENT_TOKEN || '').trim()
}

export function paddleEnv(): 'sandbox' | 'production' {
  return import.meta.env.VITE_PADDLE_ENV === 'production' ? 'production' : 'sandbox'
}

export function isPaddleConfigured(): boolean {
  return Boolean(paddleClientToken())
}

let loadPromise: Promise<PaddleGlobal | null> | null = null
let initialized = false
// Paddle.Initialize accepts a single eventCallback; route it to whichever
// checkout is currently open.
let currentHandler: ((event: PaddleCheckoutEvent) => void) | null = null

function injectScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Paddle) return resolve()
    const existing = document.querySelector<HTMLScriptElement>('script[data-paddle="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('paddle_load_failed')))
      return
    }
    const script = document.createElement('script')
    script.src = CDN_URL
    script.async = true
    script.setAttribute('data-paddle', 'true')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('paddle_load_failed'))
    document.head.appendChild(script)
  })
}

export async function loadPaddle(): Promise<PaddleGlobal | null> {
  if (!isPaddleConfigured()) return null
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    await injectScript()
    const paddle = window.Paddle
    if (!paddle) return null
    if (!initialized) {
      paddle.Environment.set(paddleEnv())
      paddle.Initialize({
        token: paddleClientToken(),
        eventCallback: (event) => currentHandler?.(event),
      })
      initialized = true
    }
    return paddle
  })().catch(() => {
    loadPromise = null
    return null
  })
  return loadPromise
}

export interface InlineCheckoutOptions {
  config: CheckoutConfig
  /** CSS class of the element Paddle injects the iframe into. */
  frameTarget: string
  successUrl?: string
  onEvent?: (event: PaddleCheckoutEvent) => void
}

/**
 * Open an inline Paddle checkout using a server-issued CheckoutConfig. Throws
 * `paddle_unavailable` if the SDK can't load (no token / network) so callers can
 * show a fallback.
 */
export async function openInlineCheckout({ config, frameTarget, successUrl, onEvent }: InlineCheckoutOptions): Promise<void> {
  const paddle = await loadPaddle()
  if (!paddle) throw new Error('paddle_unavailable')
  currentHandler = onEvent || null
  paddle.Checkout.open({
    ...(config.customer_email ? { customer: { email: config.customer_email } } : {}),
    items: [{ priceId: config.price_id, quantity: config.quantity }],
    customData: config.custom_data,
    settings: {
      displayMode: 'inline',
      frameTarget,
      frameInitialHeight: 450,
      frameStyle: 'width:100%; min-width:312px; background-color: transparent; border: none;',
      variant: 'one-page',
      allowLogout: !config.customer_email,
      ...(successUrl ? { successUrl } : {}),
    },
  })
}

export function closeInlineCheckout(): void {
  currentHandler = null
  try {
    window.Paddle?.Checkout.close?.()
  } catch {
    // best-effort
  }
}
