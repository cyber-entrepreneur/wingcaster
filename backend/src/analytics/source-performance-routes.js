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
import { listUserAgencyMemberships } from '../tenant-authorization.js'
import { getSourcePerformance } from './source-performance.js'

export function registerRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('source-performance-routes requires authMiddleware')

  app.get('/api/analytics/source-performance', authMiddleware, async (req, res) => {
    const isAdmin = await isPlatformAdmin(req.user.id)
    const scopeAll = req.query.scope === 'all' && isAdmin

    // An agency scope is only honoured for a platform admin or an active member
    // of that agency — never trusted straight from the query, or any caller
    // could read another agency's lead-source performance.
    let agencyId = req.query.agency_id || null
    if (agencyId && !isAdmin) {
      const memberships = await listUserAgencyMemberships(req.user.id)
      if (!memberships.some((m) => m.agency_id === agencyId)) {
        return res.status(403).json({ error: 'Agency membership required' })
      }
    }

    const agentId = scopeAll || agencyId ? null : req.user.id
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
