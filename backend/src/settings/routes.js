/**
 * Settings HTTP surface.
 *
 *   GET /api/settings/index — capability-gated settings home menu
 */

import { findAll } from '../db.js'
import { authMiddleware } from '../auth.js'
import { buildSettingsIndex } from './index-menu.js'
import logger from '../lib/logger.js'

export function registerSettingsRoutes(app, { auth = authMiddleware, listMemberships } = {}) {
  const loadMemberships = listMemberships || (async (userId) => findAll(
    'tenant_memberships',
    (membership) => membership.user_id === userId && membership.status === 'active',
  ))

  app.get('/api/settings/index', auth, async (req, res) => {
    try {
      if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' })
      const memberships = await loadMemberships(req.user.id)
      res.json(buildSettingsIndex({ memberships }))
    } catch (err) {
      logger.error({ err: err.message, user_id: req.user?.id }, 'settings index failed')
      res.status(500).json({ error: 'Failed to load settings index' })
    }
  })
}
