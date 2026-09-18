import { authMiddleware } from '../../../auth.js'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { Collections } from '../infrastructure/db.js'
import { listAgencyMemberships, listUserAgencyMemberships } from '../../../tenant-authorization.js'
import {
  BULK_ADJUSTMENT_STRATEGIES,
  buildBulkPreview,
  clampReversalWindowHours,
  confirmPhraseFor,
  isReversible,
} from '../application/bulk-adjustment.js'

const AGENCY_PRICING_ADMIN_ROLES = new Set(['owner', 'admin'])

const bulkAdjustBodySchema = z.object({
  property_ids: z.array(z.string().min(1)).min(1).max(500),
  strategy: z.enum(BULK_ADJUSTMENT_STRATEGIES),
  percent: z.coerce.number().positive().max(100).optional(),
  delta: z.coerce.number().optional(),
}).strict()

const bulkApplyBodySchema = bulkAdjustBodySchema.extend({
  reversal_window_hours: z.coerce.number().optional(),
  confirm_phrase: z.string().min(1),
}).strict()

function invalidBody(result) {
  return {
    code: 'INVALID_BODY',
    error: 'INVALID_BODY',
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  }
}

export function registerRoleRoutes(app, services) {
  const { dal, analysisService, recalculationJobService, logger } = services

  app.get('/api/agent/pricing/portfolio', authMiddleware, async (req, res, next) => {
    try {
      const properties = await dal.findAll('properties', (property) => property.agent_id === req.user.id && property.status !== 'deleted')
      const listings = await analyzePortfolio(properties, analysisService, logger)
      const reports = await dal.findAll(Collections.AGENT_PRICE_REPORTS, (report) => report.reporter_id === req.user.id)
      const decisions = await dal.findAll(Collections.PRICING_DECISIONS, (decision) => decision.actor_id === req.user.id)
      res.json({ summary: summarize(listings), listings, reports: newestFirst(reports), decisions: newestFirst(decisions) })
    } catch (err) { next(err) }
  })

  app.get('/api/agency/pricing/portfolio', authMiddleware, async (req, res, next) => {
    try {
      const userMemberships = await listUserAgencyMemberships(req.user.id)
      const membership = userMemberships.find((item) => item.affiliation_mode === 'exclusive')
      if (!membership) return res.status(403).json({ error: 'Active agency membership required' })
      const members = await listAgencyMemberships(membership.agency_id)
      const memberIds = new Set(members.map((member) => member.user_id))
      const agents = await dal.findAll('agents', (agent) => memberIds.has(agent.id))
      const agentNames = new Map(agents.map((agent) => [agent.id, agent.name || agent.email || agent.id]))
      const properties = await dal.findAll('properties', (property) =>
        property.status !== 'deleted' && (property.agency_id === membership.agency_id || memberIds.has(property.agent_id))
      )
      const listings = (await analyzePortfolio(properties, analysisService, logger)).map((listing) => ({
        ...listing,
        agent_name: agentNames.get(listing.agent_id) || listing.agent_id || 'Unassigned',
      }))
      const agentSummaries = [...memberIds].map((agentId) => {
        const agentListings = listings.filter((listing) => listing.agent_id === agentId)
        return { agent_id: agentId, agent_name: agentNames.get(agentId) || agentId, ...summarize(agentListings) }
      })
      const reports = await dal.findAll(Collections.AGENT_PRICE_REPORTS, (report) => memberIds.has(report.reporter_id))
      res.json({
        agency_id: membership.agency_id,
        my_role: membership.role,
        summary: summarize(listings),
        agents: agentSummaries,
        listings,
        reports: newestFirst(reports),
      })
    } catch (err) { next(err) }
  })

  app.post('/api/agent/pricing/properties/:propertyId/keep-price', authMiddleware, async (req, res, next) => {
    try {
      const property = await ownedProperty(dal, req.params.propertyId, req.user.id)
      if (!property) return res.status(404).json({ error: 'Owned property not found' })
      const analysis = await dal.findOne(Collections.PROPERTY_PRICE_ANALYSES, (item) => item.property_id === property.id)
      const decision = await recordDecision(dal, {
        property,
        actorId: req.user.id,
        analysisId: analysis?.id || null,
        action: 'keep_price',
        newPrice: property.price,
        reason: req.body.reason,
      })
      res.status(201).json(decision)
    } catch (err) { next(err) }
  })

  app.post('/api/agent/pricing/properties/:propertyId/adjust-price', authMiddleware, async (req, res, next) => {
    try {
      const property = await ownedProperty(dal, req.params.propertyId, req.user.id)
      if (!property) return res.status(404).json({ error: 'Owned property not found' })
      const newPrice = Number(req.body.new_price)
      if (!Number.isFinite(newPrice) || newPrice <= 0) return res.status(400).json({ error: 'new_price must be a positive number' })
      const analysis = await dal.findOne(Collections.PROPERTY_PRICE_ANALYSES, (item) => item.property_id === property.id)
      const updated = { ...property, price: newPrice, updated_at: new Date().toISOString() }
      await dal.update('properties', (item) => item.id === property.id, () => updated)
      const decision = await recordDecision(dal, {
        property,
        actorId: req.user.id,
        analysisId: analysis?.id || null,
        action: 'adjust_price',
        newPrice,
        reason: req.body.reason,
      })
      await recalculationJobService.invalidateForPropertyChange(updated)
      res.status(201).json({ decision, property: updated })
    } catch (err) { next(err) }
  })

  // AGN-PRC-002 — Agency bulk price adjustment (Owner/Admin only).
  app.post('/api/agency/pricing/bulk-adjust/preview', authMiddleware, async (req, res, next) => {
    try {
      const membership = await resolveAgencyAdminMembership(req.user.id)
      if (!membership) return res.status(403).json({ error: 'Agency Owner or Admin role required' })
      const parsed = bulkAdjustBodySchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json(invalidBody(parsed))

      const listings = await selectAgencyListings(dal, membership.agency_id, parsed.data.property_ids)
      const preview = buildBulkPreview({
        listings,
        strategy: parsed.data.strategy,
        percent: parsed.data.percent,
        delta: parsed.data.delta,
      })
      res.json({ ...preview, confirm_phrase: confirmPhraseFor(preview.summary.changing_count) })
    } catch (err) { next(err) }
  })

  app.post('/api/agency/pricing/bulk-adjust', authMiddleware, async (req, res, next) => {
    try {
      const membership = await resolveAgencyAdminMembership(req.user.id)
      if (!membership) return res.status(403).json({ error: 'Agency Owner or Admin role required' })
      const parsed = bulkApplyBodySchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json(invalidBody(parsed))
      const { strategy, percent, delta, property_ids, confirm_phrase } = parsed.data

      const listings = await selectAgencyListings(dal, membership.agency_id, property_ids)
      const preview = buildBulkPreview({ listings, strategy, percent, delta })

      if (preview.summary.changing_count === 0) {
        return res.status(400).json({ code: 'NO_CHANGES', error: 'No listings would change under this strategy' })
      }
      if (preview.safety.exceeds_cap) {
        return res.status(422).json({
          code: 'REQUIRES_SECOND_APPROVAL',
          error: 'Batch exceeds bulk-adjustment safety limits',
          safety: preview.safety,
          summary: preview.summary,
        })
      }
      if (confirm_phrase.trim() !== confirmPhraseFor(preview.summary.changing_count)) {
        return res.status(400).json({ code: 'CONFIRMATION_MISMATCH', error: 'Confirmation phrase does not match' })
      }

      const now = new Date()
      const windowHours = clampReversalWindowHours(parsed.data.reversal_window_hours)
      const reversalDeadline = new Date(now.getTime() + windowHours * 3600 * 1000)
      const batchId = uuidv4()
      const currency = preview.items.find((item) => !item.skipped)?.currency || 'USD'

      const changing = preview.items.filter((item) => !item.skipped)
      const propertyById = new Map(listings.map((listing) => [listing.id, listing]))

      for (const item of changing) {
        const property = propertyById.get(item.property_id)
        if (!property) continue
        const updated = { ...property.raw, price: item.new_price, updated_at: now.toISOString() }
        await dal.update('properties', (row) => row.id === item.property_id, () => updated)
        await dal.insert(Collections.BULK_PRICE_ADJUSTMENT_ITEMS, {
          id: uuidv4(),
          batch_id: batchId,
          property_id: item.property_id,
          agent_id: item.agent_id,
          old_price: item.old_price,
          new_price: item.new_price,
          currency: item.currency,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          data: {},
        })
        await recordDecision(dal, {
          property: property.raw,
          actorId: req.user.id,
          analysisId: null,
          action: 'adjust_price',
          newPrice: item.new_price,
          reason: `Bulk adjustment (${strategy})`,
          extra: { kind: 'bulk_adjust', batch_id: batchId },
        })
        try { await recalculationJobService.invalidateForPropertyChange(updated) } catch (err) {
          logger.warn({ err: err.message, propertyId: item.property_id }, 'Bulk adjust invalidation failed')
        }
      }

      const batch = await dal.insert(Collections.BULK_PRICE_ADJUSTMENTS, {
        id: batchId,
        agency_id: membership.agency_id,
        actor_id: req.user.id,
        strategy,
        listing_count: changing.length,
        total_value_before: preview.summary.total_value_before,
        total_value_after: preview.summary.total_value_after,
        currency,
        status: 'applied',
        reversal_deadline: reversalDeadline.toISOString(),
        reverted_at: null,
        reverted_by: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        data: { percent: percent ?? null, delta: delta ?? null, reversal_window_hours: windowHours },
      })

      res.status(201).json({ batch: serializeBatch(batch, now), preview })
    } catch (err) { next(err) }
  })

  app.post('/api/agency/pricing/bulk-adjust/:batchId/undo', authMiddleware, async (req, res, next) => {
    try {
      const membership = await resolveAgencyAdminMembership(req.user.id)
      if (!membership) return res.status(403).json({ error: 'Agency Owner or Admin role required' })
      const batch = await dal.findOne(Collections.BULK_PRICE_ADJUSTMENTS, (row) => row.id === req.params.batchId)
      // Leak-safe: a batch from another agency is indistinguishable from a
      // non-existent one.
      if (!batch || batch.agency_id !== membership.agency_id) {
        return res.status(404).json({ error: 'Bulk adjustment not found' })
      }
      if (batch.status !== 'applied') {
        return res.status(409).json({ code: 'ALREADY_REVERTED', error: 'This batch has already been reverted' })
      }
      const now = new Date()
      if (!isReversible(batch, now)) {
        return res.status(409).json({ code: 'WINDOW_EXPIRED', error: 'The reversal window for this batch has closed' })
      }

      const items = await dal.findAll(Collections.BULK_PRICE_ADJUSTMENT_ITEMS, (row) => row.batch_id === batch.id)
      for (const item of items) {
        const property = await dal.findOne('properties', (row) => row.id === item.property_id)
        if (!property) continue
        const restored = { ...property, price: Number(item.old_price), updated_at: now.toISOString() }
        await dal.update('properties', (row) => row.id === item.property_id, () => restored)
        await recordDecision(dal, {
          property,
          actorId: req.user.id,
          analysisId: null,
          action: 'adjust_price',
          newPrice: Number(item.old_price),
          reason: 'Bulk adjustment reverted',
          extra: { kind: 'bulk_revert', batch_id: batch.id },
        })
        try { await recalculationJobService.invalidateForPropertyChange(restored) } catch (err) {
          logger.warn({ err: err.message, propertyId: item.property_id }, 'Bulk revert invalidation failed')
        }
      }

      const updated = await dal.update(
        Collections.BULK_PRICE_ADJUSTMENTS,
        (row) => row.id === batch.id,
        (row) => ({ ...row, status: 'reverted', reverted_at: now.toISOString(), reverted_by: req.user.id, updated_at: now.toISOString() }),
      )
      const result = updated && typeof updated === 'object' && updated.id
        ? updated
        : { ...batch, status: 'reverted', reverted_at: now.toISOString(), reverted_by: req.user.id }
      res.json({ batch: serializeBatch(result, now) })
    } catch (err) { next(err) }
  })

  app.get('/api/agency/pricing/bulk-adjust', authMiddleware, async (req, res, next) => {
    try {
      const membership = await resolveAgencyAdminMembership(req.user.id)
      if (!membership) return res.status(403).json({ error: 'Agency Owner or Admin role required' })
      const now = new Date()
      const batches = await dal.findAll(Collections.BULK_PRICE_ADJUSTMENTS, (row) => row.agency_id === membership.agency_id)
      res.json({ batches: newestFirst(batches).slice(0, 20).map((batch) => serializeBatch(batch, now)) })
    } catch (err) { next(err) }
  })
}

async function resolveAgencyAdminMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((item) => item.affiliation_mode === 'exclusive' && AGENCY_PRICING_ADMIN_ROLES.has(item.role)) || null
}

async function selectAgencyListings(dal, agencyId, propertyIds) {
  const members = await listAgencyMemberships(agencyId)
  const memberIds = new Set(members.map((member) => member.user_id))
  const agents = await dal.findAll('agents', (agent) => memberIds.has(agent.id))
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name || agent.email || agent.id]))
  const requested = new Set(propertyIds)
  const properties = await dal.findAll('properties', (property) =>
    requested.has(property.id) &&
    property.status !== 'deleted' &&
    (property.agency_id === agencyId || memberIds.has(property.agent_id)),
  )
  return Promise.all(properties.map(async (property) => {
    let median = null
    const analysis = await dal.findOne(Collections.PROPERTY_PRICE_ANALYSES, (item) => item.property_id === property.id)
    if (analysis && analysis.median_price != null) median = Number(analysis.median_price)
    return {
      id: property.id,
      title: property.title || property.id,
      agent_id: property.agent_id || null,
      agent_name: agentNames.get(property.agent_id) || null,
      currency: property.currency || 'USD',
      price: Number(property.price),
      median,
      raw: property,
    }
  }))
}

function serializeBatch(batch, now = new Date()) {
  return {
    id: batch.id,
    agency_id: batch.agency_id,
    actor_id: batch.actor_id,
    strategy: batch.strategy,
    listing_count: Number(batch.listing_count) || 0,
    total_value_before: batch.total_value_before != null ? Number(batch.total_value_before) : null,
    total_value_after: batch.total_value_after != null ? Number(batch.total_value_after) : null,
    currency: batch.currency || 'USD',
    status: batch.status,
    reversal_deadline: batch.reversal_deadline || null,
    reverted_at: batch.reverted_at || null,
    reverted_by: batch.reverted_by || null,
    reversible: isReversible(batch, now),
    created_at: batch.created_at,
  }
}

async function analyzePortfolio(properties, analysisService, logger) {
  return Promise.all(properties.map(async (property) => {
    try {
      const analysis = await analysisService.getAnalysis(property.id)
      return { ...property, pricing_analysis: analysis, pricing_error: null }
    } catch (err) {
      logger.warn({ err: err.message, propertyId: property.id }, 'Portfolio pricing analysis unavailable')
      return { ...property, pricing_analysis: null, pricing_error: { code: err.code || 'ANALYSIS_UNAVAILABLE', message: err.message } }
    }
  }))
}

function summarize(listings) {
  const analyses = listings.map((listing) => listing.pricing_analysis).filter(Boolean)
  return {
    total_listings: listings.length,
    analyzed_listings: analyses.length,
    above_market: analyses.filter((analysis) => analysis.target_vs_median === 'above').length,
    at_market: analyses.filter((analysis) => analysis.target_vs_median === 'at').length,
    below_market: analyses.filter((analysis) => analysis.target_vs_median === 'below').length,
    low_confidence: analyses.filter((analysis) => analysis.confidence === 'low').length,
    stale_rate: analyses.filter((analysis) => analysis.rate_is_stale).length,
    unavailable: listings.length - analyses.length,
  }
}

async function ownedProperty(dal, propertyId, actorId) {
  return dal.findOne('properties', (property) => property.id === propertyId && property.agent_id === actorId)
}

async function recordDecision(dal, { property, actorId, analysisId, action, newPrice, reason, extra }) {
  const now = new Date().toISOString()
  return dal.insert(Collections.PRICING_DECISIONS, {
    id: uuidv4(),
    property_id: property.id,
    actor_id: actorId,
    analysis_id: analysisId,
    channel: 'web',
    action,
    old_price: Number(property.price) || null,
    new_price: Number(newPrice) || null,
    currency: property.currency || 'USD',
    reason: reason || null,
    created_at: now,
    updated_at: now,
    data: extra || {},
  })
}

function newestFirst(rows) {
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}
