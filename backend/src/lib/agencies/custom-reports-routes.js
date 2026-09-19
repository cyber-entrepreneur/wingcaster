/**
 * AGN-REP-008 — Agency custom report routes.
 *
 *   GET  /api/agency/reports/custom/catalog
 *   GET  /api/agency/reports/custom
 *   GET  /api/agency/reports/custom/:id
 *   POST /api/agency/reports/custom
 *   PUT  /api/agency/reports/custom/:id
 *   POST /api/agency/reports/custom/run
 *   POST /api/agency/reports/custom/:id/run
 */

import { authMiddleware } from '../../auth.js'
import {
  createAgencyCustomReport,
  getAgencyCustomReport,
  getCustomReportCatalog,
  listAgencyCustomReports,
  runAgencyCustomReport,
  updateAgencyCustomReport,
} from './custom-reports.js'
import {
  membershipCanManageCustomReports,
  requireAgencyCustomReportsWrite,
  requireAgencyReportsRead,
} from './reports-access.js'

export function registerAgencyCustomReportRoutes(app, { auth = authMiddleware } = {}) {
  app.get('/api/agency/reports/custom/catalog', auth, requireAgencyReportsRead, async (_req, res) => {
    res.json(getCustomReportCatalog())
  })

  app.get('/api/agency/reports/custom', auth, requireAgencyReportsRead, async (req, res) => {
    const reports = await listAgencyCustomReports(req.agencyId)
    res.json({
      reports,
      permissions: {
        can_manage: membershipCanManageCustomReports(req.membership),
      },
    })
  })

  app.get('/api/agency/reports/custom/:id', auth, requireAgencyReportsRead, async (req, res) => {
    const report = await getAgencyCustomReport(req.agencyId, req.params.id)
    if (!report) return res.status(404).json({ error: 'Report not found' })
    res.json({
      report,
      permissions: {
        can_manage: membershipCanManageCustomReports(req.membership),
      },
    })
  })

  app.post('/api/agency/reports/custom', auth, requireAgencyCustomReportsWrite, async (req, res) => {
    const result = await createAgencyCustomReport(req.agencyId, req.body || {}, req.user.id)
    if (!result.ok) return res.status(400).json({ error: result.error })
    res.status(201).json({ report: result.report })
  })

  app.put('/api/agency/reports/custom/:id', auth, requireAgencyCustomReportsWrite, async (req, res) => {
    const result = await updateAgencyCustomReport(
      req.agencyId,
      req.params.id,
      req.body || {},
      req.user.id,
    )
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error })
    res.json({ report: result.report })
  })

  app.post('/api/agency/reports/custom/run', auth, requireAgencyReportsRead, async (req, res) => {
    const result = await runAgencyCustomReport(req.agencyId, req.body?.definition || req.body || {})
    res.json(result)
  })

  app.post('/api/agency/reports/custom/:id/run', auth, requireAgencyReportsRead, async (req, res) => {
    const report = await getAgencyCustomReport(req.agencyId, req.params.id)
    if (!report) return res.status(404).json({ error: 'Report not found' })
    const result = await runAgencyCustomReport(req.agencyId, report.definition)
    res.json({ report, ...result })
  })
}
