import { authMiddleware } from '../../../auth.js'
import { requirePlatformAdmin } from '../../../lib/auth-guards.js'
import { resolveSessionEnv, WINGCASTER_ENV_HEADER } from '../../../lib/session-env.js'
import { createComparableReportReadService } from '../application/comparable-report-read-service.js'
import { createMarketImpactService } from '../application/market-impact-service.js'
import {
  createComparableReportDecisionService,
  DecisionError,
  goneReviewBody,
  REPORT_ERROR,
} from '../application/comparable-report-decisions.js'

/** Map DecisionError → HTTP response; rethrow unknown errors. */
function sendDecisionError(res, err) {
  if (err instanceof DecisionError || err?.name === 'DecisionError') {
    const status = err.httpStatus || 400
    const body =
      typeof err.toJSON === 'function'
        ? err.toJSON()
        : { error: err.message, ...(err.extra || {}), code: err.code }
    // Keep DecisionError.code authoritative for clients/tests (STEP_UP_REQUIRED).
    body.code = err.code
    return res.status(status).json(body)
  }
  throw err
}

export function parseCsv(text) {
  if (!text || typeof text !== 'string') return { headers: [], rows: [] }
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i])
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] !== undefined ? values[j].trim() : ''
    }
    if (Object.values(row).some((v) => v !== '')) rows.push(row)
  }
  return { headers, rows }
}

function splitCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export function normalizeExternalComparable(row) {
  const price = Number(row.price)
  if (!Number.isFinite(price) || price <= 0) return null

  return {
    source: String(row.source || 'manual_csv').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    source_url: row.source_url || null,
    external_id: row.external_id || null,
    title: row.title || row.location_text || 'Imported comparable',
    price,
    currency: String(row.currency || 'USD').trim().toUpperCase(),
    price_normalized_usd: row.currency?.toUpperCase() === 'USD' ? price : null,
    property_type: String(row.property_type || 'apartment').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    bedrooms: row.bedrooms ? Number(row.bedrooms) : null,
    bathrooms: row.bathrooms ? Number(row.bathrooms) : null,
    area_sqm: row.area_sqm ? Number(row.area_sqm) : null,
    condition: row.condition || 'unknown',
    furnished: row.furnished || 'unknown',
    view_type: row.view_type || 'unknown',
    payment_method: row.payment_method || 'unknown',
    location_text: row.location_text || row.city || null,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    status: 'active',
  }
}

export function registerAdminRoutes(app, services) {
  const {
    configService,
    currencyService,
    comparableService,
    analysisService,
    trendService,
    scraperService,
    recalculationJobService,
    agentPriceReportAdminService,
    benchmarkService,
    comparableReportReadService: injectedReadService,
    marketImpactService: injectedImpactService,
    decisionService: injectedDecisionService,
    dal,
    logger,
  } = services

  const admin = [authMiddleware, requirePlatformAdmin]
  const invalidateAllPricing = () => recalculationJobService?.invalidateAll
    ? recalculationJobService.invalidateAll({ enqueueJob: true })
    : Promise.resolve(null)

  function sendServiceError(res, err) {
    const status = err.status || err.httpStatus || 500
    if (status >= 500) throw err
    return res.status(status).json({
      error: err.code || err.message,
      message: err.message,
      code: err.code || undefined,
    })
  }

  const marketImpactService = injectedImpactService
    || (dal ? createMarketImpactService({ dal, logger }) : null)
  const comparableReportReadService = injectedReadService
    || (dal
      ? createComparableReportReadService({ dal, marketImpactService, logger })
      : null)

  const decisionService = injectedDecisionService
    || (dal
      ? createComparableReportDecisionService({
          dal,
          adapter: services.adapter,
          recalculationJobService,
          marketImpactService,
          logger,
        })
      : null)


  function stampEnv(req, res, env) {
    const resolved = env || resolveSessionEnv(req)
    try {
      res.setHeader(WINGCASTER_ENV_HEADER, resolved)
    } catch {
      // Headers may already be sent.
    }
    return resolved
  }


  // Match configs
  app.get('/api/admin/pricing/configs', admin, async (_req, res, next) => {
    try {
      res.json(await configService.listConfigs())
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/configs', admin, async (req, res, next) => {
    try {
      const created = await configService.createConfig(req.body)
      await invalidateAllPricing()
      res.status(201).json(created)
    } catch (err) { next(err) }
  })

  app.put('/api/admin/pricing/configs/:id', admin, async (req, res, next) => {
    try {
      const updated = await configService.updateConfig(req.params.id, req.body)
      if (!updated) return res.status(404).json({ error: 'Config not found' })
      await invalidateAllPricing()
      res.json(updated)
    } catch (err) { next(err) }
  })

  app.delete('/api/admin/pricing/configs/:id', admin, async (req, res, next) => {
    try {
      await configService.deleteConfig(req.params.id)
      await invalidateAllPricing()
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Sources
  app.get('/api/admin/pricing/sources', admin, async (_req, res, next) => {
    try {
      res.json(await scraperService.listSources())
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/sources', admin, async (req, res, next) => {
    try {
      const created = await scraperService.createSource(req.body)
      await invalidateAllPricing()
      res.status(201).json(created)
    } catch (err) { next(err) }
  })

  app.put('/api/admin/pricing/sources/:source', admin, async (req, res, next) => {
    try {
      const updated = await scraperService.updateSource(req.params.source, req.body)
      if (!updated) return res.status(404).json({ error: 'Source not found' })
      await invalidateAllPricing()
      res.json(updated)
    } catch (err) { next(err) }
  })

  app.delete('/api/admin/pricing/sources/:source', admin, async (req, res, next) => {
    try {
      await scraperService.deleteSource(req.params.source)
      await invalidateAllPricing()
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // CSV import for external comparables
  app.post('/api/admin/pricing/external-comparables/import-csv', admin, async (req, res, next) => {
    try {
      const { csv_text } = req.body
      if (!csv_text || typeof csv_text !== 'string') {
        return res.status(400).json({ error: 'csv_text is required' })
      }
      const { rows } = parseCsv(csv_text)
      const imported = []
      const errors = []
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const comparable = normalizeExternalComparable(row)
        if (!comparable) {
          errors.push({ row: i + 2, reason: 'Invalid or missing price' })
          continue
        }
        try {
          const inserted = await scraperService.upsertExternalComparable(comparable)
          imported.push(inserted)
        } catch (err) {
          errors.push({ row: i + 2, reason: err.message })
        }
      }
      await dal.insert('csv_import_logs', {
        id: crypto.randomUUID(),
        uploaded_by: req.user.id,
        source: 'manual_csv',
        filename: req.body.filename || 'import.csv',
        rows_received: rows.length,
        rows_imported: imported.length,
        rows_failed: errors.length,
        errors,
        created_at: new Date().toISOString(),
        data: {},
      })
      if (imported.length > 0) await invalidateAllPricing()
      res.json({ imported: imported.length, failed: errors.length, errors })
    } catch (err) { next(err) }
  })

  app.get('/api/admin/pricing/csv-import-logs', admin, async (_req, res, next) => {
    try {
      const logs = await dal.findAll('csv_import_logs', () => true)
      res.json(logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    } catch (err) { next(err) }
  })

  // Currency rates
  app.get('/api/admin/pricing/currency-rates', admin, async (_req, res, next) => {
    try {
      res.json(await currencyService.listRates())
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/currency-rates', admin, async (req, res, next) => {
    try {
      const created = await currencyService.createRate(req.body)
      await invalidateAllPricing()
      res.status(201).json(created)
    } catch (err) { next(err) }
  })

  app.put('/api/admin/pricing/currency-rates/:id', admin, async (req, res, next) => {
    try {
      const updated = await currencyService.updateRate(req.params.id, req.body)
      if (!updated) return res.status(404).json({ error: 'Rate not found' })
      await invalidateAllPricing()
      res.json(updated)
    } catch (err) { next(err) }
  })

  app.delete('/api/admin/pricing/currency-rates/:id', admin, async (req, res, next) => {
    try {
      await currencyService.deleteRate(req.params.id)
      await invalidateAllPricing()
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/currency-rates/refresh', admin, async (_req, res, next) => {
    try {
      const result = await currencyService.refreshRates()
      if (!result) return res.status(503).json({ error: 'All currency rate providers failed' })
      await invalidateAllPricing()
      res.json(result)
    } catch (err) { next(err) }
  })

  // Normalization rules
  app.get('/api/admin/pricing/normalization-rules', admin, async (_req, res, next) => {
    try {
      const rules = await dal.findAll('pricing_normalization_rules', () => true)
      res.json(rules)
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/normalization-rules', admin, async (req, res, next) => {
    try {
      const rule = await dal.insert('pricing_normalization_rules', {
        id: crypto.randomUUID(),
        ...req.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        data: req.body.data || {},
      })
      await invalidateAllPricing()
      res.status(201).json(rule)
    } catch (err) { next(err) }
  })

  app.put('/api/admin/pricing/normalization-rules/:id', admin, async (req, res, next) => {
    try {
      const existing = await dal.findOne('pricing_normalization_rules', (r) => r.id === req.params.id)
      if (!existing) return res.status(404).json({ error: 'Rule not found' })
      const updated = {
        ...existing,
        ...req.body,
        adjustment_percent: req.body.adjustment_percent !== undefined ? Number(req.body.adjustment_percent) : existing.adjustment_percent,
        updated_at: new Date().toISOString(),
        data: { ...existing.data, ...(req.body.data || {}) },
      }
      await dal.update('pricing_normalization_rules', (r) => r.id === req.params.id, () => updated)
      await invalidateAllPricing()
      res.json(updated)
    } catch (err) { next(err) }
  })

  app.delete('/api/admin/pricing/normalization-rules/:id', admin, async (req, res, next) => {
    try {
      await dal.remove('pricing_normalization_rules', (r) => r.id === req.params.id)
      await invalidateAllPricing()
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  async function enqueueRecalculation(req, res, next) {
    try {
      const job = await recalculationJobService.enqueue(req.body, req.user.id)
      res.status(202).json({ success: true, job })
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message })
      next(err)
    }
  }

  // Compatibility alias; recalculation is now asynchronous and restart-safe.
  app.post('/api/admin/pricing/recalculate', admin, enqueueRecalculation)
  app.post('/api/admin/pricing/recalculation-jobs', admin, enqueueRecalculation)

  app.get('/api/admin/pricing/recalculation-jobs', admin, async (req, res, next) => {
    try {
      res.json(await recalculationJobService.list({ status: req.query.status, scope_type: req.query.scope_type }))
    } catch (err) { next(err) }
  })

  app.get('/api/admin/pricing/recalculation-jobs/:id', admin, async (req, res, next) => {
    try {
      const job = await recalculationJobService.get(req.params.id, { includeItems: req.query.include_items === 'true' })
      if (!job) return res.status(404).json({ error: 'Recalculation job not found' })
      res.json(job)
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/recalculation-jobs/:id/cancel', admin, async (req, res, next) => {
    try {
      const job = await recalculationJobService.cancel(req.params.id)
      if (!job) return res.status(404).json({ error: 'Recalculation job not found' })
      res.json(job)
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/recalculation-jobs/:id/retry-failed', admin, async (req, res, next) => {
    try {
      const job = await recalculationJobService.retryFailed(req.params.id)
      if (!job) return res.status(404).json({ error: 'Recalculation job not found' })
      res.json(job)
    } catch (err) { next(err) }
  })

  // Trends
  app.get('/api/admin/pricing/trends', admin, async (_req, res, next) => {
    try {
      res.json(await trendService.getAdminTrendDashboard())
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/trends/run', admin, async (req, res, next) => {
    try {
      const result = await trendService.runAllSnapshots()
      res.json({ success: true, ...result })
    } catch (err) { next(err) }
  })

  // Agent price reports (WF-06 PA-PVA-009)
  app.get('/api/admin/pricing/agent-price-reports', admin, async (req, res, next) => {
    try {
      if (!agentPriceReportAdminService) {
        const reports = await dal.findAll('agent_price_reports', () => true)
        return res.json(reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      }
      const env = resolveSessionEnv(req)
      const payload = await agentPriceReportAdminService.listReports(req.query, {
        viewerId: req.user?.id,
        env,
      })
      res.json(payload)
    } catch (err) { next(err) }
  })

  app.get('/api/admin/pricing/agent-price-reports.csv', admin, async (req, res, next) => {
    try {
      if (!agentPriceReportAdminService) {
        return res.status(501).json({ error: 'CSV export unavailable' })
      }
      const env = resolveSessionEnv(req)
      const csv = await agentPriceReportAdminService.exportCsv(req.query, {
        viewerId: req.user?.id,
        env,
      })
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="agent-price-reports.csv"')
      res.send(csv)
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/agent-price-reports/bulk-review', admin, async (req, res, next) => {
    try {
      if (!agentPriceReportAdminService) {
        return res.status(501).json({ error: 'Bulk review unavailable' })
      }
      const env = resolveSessionEnv(req)
      const result = await agentPriceReportAdminService.bulkReview(req.body || {}, {
        viewerId: req.user?.id,
        env,
      })
      res.json(result)
    } catch (err) {
      try { return sendServiceError(res, err) } catch (e) { next(e) }
    }
  })

  app.get('/api/admin/pricing/agent-price-reports/:id', admin, async (req, res, next) => {
    try {
      if (!agentPriceReportAdminService) {
        const existing = await dal.findOne('agent_price_reports', (r) => r.id === req.params.id)
        if (!existing) return res.status(404).json({ error: 'Report not found' })
        return res.json(existing)
      }
      const env = resolveSessionEnv(req)
      const report = await agentPriceReportAdminService.getReport(req.params.id, {
        viewerId: req.user?.id,
        env,
      })
      if (!report) return res.status(404).json({ error: 'Report not found', code: 'NOT_FOUND' })
      res.json(report)
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/agent-price-reports/:id/review', admin, async (req, res, next) => {
    try {
      if (!agentPriceReportAdminService) {
        const { status, notes } = req.body
        if (!['verified', 'rejected'].includes(status)) {
          return res.status(400).json({ error: 'status must be verified or rejected' })
        }
        const existing = await dal.findOne('agent_price_reports', (r) => r.id === req.params.id)
        if (!existing) return res.status(404).json({ error: 'Report not found' })
        await dal.update('agent_price_reports', (r) => r.id === req.params.id, (r) => ({
          ...r,
          status: status || r.status,
          review_notes: notes !== undefined ? notes : r.review_notes,
          reviewed_by: req.user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
        return res.json({ success: true })
      }
      const env = resolveSessionEnv(req)
      const result = await agentPriceReportAdminService.reviewReport(req.params.id, req.body || {}, {
        viewerId: req.user?.id,
        env,
      })
      res.json(result)
    } catch (err) {
      try { return sendServiceError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/admin/pricing/agent-price-reports/:id/undo-review', admin, async (req, res, next) => {
    try {
      if (!agentPriceReportAdminService) {
        return res.status(501).json({ error: 'Undo review unavailable' })
      }
      const env = resolveSessionEnv(req)
      const result = await agentPriceReportAdminService.undoReview(req.params.id, {
        viewerId: req.user?.id,
        env,
      })
      res.json(result)
    } catch (err) {
      try { return sendServiceError(res, err) } catch (e) { next(e) }
    }
  })

  app.get('/api/admin/pricing/agent-price-reports/:reportId/evidence/:evidenceId/url', admin, async (req, res, next) => {
    try {
      const env = resolveSessionEnv(req)
      const report = agentPriceReportAdminService
        ? await agentPriceReportAdminService.getReport(req.params.reportId, { viewerId: req.user?.id, env })
        : await dal.findOne('agent_price_reports', (r) => r.id === req.params.reportId)
      if (!report) return res.status(404).json({ error: 'Report not found' })
      const evidence = (report.evidence_files || []).find((e) => e.id === req.params.evidenceId)
      const legacyUrl = report.supporting_document_url
      const url = evidence?.url || legacyUrl || null
      if (!url) return res.status(404).json({ error: 'Evidence not found' })
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
      res.json({ url, expires_at: expiresAt })
    } catch (err) { next(err) }
  })

  // Benchmark chart series (PA-PVA-009b)
  app.get('/api/admin/pricing/benchmarks/:segmentId/series', admin, async (req, res, next) => {
    try {
      if (!benchmarkService) {
        return res.json({ points: [], currency: 'USD', segment_id: req.params.segmentId })
      }
      const env = resolveSessionEnv(req)
      const series = await benchmarkService.getSeries(req.params.segmentId, {
        window: req.query.window || '90d',
        env,
      })
      res.json(series)
    } catch (err) { next(err) }
  })

  // Comparable reports — READ surfaces [BE-CMR-01/10/11/13/14]
  // Decision writes (/confirm-*, bulk, undo, affected) belong to Agents 5–6.
  // Keep legacy POST /:id/review until Agent 5 replaces it.

  app.get('/api/admin/pricing/reports.csv', admin, async (req, res, next) => {
    try {
      if (!comparableReportReadService) {
        return res.status(503).json({ error: 'Comparable report read service unavailable' })
      }
      const { csv, env, filename } = await comparableReportReadService.exportCsv(req.query, {
        viewerId: req.user?.id,
        req,
      })
      stampEnv(req, res, env)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(csv)
    } catch (err) { next(err) }
  })

  app.get('/api/admin/pricing/reports', admin, async (req, res, next) => {
    try {
      if (!comparableReportReadService) {
        const reports = await dal.findAll('comparable_reports', () => true)
        stampEnv(req, res)
        return res.json(reports)
      }
      const payload = await comparableReportReadService.listReports(req.query, {
        viewerId: req.user?.id,
        req,
      })
      stampEnv(req, res, payload.env)
      res.json({
        reports: payload.reports,
        pagination: payload.pagination,
        counts: payload.counts,
      })
    } catch (err) { next(err) }
  })

  app.get('/api/admin/pricing/reports/:reportId/reporter-history', admin, async (req, res, next) => {
    try {
      if (!comparableReportReadService) {
        return res.status(503).json({ error: 'Comparable report read service unavailable' })
      }
      const payload = await comparableReportReadService.getReporterHistory(req.params.reportId, {
        limit: req.query.limit,
        viewerId: req.user?.id,
        req,
      })
      if (!payload) return res.status(404).json({ error: 'Report not found' })
      stampEnv(req, res, payload.env)
      res.json(payload)
    } catch (err) { next(err) }
  })

  app.get('/api/admin/pricing/reports/:reportId/audit-trail', admin, async (req, res, next) => {
    try {
      if (!comparableReportReadService) {
        return res.status(503).json({ error: 'Comparable report read service unavailable' })
      }
      const payload = await comparableReportReadService.getAuditTrail(req.params.reportId, {
        viewerId: req.user?.id,
        req,
      })
      if (!payload) return res.status(404).json({ error: 'Report not found' })
      stampEnv(req, res, payload.env)
      res.json(payload)
    } catch (err) { next(err) }
  })

  app.get('/api/admin/pricing/reports/:reportId', admin, async (req, res, next) => {
    try {
      if (!comparableReportReadService) {
        return res.status(503).json({ error: 'Comparable report read service unavailable' })
      }
      const report = await comparableReportReadService.getReport(req.params.reportId, {
        viewerId: req.user?.id,
        req,
      })
      if (!report) return res.status(404).json({ error: 'Report not found' })
      stampEnv(req, res, report.env)
      res.json(report)
    } catch (err) { next(err) }
  })

  // Bulk reject/request-info + undo + affected valuations (BE-CMR-03/09/12).
  // Register BEFORE `/:reportId/...` so Express does not treat bulk paths as ids.

  app.post('/api/admin/pricing/reports/bulk-reject-as-invalid', admin, async (req, res, next) => {
    try {
      const { report_ids, reason_code, notes } = req.body || {}
      const result = await decisionService.bulkRejectAsInvalid({
        report_ids,
        reason_code,
        notes,
        actorId: req.user.id,
      })
      res.status(result.status).json(result.body)
    } catch (err) {
      if (err?.code === REPORT_ERROR.INVALID_INPUT) {
        return res.status(400).json({ error: err.message, code: err.code })
      }
      next(err)
    }
  })

  app.post('/api/admin/pricing/reports/bulk-request-info', admin, async (req, res, next) => {
    try {
      const { report_ids, reason_code, notes, requested_evidence } = req.body || {}
      const result = await decisionService.bulkRequestInfo({
        report_ids,
        reason_code,
        notes,
        requested_evidence,
        actorId: req.user.id,
      })
      res.status(result.status).json(result.body)
    } catch (err) {
      if (err?.code === REPORT_ERROR.INVALID_INPUT) {
        return res.status(400).json({ error: err.message, code: err.code })
      }
      next(err)
    }
  })

  app.get('/api/admin/pricing/reports/:reportId/affected-valuations', admin, async (req, res, next) => {
    try {
      const payload = await decisionService.listAffectedValuations(req.params.reportId, {
        page: req.query.page,
        pageSize: req.query.pageSize,
      })
      res.json(payload)
    } catch (err) {
      if (err?.code === REPORT_ERROR.NOT_FOUND) {
        return res.status(404).json({ error: err.message, code: err.code })
      }
      next(err)
    }
  })

  app.post('/api/admin/pricing/reports/:reportId/undo-decision', admin, async (req, res, next) => {
    try {
      const restored = await decisionService.undoDecision(req.params.reportId, {
        actorId: req.user.id,
      })
      res.json({ success: true, report: restored })
    } catch (err) {
      if (err?.code === REPORT_ERROR.NOT_FOUND) {
        return res.status(404).json({ error: err.message, code: err.code })
      }
      if (
        err?.code === REPORT_ERROR.RECALC_COMMITTED ||
        err?.code === REPORT_ERROR.UNDO_WINDOW_EXPIRED ||
        err?.code === REPORT_ERROR.NO_DECISION ||
        err?.code === REPORT_ERROR.OWN_CASE
      ) {
        return res.status(409).json({ error: err.message, code: err.code })
      }
      next(err)
    }
  })


  app.post('/api/admin/pricing/reports/:reportId/confirm-remove', admin, async (req, res, next) => {
    try {
      stampEnv(req, res)
      const result = await decisionService.confirmRemove({
        req,
        reportId: req.params.reportId,
        notes: req.body?.notes,
      })
      return res.status(result.httpStatus).json(result.body)
    } catch (err) {
      try { return sendDecisionError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/admin/pricing/reports/:reportId/confirm-quarantine', admin, async (req, res, next) => {
    try {
      stampEnv(req, res)
      const result = await decisionService.confirmQuarantine({
        req,
        reportId: req.params.reportId,
        notes: req.body?.notes,
        quarantineHours: req.body?.quarantine_hours ?? req.body?.quarantineHours,
      })
      return res.status(result.httpStatus).json(result.body)
    } catch (err) {
      try { return sendDecisionError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/admin/pricing/reports/:reportId/reject-as-invalid', admin, async (req, res, next) => {
    try {
      stampEnv(req, res)
      const result = await decisionService.rejectAsInvalid({
        req,
        reportId: req.params.reportId,
        reasonCode: req.body?.reason_code ?? req.body?.reasonCode,
        notes: req.body?.notes,
      })
      return res.status(result.httpStatus).json(result.body)
    } catch (err) {
      try { return sendDecisionError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/admin/pricing/reports/:reportId/request-info', admin, async (req, res, next) => {
    try {
      stampEnv(req, res)
      const result = await decisionService.requestInfo({
        req,
        reportId: req.params.reportId,
        reasonCode: req.body?.reason_code ?? req.body?.reasonCode,
        notes: req.body?.notes,
        requestedEvidence: req.body?.requested_evidence ?? req.body?.requestedEvidence,
      })
      return res.status(result.httpStatus).json(result.body)
    } catch (err) {
      try { return sendDecisionError(res, err) } catch (e) { next(e) }
    }
  })
  app.post('/api/admin/pricing/reports/:id/review', admin, async (req, res) => {
    stampEnv(req, res)
    return res.status(410).json(goneReviewBody())
  })

}
