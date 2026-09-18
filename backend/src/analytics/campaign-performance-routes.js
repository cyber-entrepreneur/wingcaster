/**
 * AGN-REP-006 — agency campaign performance analytics.
 *
 *   GET /api/agency/analytics/campaign-performance
 *     ?start_date&end_date&channel&agent_id
 */
import { z } from 'zod'
import { listUserAgencyMemberships } from '../tenant-authorization.js'
import { getCampaignPerformance } from './campaign-performance.js'

const querySchema = z
  .object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    channel: z.string().optional(),
    agent_id: z.string().optional(),
  })
  .strict()

async function resolveExclusiveMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((row) => row.affiliation_mode === 'exclusive') || null
}

export function registerCampaignPerformanceRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('campaign-performance-routes requires authMiddleware')

  app.get('/api/agency/analytics/campaign-performance', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }

    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
    }

    const { start_date, end_date, channel, agent_id } = parsed.data
    res.json(
      await getCampaignPerformance({
        agencyId: membership.agency_id,
        startDate: start_date,
        endDate: end_date,
        channel,
        agentId: agent_id,
      }),
    )
  })
}

export { registerCampaignPerformanceRoutes as registerRoutes }
