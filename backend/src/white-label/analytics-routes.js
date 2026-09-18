/**
 * AGN-WLB-005 — white-label analytics routes.
 *
 *   GET /api/agency/white-label/analytics?start_date&end_date
 */
import { z } from 'zod'
import { listUserAgencyMemberships } from '../tenant-authorization.js'
import { getWhiteLabelAnalytics } from './analytics.js'

const querySchema = z
  .object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .strict()

async function resolveExclusiveMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((row) => row.affiliation_mode === 'exclusive') || null
}

export function registerWhiteLabelAnalyticsRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('white-label-analytics-routes requires authMiddleware')

  app.get('/api/agency/white-label/analytics', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }

    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
    }

    const { start_date, end_date } = parsed.data
    res.json(
      await getWhiteLabelAnalytics({
        agencyId: membership.agency_id,
        startDate: start_date,
        endDate: end_date,
      }),
    )
  })
}

export { registerWhiteLabelAnalyticsRoutes as registerRoutes }
