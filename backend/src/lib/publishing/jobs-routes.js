/**
 * Publishing job receipt + retry routes (BE-BLOCKER-10 / AGT-PUB-003).
 *
 *   GET  /api/publishing/jobs/:jobId
 *   POST /api/publishing/jobs/:jobId/destinations/:destinationId/retry
 *   POST /api/publishing/jobs/:jobId/retry-all
 *
 * Auth: caller must own the job (agent_id) or share agency_id.
 * Unauthorized / other-tenant → 404 (leak-safe).
 */

import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { query } from '../../db.js'
import { validate } from '../validation.js'
import logger from '../logger.js'
import {
  getPublishingJob,
  maybeCompletePublishingJob,
  RETRYABLE_ERROR_CLASSES,
  retryAllPublishingDestinations,
  retryPublishingDestination,
  toApiErrorClass,
} from './jobs.js'
import { emitPublishingJobCompleted } from './notify-job-completed.js'

const retryAllSchema = z.object({
  error_classes_to_retry: z
    .array(z.string().min(1).max(64))
    .min(1)
    .max(12)
    .optional(),
}).strict()

async function resolveCallerScope(userId) {
  const agentId = userId
  const rows = await query(
    `SELECT agency_id
       FROM public.agency_members
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1`,
    [userId],
  )
  return { agentId, agencyId: rows[0]?.agency_id || null }
}

function sendJobError(res, err) {
  const status = Number(err.status || err.statusCode || 500)
  if (status === 404) return res.status(404).json({ error: 'Not found' })
  if (status === 409) {
    return res.status(409).json({
      error: err.message || 'Conflict',
      code: err.code || 'CONFLICT',
      error_class: err.error_class || null,
    })
  }
  logger.error({ err }, 'publishing jobs route error')
  return res.status(500).json({ error: 'Internal server error' })
}

async function afterMutationNotify(jobPayload) {
  if (!jobPayload?.job) return
  const { job } = jobPayload
  if (job.aggregate === 'in_review_only' || job.aggregate === 'partial') return
  try {
    await maybeCompletePublishingJob(job.id, job.aggregate)
    await emitPublishingJobCompleted(job.id, { payload: jobPayload })
  } catch (err) {
    logger.warn({ err: err?.message || String(err), jobId: job.id }, 'publishing_job.completed notify skipped')
  }
}

export function registerRoutes(app, { authMiddleware: auth = authMiddleware } = {}) {
  app.get('/api/publishing/jobs/:jobId', auth, async (req, res) => {
    try {
      const { agentId, agencyId } = await resolveCallerScope(req.user.id)
      const payload = await getPublishingJob({
        jobId: req.params.jobId,
        agentId,
        agencyId,
      })
      if (!payload) return res.status(404).json({ error: 'Not found' })
      return res.json(payload)
    } catch (err) {
      return sendJobError(res, err)
    }
  })

  app.post(
    '/api/publishing/jobs/:jobId/destinations/:destinationId/retry',
    auth,
    async (req, res) => {
      try {
        const { agentId, agencyId } = await resolveCallerScope(req.user.id)
        const result = await retryPublishingDestination({
          jobId: req.params.jobId,
          destinationId: req.params.destinationId,
          agentId,
          agencyId,
        })
        await afterMutationNotify(result.job)
        return res.json({
          destination: result.destination,
          job: result.job?.job || null,
          destinations: result.job?.destinations || [],
        })
      } catch (err) {
        return sendJobError(res, err)
      }
    },
  )

  app.post(
    '/api/publishing/jobs/:jobId/retry-all',
    auth,
    validate(retryAllSchema),
    async (req, res) => {
      try {
        const { agentId, agencyId } = await resolveCallerScope(req.user.id)
        const classes = (req.body?.error_classes_to_retry || RETRYABLE_ERROR_CLASSES)
          .map((c) => toApiErrorClass(c))
        const result = await retryAllPublishingDestinations({
          jobId: req.params.jobId,
          agentId,
          agencyId,
          errorClassesToRetry: classes,
        })
        await afterMutationNotify(result)
        return res.json(result)
      } catch (err) {
        return sendJobError(res, err)
      }
    },
  )
}

export default { registerRoutes }
