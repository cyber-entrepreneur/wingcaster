import { z } from 'zod'
import { authMiddleware, requireElevated } from '../../../auth.js'
import { requirePlatformAdmin } from '../../../lib/auth-guards.js'
import { AreaStatus } from '../domain/types.js'
import { aiSynthesis } from '../domain/scoring/ai-synthesis.js'
import { scoringCalculateBodySchema } from './scoring-calculate-schemas.js'
import { scoringOverrideBodySchema } from './scoring-override-schemas.js'
import { areaSignalRejectBodySchema, areaSignalVerifyBodySchema } from './area-signal-review-schemas.js'

const aiConfigFields = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  provider: z.string().trim().min(2).max(80),
  model: z.string().trim().min(1).max(160),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().int().min(128).max(32768),
  system_prompt: z.string().trim().min(20).max(20000),
  scoring_prompt_template: z.string().trim().min(20).max(20000),
  output_schema: z.record(z.unknown()).optional(),
  is_active: z.boolean(),
}

const AiConfigCreate = z.object(aiConfigFields).strict()
const AiConfigUpdate = z.object(aiConfigFields).partial().strict()
const AiConfigPreview = z.object({
  area_id: z.string().trim().min(1).max(120),
  dimension_id: z.string().trim().min(1).max(120),
}).strict()

function validationError(res, parsed) {
  return res.status(400).json({
    code: 'VALIDATION_ERROR',
    fields: parsed.error.flatten().fieldErrors,
  })
}

export function registerAdminRoutes(
  app,
  {
    areaService,
    dimensionService,
    sourceTypeService,
    sourceService,
    signalService,
    scoreService,
    aiConfigService,
    googleService,
    inspectorService,
    googleRefreshWorker,
    config,
    logger,
  }
) {
  // Areas
  app.get('/api/admin/areas', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { status, level, search, limit, offset } = req.query
      const result = await areaService.list({
        status,
        level,
        search,
        limit: Number(limit || 100),
        offset: Number(offset || 0),
      })
      res.json(result)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to list areas')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/areas', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const area = await areaService.create(req.body)
      res.status(201).json(area)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to create area')
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/admin/areas/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const area = await areaService.getById(req.params.id)
      if (!area) return res.status(404).json({ error: 'Area not found' })
      res.json(area)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to get area')
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/admin/areas/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const area = await areaService.update(req.params.id, req.body)
      if (!area) return res.status(404).json({ error: 'Area not found' })
      res.json(area)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to update area')
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/admin/areas/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      await areaService.remove(req.params.id)
      res.json({ success: true })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to delete area')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/areas/:id/enable-scoring', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const area = await areaService.update(req.params.id, { status: AreaStatus.SCORING_ENABLED })
      if (!area) return res.status(404).json({ error: 'Area not found' })
      res.json(area)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to enable scoring')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/areas/:id/disable-scoring', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const area = await areaService.update(req.params.id, { status: AreaStatus.DRAFT })
      if (!area) return res.status(404).json({ error: 'Area not found' })
      res.json(area)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to disable scoring')
      res.status(500).json({ error: err.message })
    }
  })

  // Score dimensions
  app.get('/api/admin/scoring/dimensions', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { isActive, isDefault, search } = req.query
      const items = await dimensionService.list({
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        isDefault: isDefault !== undefined ? isDefault === 'true' : undefined,
        search,
      })
      res.json({ items })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to list dimensions')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/scoring/dimensions', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const dim = await dimensionService.create(req.body)
      res.status(201).json(dim)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to create dimension')
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/admin/scoring/dimensions/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const dim = await dimensionService.getById(req.params.id)
      if (!dim) return res.status(404).json({ error: 'Dimension not found' })
      res.json(dim)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to get dimension')
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/admin/scoring/dimensions/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const dim = await dimensionService.update(req.params.id, req.body)
      if (!dim) return res.status(404).json({ error: 'Dimension not found' })
      res.json(dim)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to update dimension')
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/admin/scoring/dimensions/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      await dimensionService.remove(req.params.id)
      res.json({ success: true })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to delete dimension')
      res.status(500).json({ error: err.message })
    }
  })

  // Source types
  app.get('/api/admin/scoring/source-types', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { isActive, isDefault, archetype, search } = req.query
      const items = await sourceTypeService.list({
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        isDefault: isDefault !== undefined ? isDefault === 'true' : undefined,
        archetype,
        search,
      })
      res.json({ items })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to list source types')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/scoring/source-types', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const st = await sourceTypeService.create(req.body)
      res.status(201).json(st)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to create source type')
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/admin/scoring/source-types/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const st = await sourceTypeService.getById(req.params.id)
      if (!st) return res.status(404).json({ error: 'Source type not found' })
      res.json(st)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to get source type')
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/admin/scoring/source-types/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const st = await sourceTypeService.update(req.params.id, req.body)
      if (!st) return res.status(404).json({ error: 'Source type not found' })
      res.json(st)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to update source type')
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/admin/scoring/source-types/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      await sourceTypeService.remove(req.params.id)
      res.json({ success: true })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to delete source type')
      res.status(500).json({ error: err.message })
    }
  })

  // AI configs
  app.get('/api/admin/scoring/ai-configs', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { isActive } = req.query
      const items = await aiConfigService.list({
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      })
      res.json({ items })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to list AI configs')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/scoring/ai-configs', authMiddleware, requirePlatformAdmin, requireElevated(), async (req, res) => {
    const parsed = AiConfigCreate.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed)
    try {
      const cfg = await aiConfigService.create(parsed.data, req.user.id)
      res.status(201).json(cfg)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to create AI config')
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/admin/scoring/ai-configs/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const cfg = await aiConfigService.getById(req.params.id)
      if (!cfg) return res.status(404).json({ error: 'AI config not found' })
      res.json(cfg)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to get AI config')
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/admin/scoring/ai-configs/:id', authMiddleware, requirePlatformAdmin, requireElevated(), async (req, res) => {
    const parsed = AiConfigUpdate.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed)
    try {
      const cfg = await aiConfigService.update(req.params.id, parsed.data, req.user.id)
      if (!cfg) return res.status(404).json({ error: 'AI config not found' })
      res.json(cfg)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to update AI config')
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/admin/scoring/ai-configs/:id/versions', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const cfg = await aiConfigService.getById(req.params.id)
      if (!cfg) return res.status(404).json({ error: 'AI config not found' })
      const items = await aiConfigService.listVersions(req.params.id)
      res.json({ items })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to list AI config versions')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/scoring/ai-configs/:id/preview', authMiddleware, requirePlatformAdmin, requireElevated(), async (req, res) => {
    const parsed = AiConfigPreview.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed)
    try {
      const [cfg, area, dimension] = await Promise.all([
        aiConfigService.getById(req.params.id),
        areaService.getById(parsed.data.area_id),
        dimensionService.getById(parsed.data.dimension_id),
      ])
      if (!cfg || !area || !dimension) {
        return res.status(404).json({ code: 'PREVIEW_INPUT_NOT_FOUND' })
      }
      const signals = await signalService.list({
        areaId: area.id,
        status: 'verified',
        limit: 100,
      })
      const result = await aiSynthesis({
        dimension,
        signals: signals.items || [],
        area,
        aiConfig: cfg,
        config,
        logger,
      })
      res.json({
        config_id: cfg.id,
        config_version: Number(cfg.version || 1),
        area: { id: area.id, name: area.name },
        dimension: { id: dimension.id, name: dimension.name },
        result,
      })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to preview AI config')
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/admin/scoring/ai-configs/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      await aiConfigService.remove(req.params.id)
      res.json({ success: true })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to delete AI config')
      res.status(500).json({ error: err.message })
    }
  })

  // Area sources
  app.get('/api/admin/areas/:areaId/sources', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const items = await sourceService.listForArea(req.params.areaId, {
        isMonitored: req.query.is_monitored !== undefined ? req.query.is_monitored === 'true' : undefined,
      })
      res.json({ items })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to list area sources')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/areas/:areaId/sources', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const source = await sourceService.create({ ...req.body, area_id: req.params.areaId })
      res.status(201).json(source)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to create area source')
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/admin/areas/:areaId/sources/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const source = await sourceService.update(req.params.id, req.body)
      if (!source) return res.status(404).json({ error: 'Source not found' })
      res.json(source)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to update area source')
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/admin/areas/:areaId/sources/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      await sourceService.remove(req.params.id)
      res.json({ success: true })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to delete area source')
      res.status(500).json({ error: err.message })
    }
  })

  // Signals
  app.get('/api/admin/scoring/signals', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { areaId, status, sourceTypeId, limit, offset } = req.query
      const result = await signalService.list({
        areaId,
        status,
        sourceTypeId,
        limit: Number(limit || 100),
        offset: Number(offset || 0),
      })
      res.json(result)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to list signals')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/scoring/signals/:id/verify', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = areaSignalVerifyBodySchema.safeParse(req.body || {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
      }
      const signal = await signalService.verify(req.params.id, {
        verifiedBy: req.user.id,
        notes: parsed.data.notes,
      })
      if (!signal) return res.status(404).json({ error: 'Signal not found' })
      res.json(signal)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to verify signal')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/scoring/signals/:id/reject', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = areaSignalRejectBodySchema.safeParse(req.body || {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
      }
      const signal = await signalService.reject(req.params.id, {
        verifiedBy: req.user.id,
        reason: parsed.data.reason,
      })
      if (!signal) return res.status(404).json({ error: 'Signal not found' })
      res.json(signal)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to reject signal')
      res.status(500).json({ error: err.message })
    }
  })

  // Score calculation
  // On-demand Google signals refresh for a single area — used by the
  // "Fetch Google signals now" button. Bypasses the scheduled worker
  // interval (default 30 days). Still respects the monthly budget cap.
  app.post('/api/admin/areas/:id/refresh-google-signals', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      if (!googleRefreshWorker) return res.status(503).json({ error: 'Google refresh worker not available' })
      const result = await googleRefreshWorker.refreshOneArea(req.params.id)
      res.json(result)
    } catch (err) {
      logger.error({ err: err.message, area_id: req.params.id }, 'On-demand Google refresh failed')
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/api/admin/scoring/calculate', authMiddleware, requirePlatformAdmin, requireElevated(), async (req, res) => {
    try {
      const parsed = scoringCalculateBodySchema.safeParse(req.body || {})
      if (!parsed.success) {
        return validationError(res, parsed)
      }

      const scope = parsed.data.scope || 'one_area'
      const dimensionFilter = parsed.data.dimension_id || null

      async function calculateArea(area) {
        const dimensions = await dimensionService.list({ isActive: true })
        const selectedDimensions = dimensionFilter
          ? dimensions.filter((row) => row.id === dimensionFilter)
          : dimensions
        if (dimensionFilter && !selectedDimensions.length) {
          throw Object.assign(new Error('Dimension not found or inactive'), { status: 404 })
        }

        const signals = await signalService.list({ areaId: area.id, limit: 10000 })
        const submissions = await inspectorService.listSubmissions({
          areaId: area.id,
          status: 'approved',
          limit: 10000,
        })
        const aiConfig = await aiConfigService.getActive()
        const results = await scoreService.calculateForArea(area, selectedDimensions, {
          signals: signals.items || [],
          submissions: submissions || [],
          aiConfig,
        })
        return { area_id: area.id, calculated: results.length, results }
      }

      if (scope === 'all_areas') {
        const { items } = await areaService.list({
          status: AreaStatus.SCORING_ENABLED,
          limit: 10000,
        })
        const batch = []
        for (const area of items) {
          batch.push(await calculateArea(area))
        }
        return res.json({
          scope,
          areas: items.length,
          calculated: batch.reduce((sum, row) => sum + row.calculated, 0),
          results: batch,
        })
      }

      const areaId = parsed.data.area_id
      const area = await areaService.getById(areaId)
      if (!area) return res.status(404).json({ error: 'Area not found' })

      const payload = await calculateArea(area)
      return res.json({ scope, ...payload })
    } catch (err) {
      if (err.status === 404) return res.status(404).json({ error: err.message })
      logger.error({ err: err.message }, 'Failed to calculate scores')
      res.status(500).json({ error: err.message })
    }
  })

  // Manual override (PA-SCR-004)
  app.get('/api/admin/scoring/areas/:areaId/current-scores', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const area = await areaService.getById(req.params.areaId)
      if (!area) return res.status(404).json({ error: 'Area not found' })
      const scores = await scoreService.getCurrentScores(area.id)
      return res.json({ area_id: area.id, scores })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to load current scores')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/admin/scoring/override', authMiddleware, requirePlatformAdmin, requireElevated(), async (req, res) => {
    try {
      const parsed = scoringOverrideBodySchema.safeParse(req.body || {})
      if (!parsed.success) {
        return validationError(res, parsed)
      }
      const area = await areaService.getById(parsed.data.area_id)
      if (!area) return res.status(404).json({ error: 'Area not found' })
      const dimensions = await dimensionService.list({ isActive: true })
      if (!dimensions.some((row) => row.id === parsed.data.dimension_id)) {
        return res.status(404).json({ error: 'Dimension not found or inactive' })
      }

      const evidenceNote = parsed.data.evidence
        ? JSON.stringify(parsed.data.evidence)
        : null
      const recorded = await scoreService.manualOverride({
        areaId: parsed.data.area_id,
        dimensionId: parsed.data.dimension_id,
        score: parsed.data.score,
        rationale: parsed.data.rationale || evidenceNote,
        overriddenBy: req.user.id,
        reason: parsed.data.reason,
      })
      res.json(recorded)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to override score')
      res.status(500).json({ error: err.message })
    }
  })

  // Google usage
  app.get('/api/admin/google-usage', authMiddleware, requirePlatformAdmin, async (req, res) => {
    try {
      const { areaId, limit } = req.query
      const items = await googleService.listUsage({ areaId, limit: Number(limit || 100) })
      const monthlySpend = await googleService.getMonthlySpend()
      res.json({ items, monthly_spend_usd: monthlySpend, budget_usd_monthly: config.googleMapsBudgetUsdMonthly })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to list Google usage')
      res.status(500).json({ error: err.message })
    }
  })
}
