/**
 * AGN-REP-001 — agency reports home summary.
 *
 *   GET /api/agency/analytics/reports-home
 *
 * Scoped to the caller's exclusive agency membership. Returns 403 when the
 * caller has no active exclusive affiliation.
 */
import { z } from 'zod'
import { listUserAgencyMemberships } from '../tenant-authorization.js'
import { getAgencyReportsHome } from './agency-reports-home.js'

const querySchema = z.object({}).strict()

async function resolveExclusiveMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((row) => row.affiliation_mode === 'exclusive') || null
}

export function registerAgencyReportsHomeRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('agency-reports-home-routes requires authMiddleware')

  app.get('/api/agency/analytics/reports-home', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }

    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
    }

    res.json(await getAgencyReportsHome({ agencyId: membership.agency_id }))
  })
}

export { registerAgencyReportsHomeRoutes as registerRoutes }
