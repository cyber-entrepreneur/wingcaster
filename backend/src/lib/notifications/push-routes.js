/**
 * Capacitor / session-management routes for FCM device tokens.
 *
 * POST   /api/auth/push-token          register or evict-on-reregister
 * GET    /api/auth/push-tokens         list this user's devices
 * DELETE /api/auth/push-token/all      sign out of every device
 * DELETE /api/auth/push-token/:id      remove one device
 */

import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { validate } from '../validation.js'
import logger from '../logger.js'
import {
  deleteAllPushTokens,
  deletePushToken,
  listPushTokensForUser,
  registerPushToken,
} from './push.js'

export const pushTokenRegisterSchema = z.object({
  token: z.string().min(8).max(4096).trim(),
  platform: z.enum(['ios', 'android', 'web']),
  device_id: z.string().min(1).max(256).trim().optional().nullable(),
})

function publicTokenRow(row) {
  return {
    id: row.id,
    platform: row.platform,
    device_id: row.device_id || null,
    created_at: row.created_at,
    last_used_at: row.last_used_at || null,
  }
}

export function registerPushTokenRoutes(app, { auth = authMiddleware } = {}) {
  app.get('/api/auth/push-tokens', auth, async (req, res) => {
    try {
      const rows = await listPushTokensForUser(req.user.id)
      res.json({ tokens: (rows || []).map(publicTokenRow) })
    } catch (err) {
      logger.error({ err: err.message, user_id: req.user?.id }, 'list push tokens failed')
      res.status(500).json({ error: 'Failed to list push tokens' })
    }
  })

  app.post('/api/auth/push-token', auth, validate(pushTokenRegisterSchema), async (req, res) => {
    try {
      const { token, platform, device_id } = req.validated
      const result = await registerPushToken({
        userId: req.user.id,
        token,
        platform,
        deviceId: device_id || null,
      })
      res.status(result.inserted ? 201 : 200).json({ ok: true, id: result.id })
    } catch (err) {
      logger.error({ err: err.message, user_id: req.user?.id }, 'register push token failed')
      res.status(500).json({ error: 'Failed to register push token' })
    }
  })

  app.delete('/api/auth/push-token/all', auth, async (req, res) => {
    try {
      await deleteAllPushTokens(req.user.id)
      res.status(204).end()
    } catch (err) {
      logger.error({ err: err.message, user_id: req.user?.id }, 'delete all push tokens failed')
      res.status(500).json({ error: 'Failed to delete push tokens' })
    }
  })

  app.delete('/api/auth/push-token/:id', auth, async (req, res) => {
    try {
      const deleted = await deletePushToken({ userId: req.user.id, id: req.params.id })
      if (!deleted) return res.status(404).json({ error: 'Push token not found' })
      res.status(204).end()
    } catch (err) {
      logger.error({ err: err.message, user_id: req.user?.id, id: req.params.id }, 'delete push token failed')
      res.status(500).json({ error: 'Failed to delete push token' })
    }
  })
}
