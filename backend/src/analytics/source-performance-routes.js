/**
 * SHR-INT-002 — lead-source performance analytics route.
 *
 *   GET /api/analytics/source-performance
 *     ?scope=all        (platform admins only) aggregate across all agents
 *     &agency_id=<id>    scope to an agency
 *     &start_date&end_date
 *
 * Mirrors the scoping of GET /api/analytics/crm: an ordinary caller sees their
 * own leads (agentId = req.user.id); scope=all is honoured only for a verified
 * platform admin.
 */
import { isPlatformAdmin } from '../lib/auth-guards.js'
import { getSourcePerformance } from './source-performance.js'

export function registerRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('source-performance-routes requires authMiddleware')

  app.get('/api/analytics/source-performance', authMiddleware, async (req, res) => {
    const scopeAll = req.query.scope === 'all' && (await isPlatformAdmin(req.user.id))
    const agentId = scopeAll ? null : req.user.id
    const agencyId = req.query.agency_id || null
    res.json(
      await getSourcePerformance({
        agentId,
        agencyId,
        startDate: req.query.start_date,
        endDate: req.query.end_date,
      }),
    )
  })
}
