/**
 * Platform admin routes for the WhatsApp Listing module.
 */

import { v4 as uuidv4 } from 'uuid'
import { authMiddleware, requireElevated } from '../../../auth.js'
import { requirePlatformAdmin } from '../../../lib/auth-guards.js'
import { query } from '../../../db.js'
import { adminMutationLimiter } from '../../../lib/admin-limiter.js'
import { Collections, findAllModule, insertModule } from '../infrastructure/db.js'
import {
  listWhatsAppAuditLogs,
  whatsAppAuditLogListQuerySchema,
  whatsAppAuditRowsToCsv,
} from '../application/whatsapp-audit-reads.js'
import { whatsAppCreditGrantBodySchema } from '../application/whatsapp-credit-grant-schemas.js'

export function registerAdminRoutes(app, { entitlements, credits, pipeline, config }) {
  app.get('/api/admin/whatsapp-listings/health', authMiddleware, requirePlatformAdmin, (_req, res) => {
    res.json({
      enabled: true,
      ai_provider: config.aiProvider,
      fallback_providers: config.fallbackAiProviders,
      storage_path: config.storagePath,
    })
  })

  app.get('/api/admin/entitlements', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { scope, scope_id, feature } = req.query
      const rows = await entitlements.listEntitlements({ scope, scope_id, feature })
      res.json(rows)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/entitlements', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { scope, scope_id, feature, enabled, config: entitlementConfig } = req.body
      if (!scope || !scope_id) return res.status(400).json({ error: 'scope and scope_id are required' })
      const created = await entitlements.createEntitlement({ scope, scope_id, feature, enabled, config: entitlementConfig })
      res.status(201).json(created)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/admin/entitlements/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      await entitlements.deleteEntitlement(req.params.id)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/admin/whatsapp-listings/usage', authMiddleware, requirePlatformAdmin, async (_req, res) => {
    try {
      const drafts = await findAllModule(Collections.DRAFTS, () => true)
      const { query } = await import('../../../db.js')
      const transactions = await query(
        `SELECT credits_amount AS amount, consumed_at AS created_at
           FROM public.credit_consumptions
          WHERE feature = 'whatsapp-listings'`,
      )

      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const byAgent = {}
      for (const d of drafts) {
        byAgent[d.agent_id] = byAgent[d.agent_id] || { drafts: 0, approved: 0, published: 0, discarded: 0, error: 0 }
        byAgent[d.agent_id].drafts += 1
        if (d.status === 'approved' || d.status === 'published') byAgent[d.agent_id].approved += 1
        if (d.status === 'published') byAgent[d.agent_id].published += 1
        if (d.status === 'discarded') byAgent[d.agent_id].discarded += 1
        if (d.status === 'error') byAgent[d.agent_id].error += 1
      }

      res.json({
        total_drafts: drafts.length,
        drafts_today: drafts.filter((d) => d.created_at >= startOfDay).length,
        drafts_this_month: drafts.filter((d) => d.created_at >= startOfMonth).length,
        ai_credits_consumed: transactions.reduce((sum, t) => sum + Number(t.amount || 0) / 100, 0),
        ai_credits_consumed_today: transactions.filter((t) => t.created_at >= startOfDay).reduce((sum, t) => sum + Number(t.amount || 0) / 100, 0),
        approval_rate: drafts.length ? Math.round(((drafts.filter((d) => d.status === 'published').length / drafts.length) * 100)) : 0,
        by_agent: byAgent,
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/admin/whatsapp-listings/audit-log', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const payload = await listWhatsAppAuditLogs(query, req.query)
      res.json(payload)
    } catch (err) {
      if (err?.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid audit-log query', details: err.issues })
      }
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/admin/whatsapp-listings/audit-log.csv', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const queryParams = whatsAppAuditLogListQuerySchema.parse({
        ...req.query,
        limit: req.query.limit ?? 500,
        offset: req.query.offset ?? 0,
      })
      const payload = await listWhatsAppAuditLogs(query, queryParams)
      const csv = whatsAppAuditRowsToCsv(payload.items)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="whatsapp-audit-log.csv"')
      return res.status(200).send(csv)
    } catch (err) {
      if (err?.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid audit-log query', details: err.issues })
      }
      res.status(500).json({ error: err.message })
    }
  })

  // Manual credit grant — the ONLY path that mints tenant credits until Phase
  // 7e ships a real payment gateway. Requires platform_admin + a reason for
  // the audit trail. Tenant-facing top-up endpoints return 501 by design.
  app.post('/api/admin/whatsapp-listings/credits/grant', authMiddleware, requirePlatformAdmin, requireElevated(), adminMutationLimiter, async (req, res) => {
    try {
      const body = whatsAppCreditGrantBodySchema.parse(req.body)
      const balance = await credits.topUp(body.scope, body.scope_id, body.amount_usd, {
        description: `Manual admin credit by ${req.user.id}: ${body.reason}`,
      })
      await insertModule(Collections.AUDIT_LOGS, {
        id: uuidv4(),
        agent_id: body.scope === 'agent' ? body.scope_id : null,
        agency_id: body.scope === 'agency' ? body.scope_id : null,
        action: 'admin_credit_grant',
        entity_type: body.scope,
        entity_id: body.scope_id,
        metadata: {
          amount_usd: body.amount_usd,
          reason: body.reason,
        },
        data: {
          actor_id: req.user.id,
          target_scope: body.scope,
          target_id: body.scope_id,
          amount_usd: body.amount_usd,
          reason: body.reason,
        },
        created_at: new Date().toISOString(),
      })
      res.status(201).json({ success: true, balance })
    } catch (err) {
      if (err?.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid grant body', details: err.issues })
      }
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/whatsapp-listings/audit-log', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const log = await insertModule(Collections.AUDIT_LOGS, {
        id: uuidv4(),
        ...req.body,
        created_at: new Date().toISOString(),
      })
      res.status(201).json(log)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
