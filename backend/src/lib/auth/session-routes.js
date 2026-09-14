/**
 * SHR-SET-004 — Sessions & devices.
 *
 * GET    /api/auth/sessions
 * DELETE /api/auth/sessions/all-except-current   (elevated)
 * DELETE /api/auth/sessions/:sessionId
 * POST   /api/auth/sign-out-everywhere             (elevated alias of all-except-current)
 *
 * Push-token device rows stay on GET/DELETE /api/auth/push-token* — this
 * module does not clear them. Bulk sign-out is sessions only.
 */

import { authMiddleware, requireElevated } from '../../auth.js'
import logger from '../logger.js'
import {
  listActiveSessions,
  publicSession,
  revokeUserSession,
  revokeUserSessions,
  sessionIdFromToken,
} from './user-sessions.js'

function currentSessionId(req) {
  return sessionIdFromToken(req.user) || null
}

async function signOutEverywhereExceptCurrent(req, res) {
  const exceptId = currentSessionId(req)
  try {
    const revoked = await revokeUserSessions(req.user.id, { exceptId })
    res.json({ revoked })
  } catch (err) {
    logger.error({ err: err.message, user_id: req.user?.id }, 'sign-out-everywhere failed')
    res.status(500).json({ error: 'Failed to sign out other sessions' })
  }
}

export function registerSessionRoutes(app, { auth = authMiddleware } = {}) {
  app.get('/api/auth/sessions', auth, async (req, res) => {
    try {
      const rows = await listActiveSessions(req.user.id)
      res.json({ sessions: rows.map((row) => publicSession(row, currentSessionId(req))) })
    } catch (err) {
      logger.error({ err: err.message, user_id: req.user?.id }, 'list sessions failed')
      res.status(500).json({ error: 'Failed to list sessions' })
    }
  })

  // Static path must be registered before :sessionId.
  app.delete(
    '/api/auth/sessions/all-except-current',
    auth,
    requireElevated(),
    signOutEverywhereExceptCurrent,
  )

  app.post(
    '/api/auth/sign-out-everywhere',
    auth,
    requireElevated(),
    signOutEverywhereExceptCurrent,
  )

  app.delete('/api/auth/sessions/:sessionId', auth, async (req, res) => {
    const sessionId = String(req.params.sessionId || '').trim()
    if (!sessionId) {
      return res.status(404).json({ error: 'That session no longer exists.', code: 'SESSION_NOT_FOUND' })
    }
    if (currentSessionId(req) && sessionId === currentSessionId(req)) {
      return res.status(403).json({
        error: "You can't sign this device out from here — use the top-bar sign-out.",
        code: 'CANNOT_REVOKE_CURRENT',
      })
    }
    try {
      const revoked = await revokeUserSession(req.user.id, sessionId)
      if (!revoked) {
        return res.status(404).json({ error: 'That session no longer exists.', code: 'SESSION_NOT_FOUND' })
      }
      res.json({ ok: true, id: sessionId })
    } catch (err) {
      logger.error({ err: err.message, user_id: req.user?.id, session_id: sessionId }, 'revoke session failed')
      res.status(500).json({ error: 'Failed to sign the session out' })
    }
  })
}
