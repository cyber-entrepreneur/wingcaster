/**
 * GET /api/publishing/tracker — cursor-paginated portal submission ledger
 * GET /api/publishing/tracker/summary — KPI aggregate over the same filters
 *
 * BE-BLOCKER-11 (WF-03). Auth required. Scoped to the caller's agent /
 * active tenant (agency). Other tenants' attempts never appear.
 */

import { query as defaultQuery } from '../../db.js'
import logger from '../logger.js'
import {
  TrackerQueryError,
  assertTrackerTenantAccess,
  listTrackerAttempts,
  parseTrackerQuery,
  resolveTrackerScope,
  summarizeTrackerAttempts,
} from './tracker.js'

export {
  TRACKER_STATUSES,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  mapDistributionStatusToTracker,
  parseTrackerQuery,
  TrackerQueryError,
} from './tracker.js'

function sendQueryError(res, err) {
  return res.status(400).json({
    error: err.message || 'Invalid query parameters',
    issues: err.issues || [],
  })
}

/**
 * @param {import('express').Application} app
 * @param {{ authMiddleware: Function, query?: Function }} deps
 */
export function registerRoutes(app, { authMiddleware, query: queryFn } = {}) {
  if (!authMiddleware) {
    throw new Error('registerRoutes requires authMiddleware')
  }
  const runQuery = queryFn || defaultQuery

  app.get('/api/publishing/tracker/summary', authMiddleware, async (req, res) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const filters = parseTrackerQuery(req.query, { defaultMonth: true })
      const scope = resolveTrackerScope(req)
      if (!scope.agentId && !scope.agencyId) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const allowed = await assertTrackerTenantAccess(runQuery, scope)
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const body = await summarizeTrackerAttempts(runQuery, { scope, filters })
      return res.json(body)
    } catch (err) {
      if (err instanceof TrackerQueryError) return sendQueryError(res, err)
      logger.error(
        { err: err.message, user_id: req.user?.id },
        'publishing tracker summary failed',
      )
      return res.status(500).json({ error: 'Failed to load tracker summary' })
    }
  })

  app.get('/api/publishing/tracker', authMiddleware, async (req, res) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const filters = parseTrackerQuery(req.query, { defaultMonth: false })
      const scope = resolveTrackerScope(req)
      if (!scope.agentId && !scope.agencyId) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const allowed = await assertTrackerTenantAccess(runQuery, scope)
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const body = await listTrackerAttempts(runQuery, { scope, filters })
      return res.json(body)
    } catch (err) {
      if (err instanceof TrackerQueryError) return sendQueryError(res, err)
      logger.error(
        { err: err.message, user_id: req.user?.id },
        'publishing tracker list failed',
      )
      return res.status(500).json({ error: 'Failed to load tracker' })
    }
  })
}
