/**
 * HTTP surface for BE-BLOCKER-15 activation_state + onboarding_events.
 *
 * GET  /api/agent/activation_state
 * POST /api/agent/activation_state/complete
 * POST /api/agent/activation_state/defer
 * POST /api/users/me/onboarding-events
 * POST /api/agent/onboarding-events   (alias)
 */

import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { validate } from '../validation.js'
import logger from '../logger.js'
import {
  ACTIVATION_STEP_IDS,
  COMPLETED_VIA_VALUES,
} from './steps.js'
import {
  ActivationConflictError,
  ActivationValidationError,
  completeActivationStep,
  deferActivationStep,
  getActivationState,
  recordTourOnboardingEvent,
} from './state.js'

export const completeActivationStepSchema = z.object({
  step_id: z.enum(ACTIVATION_STEP_IDS),
  completed_via: z.enum(COMPLETED_VIA_VALUES).optional().default('direct'),
  metadata: z.record(z.unknown()).optional(),
}).strict()

export const deferActivationStepSchema = z.object({
  step_id: z.enum(ACTIVATION_STEP_IDS),
}).strict()

export const tourOnboardingEventSchema = z.object({
  event: z.string().min(1).max(120).trim().optional(),
  event_type: z.string().min(1).max(120).trim().optional(),
  family: z.string().min(1).max(60).trim().optional(),
  tenant_id: z.string().min(1).max(120).trim().optional(),
  step_id: z.string().min(1).max(120).trim().optional(),
  tour_step: z.union([z.string().max(120), z.number()]).optional(),
  completed_via: z.string().max(60).trim().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).passthrough().refine(
  (body) => Boolean(body.event || body.event_type),
  { message: 'event is required' },
)

function sendActivationError(res, err, userId, label) {
  if (err instanceof ActivationValidationError) {
    return res.status(400).json({ error: err.message, code: err.code })
  }
  if (err instanceof ActivationConflictError) {
    return res.status(409).json({ error: err.message, code: err.code })
  }
  logger.error({ err: err.message, user_id: userId }, label)
  return res.status(500).json({ error: 'Internal server error' })
}

export function registerRoutes(app, { auth = authMiddleware } = {}) {
  app.get('/api/agent/activation_state', auth, async (req, res) => {
    try {
      const state = await getActivationState(req.user.id)
      res.json(state)
    } catch (err) {
      sendActivationError(res, err, req.user?.id, 'get activation state failed')
    }
  })

  app.post(
    '/api/agent/activation_state/complete',
    auth,
    validate(completeActivationStepSchema),
    async (req, res) => {
      try {
        const state = await completeActivationStep(req.user.id, req.validated)
        res.json(state)
      } catch (err) {
        sendActivationError(res, err, req.user?.id, 'complete activation step failed')
      }
    },
  )

  app.post(
    '/api/agent/activation_state/defer',
    auth,
    validate(deferActivationStepSchema),
    async (req, res) => {
      try {
        const state = await deferActivationStep(req.user.id, req.validated)
        res.json(state)
      } catch (err) {
        sendActivationError(res, err, req.user?.id, 'defer activation step failed')
      }
    },
  )

  const recordTour = async (req, res) => {
    try {
      await recordTourOnboardingEvent(req.user.id, req.validated || req.body)
      res.status(202).json({ accepted: true })
    } catch (err) {
      sendActivationError(res, err, req.user?.id, 'record onboarding event failed')
    }
  }

  app.post(
    '/api/users/me/onboarding-events',
    auth,
    validate(tourOnboardingEventSchema),
    recordTour,
  )

  // Alias — same handler; preferred by agent-scoped clients.
  app.post(
    '/api/agent/onboarding-events',
    auth,
    validate(tourOnboardingEventSchema),
    recordTour,
  )
}

export { registerRoutes as registerActivationRoutes }
