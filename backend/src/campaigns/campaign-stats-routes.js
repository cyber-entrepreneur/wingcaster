/**
 * AGT-CMP-004 — Campaign detail + performance.
 *
 *   GET /api/campaigns/:id/stats   live performance for one campaign
 *
 * Read-only aggregation over the existing campaign_* tables (plus
 * conversations/opportunities for truthful reply + conversion signals). Auth:
 * caller must own the campaign (agent_id / created_by) or share its agency via
 * assertOwnsCampaign, which is leak-safe → any denial surfaces as a 404 rather
 * than a 403 that would reveal the campaign exists.
 */
import { assertOwnsCampaign } from '../lib/authz.js'
import { getCampaignStats } from '../campaigns.js'

function isNotFound(err) {
  return err?.status === 404 || err?.name === 'NotFoundError'
}

export function registerRoutes(app, { authMiddleware }) {
  app.get('/api/campaigns/:id/stats', authMiddleware, async (req, res) => {
    try {
      await assertOwnsCampaign(req.user.id, req.params.id)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Campaign not found' })
      throw err
    }

    const stats = await getCampaignStats(req.params.id)
    if (!stats) return res.status(404).json({ error: 'Campaign not found' })
    res.json(stats)
  })
}
