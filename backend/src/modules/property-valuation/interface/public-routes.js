import { authMiddleware } from '../../../auth.js'
import { assertOwnsProperty, NotFoundError } from '../../../lib/authz.js'
import { reportExpiresAt } from '../../../workers/report-expiry-worker.js'
import {
  assertOwnedEvidenceIds,
  PricingEvidenceError,
} from '../application/pricing-evidence.js'
import {
  requirePriceReportsSubmitEntitlement,
  enforceDailySubmitRateLimit,
  assertNoOpenComparableDuplicate,
  assertPriceReportSubjectDailyCap,
  writeSubmitAudit,
  normalizeReporterConfidence,
  normalizeSupportingDocumentIds,
} from '../application/submit-guards.js'
import { registerPricingEvidenceRoutes } from './evidence-routes.js'

export function registerPublicRoutes(app, services) {
  const { analysisService, comparableService, trendService, configService, dal, logger } = services

  registerPricingEvidenceRoutes(app)

  // Property-level valuation exposes commercial-sensitive comparables and
  // price ranges. Only the property's owner (or an agency-mate with access
  // per authz rules) may read them — despite the file being named
  // "public-routes.js", these two routes are NOT anonymous surfaces.
  app.get('/api/pricing/analysis/:propertyId', authMiddleware, async (req, res, next) => {
    try {
      await assertOwnsProperty(req.user.id, req.params.propertyId)
      const analysis = await analysisService.getAnalysis(req.params.propertyId, {
        matchConfigId: req.query.match_config_id || null,
      })
      res.json(analysis)
    } catch (err) {
      if (err instanceof NotFoundError) return res.status(404).json({ error: 'Property not found' })
      logger.warn({ err: err.message, propertyId: req.params.propertyId }, 'price analysis failed')
      if (err.code === 'CURRENCY_RATE_UNAVAILABLE') {
        return res.status(503).json({ error: err.message, code: err.code, details: err.details })
      }
      next(err)
    }
  })

  app.get('/api/pricing/comparables/:propertyId', authMiddleware, async (req, res, next) => {
    try {
      const property = await assertOwnsProperty(req.user.id, req.params.propertyId)
      const config = await configService.getDefaultConfig()
      const comparables = await comparableService.findComparables(property, {
        matchConfig: config?.config_json,
      })
      res.json(comparables)
    } catch (err) {
      if (err instanceof NotFoundError) return res.status(404).json({ error: 'Property not found' })
      logger.warn({ err: err.message, propertyId: req.params.propertyId }, 'comparables lookup failed')
      next(err)
    }
  })

  app.get('/api/pricing/trends/:areaId', async (req, res, next) => {
    try {
      const { property_type } = req.query
      if (!property_type) return res.status(400).json({ error: 'property_type query param is required' })
      const trends = await trendService.getTrends(req.params.areaId, property_type)
      res.json(trends)
    } catch (err) {
      logger.warn({ err: err.message, areaId: req.params.areaId }, 'public trends failed')
      next(err)
    }
  })

  async function handleReportComparable(req, res, next) {
    try {
      const entitlement = await requirePriceReportsSubmitEntitlement(req)
      if (!entitlement.ok) return res.status(entitlement.status).json(entitlement.body)

      const rate = await enforceDailySubmitRateLimit(req, dal)
      if (!rate.ok) return res.status(rate.status).json(rate.body)

      const { comparable_id, comparable_type, reason, notes, reporter_confidence, supporting_document_ids } =
        req.body
      if (!comparable_id || !comparable_type || !reason) {
        return res.status(400).json({ error: 'comparable_id, comparable_type, and reason are required' })
      }
      if (!['internal', 'external', 'agent_report'].includes(comparable_type)) {
        return res.status(400).json({ error: 'comparable_type must be internal, external, or agent_report' })
      }
      if (!['fake_listing', 'incorrect_price', 'already_sold', 'wrong_details', 'other'].includes(reason)) {
        return res.status(400).json({ error: 'Invalid report reason' })
      }

      const confidence = normalizeReporterConfidence(reporter_confidence)
      if (confidence === undefined) {
        return res.status(400).json({
          error: 'reporter_confidence must be self_witnessed, hearsay, or hard_evidence',
        })
      }
      const docIds = normalizeSupportingDocumentIds(supporting_document_ids)
      if (docIds === null) {
        return res.status(400).json({ error: 'supporting_document_ids must be an array of strings' })
      }
      try {
        await assertOwnedEvidenceIds(req.user.id, docIds)
      } catch (err) {
        if (err instanceof PricingEvidenceError) {
          return res.status(err.httpStatus).json(err.toJSON())
        }
        throw err
      }

      const dup = await assertNoOpenComparableDuplicate({
        reporterId: req.user.id,
        comparableId: comparable_id,
        dal,
      })
      if (!dup.ok) return res.status(dup.status).json(dup.body)

      const createdAt = new Date().toISOString()
      const report = await dal.insert('comparable_reports', {
        id: crypto.randomUUID(),
        reporter_id: req.user?.id || null,
        comparable_id,
        comparable_type,
        reason,
        notes: notes || null,
        reporter_confidence: confidence,
        supporting_document_ids: docIds,
        status: 'pending',
        expires_at: reportExpiresAt(createdAt),
        created_at: createdAt,
        updated_at: createdAt,
        data: {},
      })

      await writeSubmitAudit({
        type: 'bad_comparable_submit',
        req,
        tenant: entitlement.tenant,
        reportId: report.id,
        subject: {
          comparable_id,
          comparable_type,
          reason,
        },
      })

      res.status(201).json(report)
    } catch (err) {
      if (err?.code === 'SUBMIT_GUARD_LOOKUP_FAILED') {
        return res.status(503).json({
          error: 'Submit guards temporarily unavailable',
          code: 'SUBMIT_GUARD_UNAVAILABLE',
        })
      }
      logger.warn({ err: err.message }, 'report comparable failed')
      next(err)
    }
  }

  app.post('/api/pricing/report-comparable', authMiddleware, handleReportComparable)
  // Optional alias from brief naming (bad-comparable-reports).
  app.post('/api/pricing/bad-comparable-reports', authMiddleware, handleReportComparable)

  // Agent-reported sold prices. Authenticated agents can submit; platform admin reviews.
  app.post('/api/pricing/agent-price-reports', authMiddleware, async (req, res, next) => {
    try {
      const entitlement = await requirePriceReportsSubmitEntitlement(req)
      if (!entitlement.ok) return res.status(entitlement.status).json(entitlement.body)

      const rate = await enforceDailySubmitRateLimit(req, dal)
      if (!rate.ok) return res.status(rate.status).json(rate.body)

      const {
        property_id,
        external_property_title,
        external_property_location,
        property_type,
        bedrooms,
        bathrooms,
        area_sqm,
        sold_price,
        currency,
        sold_date,
        notes,
        supporting_document_url,
        supporting_document_ids,
        segment_id,
        segment_label,
        recommendation_price_point,
        recommendation_price_point_minor,
        country_code,
        reporter_confidence,
      } = req.body
      if (!sold_price || Number(sold_price) <= 0) {
        return res.status(400).json({ error: 'sold_price is required' })
      }
      if (sold_date && Number.isNaN(new Date(sold_date).getTime())) {
        return res.status(400).json({ error: 'sold_date must be a valid date' })
      }
      const normalizedCurrency = String(currency || 'USD').trim().toUpperCase()
      if (!/^[A-Z]{3,10}$/.test(normalizedCurrency)) {
        return res.status(400).json({ error: 'currency must be a valid currency code' })
      }

      const confidence = normalizeReporterConfidence(reporter_confidence)
      if (confidence === undefined) {
        return res.status(400).json({
          error: 'reporter_confidence must be self_witnessed, hearsay, or hard_evidence',
        })
      }
      const docIds = normalizeSupportingDocumentIds(supporting_document_ids)
      if (docIds === null) {
        return res.status(400).json({ error: 'supporting_document_ids must be an array of strings' })
      }
      try {
        await assertOwnedEvidenceIds(req.user.id, docIds)
      } catch (err) {
        if (err instanceof PricingEvidenceError) {
          return res.status(err.httpStatus).json(err.toJSON())
        }
        throw err
      }

      // If the report references a property in our system, the reporter
      // must own it — otherwise anyone could attach a fabricated sold-price
      // to any listing.
      if (property_id) {
        try {
          await assertOwnsProperty(req.user.id, property_id)
        } catch (err) {
          if (err instanceof NotFoundError) return res.status(404).json({ error: 'Property not found' })
          throw err
        }
      }

      const subjectCap = await assertPriceReportSubjectDailyCap({
        reporterId: req.user.id,
        propertyId: property_id || null,
        externalTitle: external_property_title || null,
        dal,
      })
      if (!subjectCap.ok) return res.status(subjectCap.status).json(subjectCap.body)

      let recommendationPoint = null
      if (recommendation_price_point != null && recommendation_price_point !== '') {
        recommendationPoint = Number(recommendation_price_point)
      } else if (recommendation_price_point_minor != null && recommendation_price_point_minor !== '') {
        recommendationPoint = Number(recommendation_price_point_minor) / 100
      }
      if (recommendationPoint != null && (!Number.isFinite(recommendationPoint) || recommendationPoint < 0)) {
        return res.status(400).json({ error: 'recommendation_price_point must be a non-negative number' })
      }
      if (country_code != null && country_code !== '' && !/^[A-Za-z]{2}$/.test(String(country_code).trim())) {
        return res.status(400).json({ error: 'country_code must be a 2-letter ISO country code' })
      }
      const createdAt = new Date().toISOString()
      const report = await dal.insert('agent_price_reports', {
        id: crypto.randomUUID(),
        reporter_id: req.user?.id || null,
        agent_id: req.user?.id || null,
        property_id: property_id || null,
        external_property_title: external_property_title || null,
        external_property_location: external_property_location || null,
        property_type: property_type || null,
        bedrooms: bedrooms != null ? Number(bedrooms) : null,
        bathrooms: bathrooms != null ? Number(bathrooms) : null,
        area_sqm: area_sqm != null ? Number(area_sqm) : null,
        sold_price: Number(sold_price),
        currency: normalizedCurrency,
        sold_date: sold_date || null,
        notes: notes || null,
        supporting_document_url: supporting_document_url || null,
        supporting_document_ids: docIds,
        reporter_confidence: confidence,
        segment_id: segment_id ? String(segment_id).trim() : null,
        segment_label: segment_label ? String(segment_label).trim() : null,
        country_code: country_code ? String(country_code).trim().toUpperCase().slice(0, 2) : null,
        recommendation_price_point: recommendationPoint,
        status: 'pending_review',
        env: 'live',
        expires_at: reportExpiresAt(createdAt),
        created_at: createdAt,
        updated_at: createdAt,
        data: {},
      })

      await writeSubmitAudit({
        type: 'price_report_submit',
        req,
        tenant: entitlement.tenant,
        reportId: report.id,
        subject: {
          property_id: property_id || null,
          external_property_title: external_property_title || null,
          sold_price: Number(sold_price),
          currency: normalizedCurrency,
        },
      })

      res.status(201).json(report)
    } catch (err) {
      logger.warn({ err: err.message }, 'agent price report failed')
      if (err?.code === 'SUBMIT_GUARD_LOOKUP_FAILED') {
        return res.status(503).json({
          error: 'Submit guards temporarily unavailable',
          code: 'SUBMIT_GUARD_UNAVAILABLE',
        })
      }
      next(err)
    }
  })

  app.get('/api/pricing/my-comparable-reports', authMiddleware, async (req, res, next) => {
    try {
      const reports = await dal.findAll('comparable_reports', (report) => report.reporter_id === req.user.id)
      res.json(reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    } catch (err) { next(err) }
  })

  app.get('/api/pricing/my-agent-price-reports', authMiddleware, async (req, res, next) => {
    try {
      const reports = await dal.findAll('agent_price_reports', (report) => report.reporter_id === req.user.id)
      res.json(reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    } catch (err) { next(err) }
  })
}
