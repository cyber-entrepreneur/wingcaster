/**
 * Agent onboarding checklist / step persistence (BE-BLOCKER-20).
 *
 * GET  /api/user/onboarding-state  — caller's row, or a default if none exists
 * PATCH /api/user/onboarding-state — upsert; checklist_delta shallow-merges
 *
 * Concurrent PATCHes merge checklist keys in SQL via JSONB `||` so two
 * clients ticking different items cannot clobber each other.
 */

import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { query } from '../../db.js'
import { validate } from '../validation.js'
import logger from '../logger.js'

export const DEFAULT_ONBOARDING_STATE = Object.freeze({
  step: 'welcome',
  path: null,
  checklist: Object.freeze({}),
  dismissed_forever: false,
})

export const patchAgentOnboardingStateSchema = z.object({
  step: z.string().min(1).max(120).trim().optional(),
  path: z.string().max(500).trim().nullable().optional(),
  checklist_delta: z.record(z.string().min(1).max(120), z.unknown()).optional(),
  dismissed_forever: z.boolean().optional(),
}).strict().refine(
  (body) => body.step !== undefined
    || body.path !== undefined
    || body.checklist_delta !== undefined
    || body.dismissed_forever !== undefined,
  { message: 'At least one of step, path, checklist_delta, dismissed_forever is required' },
)

export function serializeOnboardingState(row) {
  if (!row) {
    return {
      step: DEFAULT_ONBOARDING_STATE.step,
      path: DEFAULT_ONBOARDING_STATE.path,
      checklist: {},
      dismissed_forever: DEFAULT_ONBOARDING_STATE.dismissed_forever,
    }
  }
  return {
    step: row.step || DEFAULT_ONBOARDING_STATE.step,
    path: row.path ?? null,
    checklist: row.checklist && typeof row.checklist === 'object' && !Array.isArray(row.checklist)
      ? row.checklist
      : {},
    dismissed_forever: Boolean(row.dismissed_forever),
  }
}

export async function getAgentOnboardingState(userId) {
  if (!userId) throw new Error('userId is required')
  const rows = await query(
    `SELECT user_id, step, path, checklist, dismissed_forever, updated_at
       FROM public.agent_onboarding_state
      WHERE user_id = $1`,
    [userId],
  )
  return serializeOnboardingState(rows[0] || null)
}

/**
 * Upsert onboarding state. Optional fields leave existing values unchanged.
 * checklist_delta is merged with Postgres JSONB || under the row lock so
 * concurrent PATCHes composing different keys do not clobber each other.
 */
export async function patchAgentOnboardingState(userId, {
  step,
  path,
  checklist_delta,
  dismissed_forever,
} = {}) {
  if (!userId) throw new Error('userId is required')

  const hasStep = step !== undefined
  const hasPath = path !== undefined
  const hasDismissed = dismissed_forever !== undefined
  const delta = checklist_delta && typeof checklist_delta === 'object' && !Array.isArray(checklist_delta)
    ? checklist_delta
    : {}

  const rows = await query(
    `INSERT INTO public.agent_onboarding_state AS s
       (user_id, step, path, checklist, dismissed_forever, updated_at)
     VALUES (
       $1,
       COALESCE($2, 'welcome'),
       $3,
       COALESCE($4::jsonb, '{}'::jsonb),
       COALESCE($5, false),
       CURRENT_TIMESTAMP
     )
     ON CONFLICT (user_id) DO UPDATE SET
       step = CASE WHEN $6::boolean THEN EXCLUDED.step ELSE s.step END,
       path = CASE WHEN $7::boolean THEN EXCLUDED.path ELSE s.path END,
       checklist = COALESCE(s.checklist, '{}'::jsonb) || COALESCE(EXCLUDED.checklist, '{}'::jsonb),
       dismissed_forever = CASE WHEN $8::boolean THEN EXCLUDED.dismissed_forever ELSE s.dismissed_forever END,
       updated_at = CURRENT_TIMESTAMP
     RETURNING user_id, step, path, checklist, dismissed_forever, updated_at`,
    [
      userId,
      hasStep ? step : null,
      hasPath ? path : null,
      JSON.stringify(delta),
      hasDismissed ? Boolean(dismissed_forever) : null,
      hasStep,
      hasPath,
      hasDismissed,
    ],
  )
  return serializeOnboardingState(rows[0])
}

export function registerRoutes(app, { auth = authMiddleware } = {}) {
  app.get('/api/user/onboarding-state', auth, async (req, res) => {
    try {
      const state = await getAgentOnboardingState(req.user.id)
      res.json(state)
    } catch (err) {
      logger.error({ err: err.message, user_id: req.user?.id }, 'get agent onboarding state failed')
      res.status(500).json({ error: 'Failed to load onboarding state' })
    }
  })

  app.patch(
    '/api/user/onboarding-state',
    auth,
    validate(patchAgentOnboardingStateSchema),
    async (req, res) => {
      try {
        const state = await patchAgentOnboardingState(req.user.id, req.validated)
        res.json(state)
      } catch (err) {
        logger.error({ err: err.message, user_id: req.user?.id }, 'patch agent onboarding state failed')
        res.status(500).json({ error: 'Failed to save onboarding state' })
      }
    },
  )
}
