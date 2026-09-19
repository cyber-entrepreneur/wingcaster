/**
 * AGN-REP-007 — agency revenue attribution analytics.
 *
 *   GET /api/agency/analytics/revenue-attribution
 *     ?start_date&end_date&channel&agent_id&campaign_id
 */
import { z } from 'zod'
import { listUserAgencyMemberships } from '../tenant-authorization.js'
import { getRevenueAttribution } from './revenue-attribution.js'

const querySchema = z
  .object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    channel: z.string().optional(),
    agent_id: z.string().optional(),
    campaign_id: z.string().optional(),
  })
  .strict()

async function resolveExclusiveMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((row) => row.affiliation_mode === 'exclusive') || null
}

export function registerRevenueAttributionRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('revenue-attribution-routes requires authMiddleware')

  app.get('/api/agency/analytics/revenue-attribution', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }

    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
    }

    const { start_date, end_date, channel, agent_id, campaign_id } = parsed.data
    res.json(
      await getRevenueAttribution({
        agencyId: membership.agency_id,
        startDate: start_date,
        endDate: end_date,
        channel,
        agentId: agent_id,
        campaignId: campaign_id,
      }),
    )
  })
}

export { registerRevenueAttributionRoutes as registerRoutes }
