/**
 * AGN-REP-004 — agency agent leaderboard analytics.
 *
 *   GET /api/agency/analytics/agent-leaderboard
 *     ?start_date&end_date&metric=revenue|closings|response_time|conversion_rate
 */
import { z } from 'zod'
import { listUserAgencyMemberships } from '../tenant-authorization.js'
import { getAgentLeaderboard, METRICS } from './agent-leaderboard.js'

const querySchema = z
  .object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    metric: z.enum(METRICS).optional(),
  })
  .strict()

async function resolveExclusiveMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((row) => row.affiliation_mode === 'exclusive') || null
}

export function registerAgentLeaderboardRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('agent-leaderboard-routes requires authMiddleware')

  app.get('/api/agency/analytics/agent-leaderboard', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }

    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
    }

    const { start_date, end_date, metric } = parsed.data
    res.json(
      await getAgentLeaderboard({
        agencyId: membership.agency_id,
        startDate: start_date,
        endDate: end_date,
        metric: metric || 'revenue',
      }),
    )
  })
}

export { registerAgentLeaderboardRoutes as registerRoutes }
