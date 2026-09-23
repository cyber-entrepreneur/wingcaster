/**
 * Tenant-facing Paddle billing routes (customer portal).
 *
 * The Paddle customer id is resolved SERVER-SIDE from the authenticated session
 * (never from a client-supplied parameter) so a user can only ever mint a portal
 * session for their own tenant. Portal URLs are one-time and time-limited — a
 * fresh session is minted per click and never cached.
 */
import { authMiddleware } from '../../auth.js'
import { query } from '../../db.js'
import { resolveRequestCreditTenant } from '../credits/tenant-context.js'
import { toCreditUnits } from '../credits/scale.js'
import {
  createPortalSession,
  isPaddleApiConfigured,
  paddleEnvironment,
  PaddleApiError,
} from './paddle-api.js'

const ACTIVE_SUBSCRIPTION_STATUSES = ['PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END']

export function registerBillingRoutes(app) {
  app.post('/api/billing/portal-session', authMiddleware, async (req, res) => {
    const tenant = resolveRequestCreditTenant(req)
    if (!tenant) return res.status(401).json({ error: 'Unauthorized' })

    if (!isPaddleApiConfigured()) {
      return res.status(501).json({
        error: 'portal_unavailable',
        reason: 'payment_gateway_not_configured',
      })
    }

    try {
      const environment = paddleEnvironment()
      const customers = await query(
        `SELECT paddle_customer_id FROM public.tenant_billing_customers
          WHERE tenant_id = $1 AND environment = $2
          LIMIT 1`,
        [tenant.creditTenantId, environment],
      )
      const customerId = customers[0]?.paddle_customer_id
      if (!customerId) {
        // Authenticated, but no Paddle customer yet (never checked out). The
        // client renders this as "portal not available yet".
        return res.status(404).json({ error: 'no_paddle_customer', code: 'PORTAL_NO_CUSTOMER' })
      }

      const subs = await query(
        `SELECT paddle_subscription_id FROM public.tenant_subscriptions
          WHERE tenant_id = $1
            AND paddle_subscription_id IS NOT NULL
            AND status = ANY($2)`,
        [tenant.creditTenantId, ACTIVE_SUBSCRIPTION_STATUSES],
      )
      const subscriptionIds = subs.map((row) => row.paddle_subscription_id).filter(Boolean)

      const session = await createPortalSession(customerId, subscriptionIds)

      // Deep-link when the caller asked for a specific management surface.
      const section = String(req.body?.section || '')
      let url = session.overview
      if (section === 'payment-methods') {
        const deepLink = session.subscriptions.find((s) => s.updateSubscriptionPaymentMethod)
        url = deepLink?.updateSubscriptionPaymentMethod || session.overview
      }
      if (!url) {
        return res.status(502).json({ error: 'portal_no_url' })
      }
      return res.status(200).json({ url })
    } catch (error) {
      if (error instanceof PaddleApiError) {
        return res.status(error.httpStatus).json({ error: 'portal_failed', detail: error.detail })
      }
      throw error
    }
  })

  // Resolve everything the browser needs to open a Paddle checkout, server-side:
  // the Paddle price id (from the catalog map) and the custom_data that ties the
  // resulting webhook back to THIS authenticated tenant. The client never asserts
  // its own tenant id — it only passes this object straight through to Paddle.
  app.post('/api/billing/checkout-config', authMiddleware, async (req, res) => {
    const tenant = resolveRequestCreditTenant(req)
    if (!tenant) return res.status(401).json({ error: 'Unauthorized' })

    const environment = paddleEnvironment()
    const kind = req.body?.kind === 'topup' ? 'topup' : 'subscription'
    const baseCustom = {
      credit_tenant_id: tenant.creditTenantId,
      scope: tenant.scope,
      scope_id: tenant.scopeId,
    }

    if (kind === 'subscription') {
      const packageVersionId = req.body?.package_version_id
      if (!packageVersionId) {
        return res.status(400).json({ error: 'package_version_id is required' })
      }
      const priceId = await lookupPriceId('subscription', packageVersionId, environment)
      if (!priceId) {
        return res.status(409).json({ error: 'price_not_mapped', code: 'PADDLE_PRICE_NOT_MAPPED' })
      }
      return res.status(200).json({
        price_id: priceId,
        quantity: 1,
        custom_data: { ...baseCustom, package_version_id: packageVersionId, kind: 'subscription' },
        customer_email: req.user?.email || null,
        environment,
      })
    }

    // top-up: a shared-credit purchase. The credit-unit price is $0.01, so
    // quantity == units == amount_usd × 100 (handles cents cleanly). The webhook
    // grants exactly `units` into the shared wallet.
    const amountUsd = Number(req.body?.amount_usd)
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return res.status(400).json({ error: 'amount_usd must be a positive number' })
    }
    const priceId = await lookupPriceId('credit_unit', 'credit_unit', environment)
    if (!priceId) {
      return res.status(409).json({ error: 'price_not_mapped', code: 'PADDLE_PRICE_NOT_MAPPED' })
    }
    const units = toCreditUnits(amountUsd)
    return res.status(200).json({
      price_id: priceId,
      quantity: units,
      custom_data: { ...baseCustom, units, kind: 'topup' },
      customer_email: req.user?.email || null,
      environment,
    })
  })
}

async function lookupPriceId(kind, refId, environment) {
  const rows = await query(
    `SELECT paddle_price_id FROM public.paddle_price_map
      WHERE kind = $1 AND ref_id = $2 AND environment = $3 AND active = true
      LIMIT 1`,
    [kind, refId, environment],
  )
  return rows[0]?.paddle_price_id || null
}
