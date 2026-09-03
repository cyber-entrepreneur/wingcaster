/**
 * Tenant-facing billing APIs. Tenant id is derived from the JWT session
 * (personal vs agency), never from a client query param.
 *
 * Top-up is a stub: it emits fin.outbox_events topic `topup.requested`.
 * Credits are granted only when a provider webhook later calls
 * completeTopUpFromWebhook with grant_ref.idempotency_key = webhook_event_id.
 */
import { randomUUID } from 'node:crypto'
import { authMiddleware, requireElevated } from '../../auth.js'
import { query, transaction } from '../../db.js'
import { insertOutbox } from '../../fin/ledger/write.js'
import { changePlan } from '../packages/lifecycle.js'
import { previewChangePlan } from '../packages/preview.js'
import { checkEntitlement, listFeatureQuotas } from './feature-check.js'
import { CREDIT_ERROR, CreditEngineError, creditErrorHttpStatus } from './errors.js'
import { getWallet, grant } from './engine.js'
import { fromCreditUnits, toCreditUnits } from './scale.js'
import { resolveRequestCreditTenant } from './tenant-context.js'

const TOP_UP_ELEVATED_USD = 50

function sendCreditError(res, error) {
  const status = creditErrorHttpStatus(error)
  return res.status(status).json({
    error: error.message,
    code: error.code || 'CREDIT_ERROR',
    extra: error.extra || undefined,
  })
}

function requireTenant(req, res) {
  const resolved = resolveRequestCreditTenant(req)
  if (!resolved) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  return resolved
}

function requireElevatedIfLargeTopUp(req, res, next) {
  const amount = Number(req.body?.amount_usd)
  if (Number.isFinite(amount) && amount > TOP_UP_ELEVATED_USD) {
    return requireElevated({ maxAgeSeconds: 5 * 60 })(req, res, next)
  }
  return next()
}

export async function completeTopUpFromWebhook({
  tenantId,
  amount,
  webhookEventId,
  source = 'topup.paddle',
  currency = 'USD',
} = {}) {
  if (!webhookEventId) {
    throw new CreditEngineError(CREDIT_ERROR.INVALID_AMOUNT, 'webhook_event_id is required')
  }
  const units = typeof amount === 'number' && amount < 1000 ? toCreditUnits(amount) : Number(amount)
  return grant({
    tenantId,
    source,
    amount: units,
    currency,
    grantRef: { idempotency_key: String(webhookEventId) },
  })
}

export function registerTenantBillingRoutes(app) {
  app.get('/api/tenant/credits/balance', authMiddleware, async (req, res) => {
    try {
      const tenant = requireTenant(req, res)
      if (!tenant) return
      const wallet = await getWallet(tenant.creditTenantId)
      const quotas = await listFeatureQuotas(tenant.creditTenantId)
      res.json({
        tenant_id: tenant.creditTenantId,
        public_tenant_id: tenant.publicTenantId,
        scope: tenant.scope,
        credits_remaining: fromCreditUnits(wallet?.credits_remaining || 0),
        credits_reserved: fromCreditUnits(wallet?.credits_reserved || 0),
        credits_remaining_units: Number(wallet?.credits_remaining || 0),
        credits_reserved_units: Number(wallet?.credits_reserved || 0),
        currency: wallet?.currency || 'USD',
        hard_block: Number(wallet?.credits_remaining || 0) <= 0,
        quotas,
      })
    } catch (error) {
      sendCreditError(res, error)
    }
  })

  app.get('/api/tenant/credits/quotas', authMiddleware, async (req, res) => {
    try {
      const tenant = requireTenant(req, res)
      if (!tenant) return
      const feature = typeof req.query.feature === 'string' ? req.query.feature : null
      if (feature) {
        return res.json(await checkEntitlement(tenant.creditTenantId, feature))
      }
      res.json({ quotas: await listFeatureQuotas(tenant.creditTenantId) })
    } catch (error) {
      sendCreditError(res, error)
    }
  })

  app.get('/api/tenant/credits/grants', authMiddleware, async (req, res) => {
    try {
      const tenant = requireTenant(req, res)
      if (!tenant) return
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
      const rows = await query(
        `SELECT id, source, amount, currency, grant_ref, granted_at, expires_at, data
           FROM public.credit_grants
          WHERE tenant_id = $1
          ORDER BY granted_at DESC
          LIMIT $2`,
        [tenant.creditTenantId, limit],
      )
      res.json({ grants: rows })
    } catch (error) {
      sendCreditError(res, error)
    }
  })

  app.get('/api/tenant/credits/consumptions', authMiddleware, async (req, res) => {
    try {
      const tenant = requireTenant(req, res)
      if (!tenant) return
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
      const rows = await query(
        `SELECT id, feature, call_type, request_id, credits_amount, actual_cost_micro_usd,
                provider, model, related_entity_type, related_entity_id, consumed_at, data
           FROM public.credit_consumptions
          WHERE tenant_id = $1
          ORDER BY consumed_at DESC
          LIMIT $2`,
        [tenant.creditTenantId, limit],
      )
      res.json({ consumptions: rows })
    } catch (error) {
      sendCreditError(res, error)
    }
  })

  app.post('/api/tenant/credits/top-up', authMiddleware, requireElevatedIfLargeTopUp, async (req, res) => {
    try {
      const tenant = requireTenant(req, res)
      if (!tenant) return
      const amountUsd = Number(req.body?.amount_usd)
      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        return res.status(400).json({ error: 'amount_usd must be a positive number' })
      }
      const membership = await query(
        `SELECT status, role FROM public.tenant_memberships
          WHERE user_id = $1 AND tenant_id = $2
          ORDER BY updated_at DESC LIMIT 1`,
        [req.user.id, tenant.publicTenantId],
      )
      if (membership[0] && membership[0].status !== 'active') {
        return res.status(403).json({ error: 'Top-up entitlement revoked', code: 'TOPUP_REVOKED' })
      }
      const idempotencyKey = String(req.body?.idempotency_key || req.get('Idempotency-Key') || randomUUID())
      const outboxId = randomUUID()
      await transaction(async (client) => {
        await insertOutbox(client, {
          environment: 'LIVE',
          topic: 'topup.requested',
          dedupeKey: `topup.requested:${tenant.creditTenantId}:${idempotencyKey}`,
          payload: {
            tenant_id: tenant.creditTenantId,
            public_tenant_id: tenant.publicTenantId,
            amount_usd: amountUsd,
            units: toCreditUnits(amountUsd),
            requested_by: req.user.id,
            idempotency_key: idempotencyKey,
            outbox_id: outboxId,
          },
          now: new Date().toISOString(),
        })
      })
      res.status(202).json({
        status: 'pending_provider',
        message: 'Top-up requested. Payment provider handoff is not wired in this PR.',
        amount_usd: amountUsd,
        idempotency_key: idempotencyKey,
      })
    } catch (error) {
      if (error?.code === '23505') {
        return res.status(202).json({ status: 'pending_provider', replay: true })
      }
      sendCreditError(res, error)
    }
  })

  app.post('/api/tenant/credits/top-up/webhook', async (req, res) => {
    const secret = process.env.TOPUP_WEBHOOK_SECRET
    if (!secret || req.get('x-topup-webhook-secret') !== secret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const webhookEventId = String(req.body?.webhook_event_id || '')
      const tenantId = String(req.body?.tenant_id || '')
      const amount = Number(req.body?.amount || req.body?.amount_usd)
      const result = await completeTopUpFromWebhook({
        tenantId,
        amount,
        webhookEventId,
        source: req.body?.source || 'topup.paddle',
      })
      res.json({ ok: true, replay: Boolean(result.replay), grant_id: result.grant?.id })
    } catch (error) {
      sendCreditError(res, error)
    }
  })

  app.get('/api/tenant/subscription', authMiddleware, async (req, res) => {
    try {
      const tenant = requireTenant(req, res)
      if (!tenant) return
      const rows = await query(
        `SELECT s.*, p.code AS package_code, p.display_name, p.tier, p.billing_cadence,
                p.target_audience, v.version_number, v.properties_covered, v.monthly_price_minor,
                v.state AS version_state
           FROM public.tenant_subscriptions s
           JOIN public.product_package_versions v ON v.id = s.package_version_id
           JOIN public.product_packages p ON p.id = v.package_id
          WHERE s.tenant_id = $1
          ORDER BY s.created_at DESC
          LIMIT 1`,
        [tenant.creditTenantId],
      )
      res.json({ subscription: rows[0] || null, tenant_id: tenant.creditTenantId })
    } catch (error) {
      sendCreditError(res, error)
    }
  })

  app.get('/api/tenant/plans', authMiddleware, async (req, res) => {
    try {
      const rows = await query(
        `SELECT p.id AS package_id, p.code, p.display_name, p.tier, p.target_audience,
                p.billing_cadence, p.currency, v.id AS version_id, v.version_number,
                v.properties_covered, v.monthly_price_minor, v.state
           FROM public.product_packages p
           JOIN public.product_package_versions v ON v.package_id = p.id
          WHERE v.state = 'PUBLISHED'
            AND p.active = true
          ORDER BY p.tier, v.monthly_price_minor`,
      )
      res.json({ plans: rows })
    } catch (error) {
      sendCreditError(res, error)
    }
  })

  app.post('/api/tenant/subscription/preview-change', authMiddleware, async (req, res) => {
    try {
      const tenant = requireTenant(req, res)
      if (!tenant) return
      const { subscription_id: subscriptionId, new_package_version_id: newPackageVersionId } = req.body || {}
      if (!subscriptionId || !newPackageVersionId) {
        return res.status(400).json({ error: 'subscription_id and new_package_version_id are required' })
      }
      const owned = await query(
        `SELECT id FROM public.tenant_subscriptions WHERE id = $1 AND tenant_id = $2`,
        [subscriptionId, tenant.creditTenantId],
      )
      if (!owned[0]) return res.status(404).json({ error: 'Subscription not found' })
      const preview = await transaction(async (client) => previewChangePlan(client, {
        subscriptionId,
        newPackageVersionId,
      }))
      res.json(preview)
    } catch (error) {
      sendCreditError(res, error)
    }
  })

  app.post('/api/tenant/subscription/change-plan', authMiddleware, requireElevated({ maxAgeSeconds: 5 * 60 }), async (req, res) => {
    try {
      const tenant = requireTenant(req, res)
      if (!tenant) return
      const {
        subscription_id: subscriptionId,
        new_package_version_id: newPackageVersionId,
        prorate = true,
      } = req.body || {}
      if (!subscriptionId || !newPackageVersionId) {
        return res.status(400).json({ error: 'subscription_id and new_package_version_id are required' })
      }
      const owned = await query(
        `SELECT id FROM public.tenant_subscriptions WHERE id = $1 AND tenant_id = $2`,
        [subscriptionId, tenant.creditTenantId],
      )
      if (!owned[0]) return res.status(404).json({ error: 'Subscription not found' })
      const result = await transaction(async (client) => changePlan(client, {
        subscriptionId,
        newPackageVersionId,
        prorate: Boolean(prorate),
        actorId: req.user.id,
      }))
      res.json({
        previous: result.previous,
        subscription: result.subscription,
        fraction: result.fraction,
        net: result.net,
      })
    } catch (error) {
      sendCreditError(res, error)
    }
  })

  app.get('/api/tenant/invoices', authMiddleware, async (req, res) => {
    try {
      const tenant = requireTenant(req, res)
      if (!tenant) return
      const rows = await query(
        `SELECT i.id, i.tenant_id, i.status, i.currency, i.total_minor, i.subtotal_minor,
                i.tax_minor, i.issued_at, i.due_at, i.invoice_number
           FROM fin.invoices i
           JOIN public.credit_wallets w ON w.fin_tenant_id = i.tenant_id
          WHERE w.tenant_id = $1
          ORDER BY i.issued_at DESC NULLS LAST
          LIMIT 100`,
        [tenant.creditTenantId],
      )
      res.json({ invoices: rows })
    } catch (error) {
      sendCreditError(res, error)
    }
  })

  app.get('/api/tenant/credit-notes', authMiddleware, async (req, res) => {
    try {
      const tenant = requireTenant(req, res)
      if (!tenant) return
      const notes = await query(
        `SELECT n.id, n.tenant_id, n.invoice_id, n.amount_minor, n.currency, n.reason_code,
                n.status, n.note_number, n.issued_at, n.created_at
           FROM fin.credit_notes n
           JOIN public.credit_wallets w ON w.fin_tenant_id = n.tenant_id
          WHERE w.tenant_id = $1
          ORDER BY n.created_at DESC
          LIMIT 100`,
        [tenant.creditTenantId],
      )
      res.json({ credit_notes: notes })
    } catch (error) {
      sendCreditError(res, error)
    }
  })
}
