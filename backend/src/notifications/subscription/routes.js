/**
 * HTTP surface for subscription notification preferences.
 *
 * Tenant self-serve (URLs kept under /api/billing/notifications/* so
 * NotificationPreferencesPage does not need a client retarget):
 *   GET  /api/billing/notifications/preferences
 *   PUT  /api/billing/notifications/preferences
 *   GET  /api/billing/notifications/history
 */

import { query } from '../../db.js'
import { ALL_EVENT_KINDS } from './events.js'
import { bulkSetPreferences, fullPreferenceMatrix } from './preferences.js'

export function registerNotificationRoutes(app, { authMiddleware } = {}) {
  app.get('/api/billing/notifications/preferences', authMiddleware, async (req, res) => {
    try {
      const matrix = await fullPreferenceMatrix(req.user.id, { channels: ['email'] })
      res.json({ preferences: matrix, event_kinds: ALL_EVENT_KINDS })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/billing/notifications/preferences', authMiddleware, async (req, res) => {
    try {
      const updates = Array.isArray(req.body?.updates) ? req.body.updates : []
      if (updates.length === 0) {
        return res.status(400).json({ error: 'updates[] is required' })
      }
      const rows = await bulkSetPreferences(req.user.id, updates, { actorId: req.user.id })
      res.json({ preferences: rows })
    } catch (err) {
      res.status(err?.code === 'INVALID_CHANNEL' || err?.code === 'MISSING_FIELD' ? 400 : 500)
        .json({ error: err.message, code: err.code })
    }
  })

  app.get('/api/billing/notifications/history', authMiddleware, async (req, res) => {
    try {
      const limit = Math.min(500, Number(req.query.limit) || 100)
      const rows = await query(
        `SELECT e.id, e.event_kind, e.subscription_id, e.subject, e.created_at,
                COUNT(d.id) FILTER (WHERE d.status = 'sent')::int    AS deliveries_sent,
                COUNT(d.id) FILTER (WHERE d.status = 'skipped')::int AS deliveries_skipped,
                COUNT(d.id) FILTER (WHERE d.status = 'failed')::int  AS deliveries_failed
           FROM public.notification_events e
           LEFT JOIN public.notification_deliveries d ON d.event_id = e.id
          WHERE e.tenant_id = $1
          GROUP BY e.id
          ORDER BY e.created_at DESC
          LIMIT $2`,
        [req.user.id, limit],
      )
      res.json({ events: rows })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
