/**
 * AGN-REP-003 — agency lead conversion funnel analytics.
 *
 *   GET /api/agency/analytics/lead-funnel
 *     ?start_date&end_date&source&agent_id&area
 *
 * Scoped to the caller's exclusive agency membership. Returns 403 when the
 * caller has no active exclusive affiliation (leak-safe: never 404).
 */
import { z } from 'zod'
import { listUserAgencyMemberships } from '../tenant-authorization.js'
import { getLeadFunnel } from './lead-funnel.js'

const querySchema = z
  .object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    source: z.string().optional(),
    agent_id: z.string().optional(),
    area: z.string().optional(),
  })
  .strict()

async function resolveExclusiveMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((row) => row.affiliation_mode === 'exclusive') || null
}

export function registerLeadFunnelRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('lead-funnel-routes requires authMiddleware')

  app.get('/api/agency/analytics/lead-funnel', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }

    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
    }

    const { start_date, end_date, source, agent_id, area } = parsed.data
    res.json(
      await getLeadFunnel({
        agencyId: membership.agency_id,
        startDate: start_date,
        endDate: end_date,
        source,
        agentId: agent_id,
        area,
      }),
    )
  })
}

export { registerLeadFunnelRoutes as registerRoutes }
