/**
 * Agency onboarding-state HTTP surface.
 *
 * GET   /api/agency/:agencyId/onboarding-state
 * PATCH /api/agency/:agencyId/onboarding-state
 *
 * Requires an active owner/admin membership on that agency. Member, guest,
 * and non-members receive 403. Missing agency → 404.
 */

import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { findOne } from '../../db.js'
import { getAgencyMembership } from '../../tenant-authorization.js'
import { validate } from '../validation.js'
import logger from '../logger.js'
import { getAgencyOnboardingState, patchAgencyOnboardingState } from './agency-state.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

export const agencyOnboardingStatePatchSchema = z.object({
  step: z.string().min(1).max(120).trim().optional(),
  path: z.string().max(500).trim().nullable().optional(),
  checklist_delta: z.record(z.unknown()).optional(),
  dismissed_forever: z.boolean().optional(),
}).refine(
  (body) => body.step !== undefined
    || body.path !== undefined
    || body.checklist_delta !== undefined
    || body.dismissed_forever !== undefined,
  { message: 'At least one of step, path, checklist_delta, dismissed_forever is required' },
)

async function requireAgencyOwnerOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const agencyId = req.params.agencyId
    const agency = await findOne('agencies', (row) => row.id === agencyId)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })
    const member = await getAgencyMembership(agencyId, req.user.id)
    if (!member || !ADMIN_ROLES.has(member.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    req.agencyId = agencyId
    req.membership = member
    next()
  } catch (err) {
    next(err)
  }
}

export function registerAgencyOnboardingStateRoutes(app, { auth = authMiddleware } = {}) {
  app.get(
    '/api/agency/:agencyId/onboarding-state',
    auth,
    requireAgencyOwnerOrAdmin,
    async (req, res) => {
      try {
        const state = await getAgencyOnboardingState(req.agencyId)
        res.json(state)
      } catch (err) {
        logger.error({ err: err.message, agency_id: req.agencyId, user_id: req.user?.id }, 'get agency onboarding state failed')
        res.status(500).json({ error: 'Failed to load onboarding state' })
      }
    },
  )

  app.patch(
    '/api/agency/:agencyId/onboarding-state',
    auth,
    requireAgencyOwnerOrAdmin,
    validate(agencyOnboardingStatePatchSchema),
    async (req, res) => {
      try {
        const state = await patchAgencyOnboardingState(req.agencyId, req.validated)
        res.json(state)
      } catch (err) {
        logger.error({ err: err.message, agency_id: req.agencyId, user_id: req.user?.id }, 'patch agency onboarding state failed')
        res.status(500).json({ error: 'Failed to update onboarding state' })
      }
    },
  )
}

export { registerAgencyOnboardingStateRoutes as registerRoutes }
