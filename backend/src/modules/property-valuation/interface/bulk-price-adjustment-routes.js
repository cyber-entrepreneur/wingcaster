/**
 * AGN-PRC-002 — Agency bulk price adjustment routes.
 */

import { z } from 'zod'
import { authMiddleware } from '../../../auth.js'
import {
  applyBulkPriceAdjustment,
  buildPreviewRows,
  evaluateSafetyCaps,
  getActiveBulkAdjustment,
  isBulkStrategy,
  loadAgencyListingsForBulk,
  resolveAgencyAdmin,
  revertBulkPriceAdjustment,
} from '../application/bulk-price-adjustment.js'

const bulkAdjustBaseSchema = z.object({
  listing_ids: z.array(z.string().min(1).max(80)).min(1).max(500),
  strategy: z.string().min(1),
  strategy_value: z.number().optional().nullable(),
})

function validateBulkAdjustBody(body, ctx) {
  if (!isBulkStrategy(body.strategy)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['strategy'], message: 'Invalid strategy' })
  }
  if (['percent_up', 'percent_down', 'fixed_delta'].includes(body.strategy) && body.strategy_value == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['strategy_value'], message: 'strategy_value is required' })
  }
}

const previewSchema = bulkAdjustBaseSchema.strict().superRefine(validateBulkAdjustBody)

const applySchema = bulkAdjustBaseSchema.extend({
  reversal_hours: z.number().int().min(1).max(168).optional().default(24),
  confirmation: z.string().min(1).max(200),
}).strict().superRefine(validateBulkAdjustBody)

export function registerBulkPriceAdjustmentRoutes(app, { dal, analysisService, recalculationJobService, logger }) {
  app.get('/api/agency/pricing/bulk-adjust/active', authMiddleware, async (req, res, next) => {
    try {
      const gate = await resolveAgencyAdmin(req.user.id)
      if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
      const active = await getActiveBulkAdjustment(gate.agencyId)
      res.json({ active })
    } catch (err) {
      next(err)
    }
  })

  app.post('/api/agency/pricing/bulk-adjust/preview', authMiddleware, async (req, res, next) => {
    try {
      const gate = await resolveAgencyAdmin(req.user.id)
      if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

      const parsed = previewSchema.safeParse(req.body || {})
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        })
      }

      const { listings, missing } = await loadAgencyListingsForBulk(
        dal,
        gate.agencyId,
        parsed.data.listing_ids,
        analysisService,
        logger,
      )
      const preview = buildPreviewRows(listings, parsed.data.strategy, parsed.data.strategy_value)
      const safety = evaluateSafetyCaps(preview)

      res.json({
        preview,
        missing,
        safety,
      })
    } catch (err) {
      next(err)
    }
  })

  app.post('/api/agency/pricing/bulk-adjust', authMiddleware, async (req, res, next) => {
    try {
      const gate = await resolveAgencyAdmin(req.user.id)
      if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

      const parsed = applySchema.safeParse(req.body || {})
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        })
      }

      const { listings, missing } = await loadAgencyListingsForBulk(
        dal,
        gate.agencyId,
        parsed.data.listing_ids,
        analysisService,
        logger,
      )
      const preview = buildPreviewRows(listings, parsed.data.strategy, parsed.data.strategy_value)
      const safety = evaluateSafetyCaps(preview)
      if (!safety.ok) {
        return res.status(422).json({ error: safety.error, code: safety.code, preview })
      }
      if (preview.rows.length === 0) {
        return res.status(400).json({ error: 'No listings would change with this strategy', preview, missing })
      }

      const expectedConfirmation = `I have reviewed all ${preview.rows.length} changes`
      if (parsed.data.confirmation.trim() !== expectedConfirmation) {
        return res.status(400).json({ error: `confirmation must equal "${expectedConfirmation}"` })
      }

      const active = await getActiveBulkAdjustment(gate.agencyId)
      if (active?.adjustment) {
        return res.status(409).json({ error: 'An active reversal window is already open for this agency' })
      }

      const result = await applyBulkPriceAdjustment({
        agencyId: gate.agencyId,
        actorId: req.user.id,
        strategy: parsed.data.strategy,
        strategyValue: parsed.data.strategy_value,
        reversalHours: parsed.data.reversal_hours,
        previewRows: preview.rows,
        totals: preview.totals,
        dal,
        recalculationJobService,
      })

      res.status(201).json({ adjustment: result, missing })
    } catch (err) {
      next(err)
    }
  })

  app.post('/api/agency/pricing/bulk-adjust/:id/revert', authMiddleware, async (req, res, next) => {
    try {
      const gate = await resolveAgencyAdmin(req.user.id)
      if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

      const result = await revertBulkPriceAdjustment({
        adjustmentId: req.params.id,
        agencyId: gate.agencyId,
        actorId: req.user.id,
        dal,
        recalculationJobService,
      })
      if (!result.ok) return res.status(result.status).json({ error: result.error })
      res.json(result)
    } catch (err) {
      next(err)
    }
  })
}
