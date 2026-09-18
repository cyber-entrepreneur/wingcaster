import { authMiddleware } from '../../../auth.js'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { Collections } from '../infrastructure/db.js'
import { listAgencyMemberships, listUserAgencyMemberships } from '../../../tenant-authorization.js'
import { registerBulkPriceAdjustmentRoutes } from './bulk-price-adjustment-routes.js'

export const agencyComparablesQuerySchema = z.object({
  city: z.string().trim().max(100).optional(),
  area: z.string().trim().max(120).optional(),
  property_type: z.string().trim().max(100).optional(),
  source: z.enum(['internal', 'external', 'agent_report']).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
}).strict().superRefine((query, ctx) => {
  if (query.date_from && query.date_to && query.date_from > query.date_to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['date_to'],
      message: 'date_to must be on or after date_from',
    })
  }
})

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

  app.get('/api/agency/pricing/comparables', authMiddleware, async (req, res, next) => {
    try {
      const parsed = agencyComparablesQuerySchema.safeParse(req.query || {})
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        })
      }

      const userMemberships = await listUserAgencyMemberships(req.user.id)
      const membership = userMemberships.find((item) => item.affiliation_mode === 'exclusive')
      if (!membership) return res.status(403).json({ error: 'Active agency membership required' })

      const members = await listAgencyMemberships(membership.agency_id)
      const memberIds = new Set(members.map((member) => member.user_id))
      const [properties, externalComparables, agentReports] = await Promise.all([
        dal.findAll('properties', (property) =>
          property.status !== 'deleted' &&
          property.status !== 'draft' &&
          (property.agency_id === membership.agency_id || memberIds.has(property.agent_id))
        ),
        dal.findAll(Collections.EXTERNAL_COMPARABLES, (comparable) =>
          comparable.status === 'active' || comparable.status === 'sold'
        ),
        dal.findAll(Collections.AGENT_PRICE_REPORTS, (report) =>
          memberIds.has(report.reporter_id) &&
          (report.status === 'verified' || report.status === 'incorporated')
        ),
      ])

      const rows = [
        ...properties.map(serializeInternalComparable),
        ...externalComparables.map(serializeExternalComparable),
        ...agentReports.map(serializeAgentReportComparable),
      ]
      const filtered = rows
        .filter((row) => matchesComparableQuery(row, parsed.data))
        .sort((a, b) => new Date(b.evidence_date || 0) - new Date(a.evidence_date || 0))

      res.json({
        agency_id: membership.agency_id,
        total: filtered.length,
        coordinates_available: filtered.filter((row) => row.latitude != null && row.longitude != null).length,
        items: filtered.slice(0, parsed.data.limit),
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

  registerBulkPriceAdjustmentRoutes(app, {
    dal,
    analysisService,
    recalculationJobService,
    logger,
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

async function recordDecision(dal, { property, actorId, analysisId, action, newPrice, reason }) {
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
    data: {},
  })
}

function newestFirst(rows) {
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

function serializeInternalComparable(property) {
  return comparableShape({
    id: property.id,
    source: 'internal',
    source_label: 'Agency listing',
    title: property.title,
    location: property.location,
    city: property.city,
    area_name: property.neighborhood,
    property_type: property.property_type,
    evidence_date: property.closed_at || property.updated_at || property.created_at,
    price: property.price,
    currency: property.currency || property.territory_currency || 'USD',
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    area_sqm: property.area,
    latitude: property.latitude,
    longitude: property.longitude,
    status: property.status,
    detail_path: `/listings/${encodeURIComponent(property.id)}`,
  })
}

function serializeExternalComparable(comparable) {
  return comparableShape({
    id: comparable.id,
    source: 'external',
    source_label: comparable.source_label || comparable.source || 'External source',
    title: comparable.title,
    location: comparable.location_text,
    city: comparable.city || comparable.data?.city,
    area_name: comparable.neighborhood || comparable.data?.neighborhood,
    property_type: comparable.property_type,
    evidence_date: comparable.sold_date || comparable.scraped_at || comparable.created_at,
    price: comparable.price,
    normalized_price: comparable.price_normalized_usd,
    currency: comparable.currency,
    bedrooms: comparable.bedrooms,
    bathrooms: comparable.bathrooms,
    area_sqm: comparable.area_sqm,
    latitude: comparable.latitude,
    longitude: comparable.longitude,
    status: comparable.status,
    source_url: safeHttpUrl(comparable.source_url),
  })
}

function serializeAgentReportComparable(report) {
  return comparableShape({
    id: report.id,
    source: 'agent_report',
    source_label: 'Verified agency report',
    title: report.external_property_title,
    location: report.external_property_location,
    city: report.city || report.data?.city,
    area_name: report.neighborhood || report.data?.neighborhood,
    property_type: report.property_type,
    evidence_date: report.sold_date || report.created_at,
    price: report.sold_price,
    normalized_price: report.sold_price_normalized_usd,
    currency: report.currency,
    bedrooms: report.bedrooms,
    bathrooms: report.bathrooms,
    area_sqm: report.area_sqm,
    latitude: report.latitude || report.data?.latitude,
    longitude: report.longitude || report.data?.longitude,
    status: report.status,
  })
}

function comparableShape(raw) {
  const completeness = [
    raw.price,
    raw.property_type,
    raw.area_sqm,
    raw.evidence_date,
    raw.latitude != null && raw.longitude != null,
  ].filter(Boolean).length
  const base = raw.source === 'agent_report' ? 75 : raw.source === 'external' ? 55 : 45
  const strength_score = Math.min(99, base + completeness * 5)
  return {
    ...raw,
    price: finiteNumber(raw.price),
    normalized_price: finiteNumber(raw.normalized_price),
    bedrooms: finiteNumber(raw.bedrooms),
    bathrooms: finiteNumber(raw.bathrooms),
    area_sqm: finiteNumber(raw.area_sqm),
    latitude: finiteNumber(raw.latitude),
    longitude: finiteNumber(raw.longitude),
    strength_score,
    strength: strength_score >= 80 ? 'strong' : strength_score >= 60 ? 'moderate' : 'limited',
  }
}

function matchesComparableQuery(row, query) {
  if (query.source && row.source !== query.source) return false
  if (query.property_type && normalize(row.property_type) !== normalize(query.property_type)) return false
  if (query.city && !normalize(row.city || row.location).includes(normalize(query.city))) return false
  if (query.area && !normalize(row.area_name || row.location).includes(normalize(query.area))) return false

  const evidenceDay = row.evidence_date ? String(row.evidence_date).slice(0, 10) : ''
  if (query.date_from && (!evidenceDay || evidenceDay < query.date_from)) return false
  if (query.date_to && (!evidenceDay || evidenceDay > query.date_to)) return false
  return true
}

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase()
}

function finiteNumber(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function safeHttpUrl(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}
