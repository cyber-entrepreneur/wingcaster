/**
 * Agent onboarding-state HTTP surface.
 *
 * GET   /api/user/onboarding-state
 * PATCH /api/user/onboarding-state
 */

import { z } from 'zod'
import { authMiddleware } from '../auth.js'
import { validate } from './validation.js'
import logger from './logger.js'
import { getOnboardingState, patchOnboardingState } from './onboarding-state.js'

export const onboardingStatePatchSchema = z.object({
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

export function registerOnboardingStateRoutes(app, { auth = authMiddleware } = {}) {
  app.get('/api/user/onboarding-state', auth, async (req, res) => {
    try {
      const state = await getOnboardingState(req.user.id)
      res.json(state)
    } catch (err) {
      logger.error({ err: err.message, user_id: req.user?.id }, 'get onboarding state failed')
      res.status(500).json({ error: 'Failed to load onboarding state' })
    }
  })

  app.patch(
    '/api/user/onboarding-state',
    auth,
    validate(onboardingStatePatchSchema),
    async (req, res) => {
      try {
        const state = await patchOnboardingState(req.user.id, req.validated)
        res.json(state)
      } catch (err) {
        logger.error({ err: err.message, user_id: req.user?.id }, 'patch onboarding state failed')
        res.status(500).json({ error: 'Failed to update onboarding state' })
      }
    },
  )
}
