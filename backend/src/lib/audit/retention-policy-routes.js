/**
 * PA-AUD-002 — Audit-log retention policy admin API.
 *
 * GET  /api/admin/audit-log/retention-policy — read the current policy.
 * PUT  /api/admin/audit-log/retention-policy — replace it (PA + step-up).
 *
 * The saved policy drives the retention purge job (see server.js
 * POST /api/admin/audit-log/retention). Financial audit rows are held to a
 * hard 7-year (2555-day) floor; other categories are bounded [30, 3650].
 */
import { z } from 'zod'
import { findOne, insert, update } from '../../db.js'
import { requirePlatformAdmin, isPlatformAdmin } from '../auth-guards.js'
import { requireElevated } from '../../auth.js'
import {
  POLICY_ID,
  FINANCIAL_FLOOR_DAYS,
  MIN_CATEGORY_DAYS,
  MAX_CATEGORY_DAYS,
  serializeRetentionPolicy,
  loadRetentionPolicy,
} from './retention-policy.js'

const categoryDays = z.number().int().gte(MIN_CATEGORY_DAYS).lte(MAX_CATEGORY_DAYS)

const putSchema = z
  .object({
    financial_actions_days: z.number().int().gte(FINANCIAL_FLOOR_DAYS).lte(MAX_CATEGORY_DAYS),
    pa_actions_days: categoryDays,
    tenant_actions_days: categoryDays,
    system_events_days: categoryDays,
    export_before_purge: z.boolean(),
  })
  .strict()

export function registerRoutes(app, { authMiddleware }) {
  app.get('/api/admin/audit-log/retention-policy', authMiddleware, async (req, res) => {
    if (!req.user?.id || !(await isPlatformAdmin(req.user.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const policy = await loadRetentionPolicy()
    res.json({
      policy,
      constraints: {
        financial_floor_days: FINANCIAL_FLOOR_DAYS,
        min_category_days: MIN_CATEGORY_DAYS,
        max_category_days: MAX_CATEGORY_DAYS,
      },
    })
  })

  app.put(
    '/api/admin/audit-log/retention-policy',
    authMiddleware,
    requirePlatformAdmin,
    requireElevated(),
    async (req, res) => {
      const parsed = putSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid retention policy' })
      }
      const now = new Date().toISOString()
      const fields = { ...parsed.data, updated_by: req.user.id, updated_at: now }
      const existing = await findOne('audit_retention_policy', (r) => r.id === POLICY_ID)
      if (existing) {
        await update('audit_retention_policy', (r) => r.id === POLICY_ID, (r) => ({ ...r, ...fields }))
      } else {
        await insert('audit_retention_policy', { id: POLICY_ID, created_at: now, ...fields })
      }
      const saved = await findOne('audit_retention_policy', (r) => r.id === POLICY_ID)
      res.json({ policy: serializeRetentionPolicy(saved || { id: POLICY_ID, ...fields }) })
    },
  )
}
