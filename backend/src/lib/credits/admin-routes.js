/**
 * Platform-admin credit routes, including two-person approval for large grants.
 */
import { randomUUID } from 'node:crypto'
import { authMiddleware, requireElevated } from '../../auth.js'
import { requirePlatformAdmin } from '../auth-guards.js'
import { adminMutationLimiter } from '../admin-limiter.js'
import { transaction } from '../../db.js'
import { CREDIT_ERROR, CreditEngineError, sendCreditError } from './errors.js'
import { ensureTenantWallet, grant } from './engine.js'
import { grantRequiresApproval } from './pricing.js'
import { createCreditService } from './compat.js'
import { toCreditUnits } from './scale.js'

const credits = createCreditService()

function asUuidOrNull(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))
    ? String(id)
    : null
}

async function createApprovalRequest(client, {
  tenantId,
  actorId,
  payload,
}) {
  const id = randomUUID()
  await client.query(
    `INSERT INTO fin.approval_requests (
       id, environment, tenant_id, action_kind, status, payload_hash,
       min_distinct_approvers, created_at, created_by_actor_type, created_by_actor_id,
       updated_at
     ) VALUES (
       $1, 'LIVE', $2, 'LARGE_GRANT', 'REQUESTED', $3,
       1, NOW(), 'USER', $4, NOW()
     )`,
    [id, tenantId, JSON.stringify(payload), actorId],
  )
  return id
}

export function registerCreditAdminRoutes(app, { creditService = credits } = {}) {
  const readGuards = [authMiddleware, requirePlatformAdmin]
  const writeGuards = [authMiddleware, requirePlatformAdmin, requireElevated(), adminMutationLimiter]

  app.get('/api/admin/credits/wallets', ...readGuards, async (req, res) => {
    try {
      const { scope, scope_id: scopeId } = req.query
      if (scope && scopeId) {
        return res.json(await creditService.balance(scope, scopeId))
      }
      const { query } = await import('../../db.js')
      const rows = await query(
        `SELECT tenant_id, currency, credits_remaining, credits_reserved, scope, scope_id, updated_at
           FROM public.credit_wallets
          ORDER BY updated_at DESC
          LIMIT 200`,
      )
      res.json({ wallets: rows })
    } catch (err) {
      sendCreditError(res, err)
    }
  })

  app.post('/api/admin/credits/grants', ...writeGuards, async (req, res) => {
    try {
      const {
        scope, scope_id: scopeId, amount, amount_usd: amountUsd,
        source = 'goodwill', reason, currency = 'USD',
      } = req.body || {}
      if (scope !== 'agent' && scope !== 'agency') {
        return res.status(400).json({ error: "scope must be 'agent' or 'agency'" })
      }
      if (!scopeId) return res.status(400).json({ error: 'scope_id is required' })
      const raw = amount ?? amountUsd
      const units = toCreditUnits(raw)
      if (!units) return res.status(400).json({ error: 'amount must be a positive number' })
      const reasonText = String(reason || '').trim()
      if (!reasonText) return res.status(400).json({ error: 'reason is required for audit trail' })

      const actorId = asUuidOrNull(req.user.id)
      const wallet = await ensureTenantWallet({ scope, scopeId, currency })

      if (grantRequiresApproval(source, units)) {
        const approvalId = await transaction(async (client) => createApprovalRequest(client, {
          tenantId: wallet.fin_tenant_id || null,
          actorId,
          payload: {
            scope,
            scope_id: scopeId,
            amount: units,
            source,
            reason: reasonText,
            currency,
            tenant_id: wallet.tenant_id,
          },
        }))
        return res.status(409).json({
          success: false,
          code: CREDIT_ERROR.CREDIT_GRANT_APPROVAL_REQUIRED,
          approval_request_id: approvalId,
        })
      }

      const result = await grant({
        tenantId: wallet.tenant_id,
        scope,
        scopeId,
        source,
        amount: units,
        currency,
        grantRef: {
          reason: reasonText,
          admin_actor_id: actorId,
          note: reasonText,
          idempotency_key: req.body?.idempotency_key || `admin-grant:${randomUUID()}`,
        },
        grantedByActorType: 'USER',
        grantedByActorId: actorId,
      })
      res.status(201).json({ success: true, grant: result.grant, balance: await creditService.balance(scope, scopeId) })
    } catch (err) {
      sendCreditError(res, err)
    }
  })

  app.post('/api/admin/credits/approvals/:id/approve', ...writeGuards, async (req, res) => {
    try {
      const actorId = asUuidOrNull(req.user.id)
      if (!actorId) return res.status(400).json({ error: 'approver id must be a UUID' })
      const outcome = await transaction(async (client) => {
        const { rows } = await client.query(
          `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
          [req.params.id],
        )
        const approval = rows[0]
        if (!approval) return { status: 404, body: { error: 'Approval not found' } }
        if (approval.created_by_actor_id && String(approval.created_by_actor_id) === String(actorId)) {
          return {
            status: 403,
            body: { error: 'APPROVAL_SELF_APPROVAL_FORBIDDEN', code: CREDIT_ERROR.APPROVAL_SELF_APPROVAL_FORBIDDEN },
          }
        }
        if (approval.status !== 'REQUESTED') {
          return { status: 409, body: { error: `Approval is ${approval.status}` } }
        }
        await client.query(
          `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
           VALUES ($1, $2, $3, 'APPROVED', NOW())`,
          [randomUUID(), approval.id, actorId],
        )
        await client.query(
          `UPDATE fin.approval_requests
              SET status = 'APPROVED', updated_at = NOW(), updated_by_actor_id = $2
            WHERE id = $1`,
          [approval.id, actorId],
        )
        let payload = {}
        try { payload = JSON.parse(approval.payload_hash || '{}') } catch { payload = {} }
        return { status: 200, approval, payload }
      })
      if (outcome.body) return res.status(outcome.status).json(outcome.body)

      const payload = outcome.payload || {}
      const result = await grant({
        tenantId: payload.tenant_id,
        scope: payload.scope,
        scopeId: payload.scope_id,
        source: payload.source || 'goodwill',
        amount: Number(payload.amount),
        currency: payload.currency || 'USD',
        approvalRequestId: req.params.id,
        grantRef: {
          reason: payload.reason,
          admin_actor_id: actorId,
          note: payload.reason,
          idempotency_key: `approved-grant:${req.params.id}`,
        },
        grantedByActorType: 'USER',
        grantedByActorId: actorId,
      })
      await transaction(async (client) => {
        await client.query(
          `UPDATE fin.approval_requests SET status = 'EXECUTED', updated_at = NOW() WHERE id = $1`,
          [req.params.id],
        )
      })
      res.json({ success: true, grant: result.grant })
    } catch (err) {
      if (String(err.message || '').includes('self-approval') && !(err instanceof CreditEngineError)) {
        return sendCreditError(res, new CreditEngineError(
          CREDIT_ERROR.APPROVAL_SELF_APPROVAL_FORBIDDEN,
          'APPROVAL_SELF_APPROVAL_FORBIDDEN',
        ))
      }
      sendCreditError(res, err)
    }
  })

  app.post('/api/admin/credits/approvals/:id/reject', ...writeGuards, async (req, res) => {
    try {
      const actorId = asUuidOrNull(req.user.id)
      await transaction(async (client) => {
        await client.query(
          `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
           VALUES ($1, $2, $3, 'REJECTED', NOW())`,
          [randomUUID(), req.params.id, actorId],
        )
        await client.query(
          `UPDATE fin.approval_requests
              SET status = 'REJECTED', updated_at = NOW()
            WHERE id = $1 AND status = 'REQUESTED'`,
          [req.params.id],
        )
      })
      res.json({ success: true, status: 'REJECTED' })
    } catch (err) {
      sendCreditError(res, err)
    }
  })
}
