/**
 * AGN-SET-006 — agency deletion routes.
 *
 * GET  /api/agencies/:id/deletion/state
 * POST /api/agencies/:id/deletion/regenerate-word
 * POST /api/agencies/:id/deletion/initiate
 * POST /api/agencies/:id/deletion/cancel
 */
import { z } from 'zod'
import { authMiddleware, requireElevated } from '../../auth.js'
import {
  AgencyDeletionError,
  cancelAgencyDeletion,
  getAgencyDeletionState,
  initiateAgencyDeletion,
  regenerateAgencyDeletionWord,
} from './agency-deletion.js'

const initiateSchema = z
  .object({
    word: z.string().min(3),
    typed_agency_name: z.string().min(1),
    reason: z.string().min(3),
    notes: z.string().optional(),
  })
  .strict()

function handleError(res, err) {
  if (err instanceof AgencyDeletionError) {
    const body = { error: err.message, code: err.code }
    return res.status(err.status).json(body)
  }
  throw err
}

export function registerAgencyDeletionRoutes(app, { auth = authMiddleware } = {}) {
  const elevated = requireElevated()

  app.get('/api/agencies/:id/deletion/state', auth, async (req, res, next) => {
    try {
      res.json(
        await getAgencyDeletionState({
          agencyId: req.params.id,
          callerUserId: req.user.id,
        }),
      )
    } catch (err) {
      try {
        handleError(res, err)
      } catch (e) {
        next(e)
      }
    }
  })

  app.post('/api/agencies/:id/deletion/regenerate-word', auth, async (req, res, next) => {
    try {
      res.json(
        await regenerateAgencyDeletionWord({
          agencyId: req.params.id,
          callerUserId: req.user.id,
        }),
      )
    } catch (err) {
      try {
        handleError(res, err)
      } catch (e) {
        next(e)
      }
    }
  })

  app.post('/api/agencies/:id/deletion/initiate', auth, elevated, async (req, res, next) => {
    try {
      const parsed = initiateSchema.safeParse(req.body || {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() })
      }
      const result = await initiateAgencyDeletion({
        agencyId: req.params.id,
        callerUserId: req.user.id,
        ...parsed.data,
      })
      res.status(201).json(result)
    } catch (err) {
      try {
        handleError(res, err)
      } catch (e) {
        next(e)
      }
    }
  })

  app.post('/api/agencies/:id/deletion/cancel', auth, elevated, async (req, res, next) => {
    try {
      res.json(
        await cancelAgencyDeletion({
          agencyId: req.params.id,
          callerUserId: req.user.id,
        }),
      )
    } catch (err) {
      try {
        handleError(res, err)
      } catch (e) {
        next(e)
      }
    }
  })
}

export { registerAgencyDeletionRoutes as registerRoutes }
