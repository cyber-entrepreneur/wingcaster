/**
 * AGN-REP-002 — agency listings performance analytics.
 *
 *   GET /api/agency/analytics/listings-performance
 *     ?start_date&end_date&agent_id&area&property_type
 *
 * Scoped to the caller's exclusive agency membership. Returns 403 when the
 * caller has no active exclusive affiliation.
 */
import { z } from 'zod'
import { listUserAgencyMemberships } from '../tenant-authorization.js'
import { getListingsPerformance } from './listings-performance.js'

const querySchema = z
  .object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    agent_id: z.string().optional(),
    area: z.string().optional(),
    property_type: z.string().optional(),
  })
  .strict()

async function resolveExclusiveMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((row) => row.affiliation_mode === 'exclusive') || null
}

export function registerListingsPerformanceRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('listings-performance-routes requires authMiddleware')

  app.get('/api/agency/analytics/listings-performance', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }

    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
    }

    const { start_date, end_date, agent_id, area, property_type } = parsed.data
    res.json(
      await getListingsPerformance({
        agencyId: membership.agency_id,
        startDate: start_date,
        endDate: end_date,
        agentId: agent_id,
        area,
        propertyType: property_type,
      }),
    )
  })
}

export { registerListingsPerformanceRoutes as registerRoutes }
