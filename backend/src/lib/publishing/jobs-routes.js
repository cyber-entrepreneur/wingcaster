/**
 * GET  /api/publishing/jobs/:jobId
 * POST /api/publishing/jobs/:jobId/destinations/:destinationId/retry
 * POST /api/publishing/jobs/:jobId/retry-all
 *
 * Auth required. Other users → 404 (not 403).
 */

import { z } from 'zod'
import { validate } from '../validation.js'
import { resolveRequestCreditTenant } from '../credits/tenant-context.js'
import logger from '../logger.js'
import { filterRetryableDestinations } from './aggregate.js'
import { loadPublishingJob } from './job-query.js'
import { PublishingRetryError, retryAllDestinations, retryDestination } from './retry.js'
import { maybeEmitPublishingJobCompleted } from './notify-job-completed.js'

const retryAllSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    error_classes_to_retry: z.array(z.string().min(1).max(80)).max(20).optional(),
  }).strict(),
)

function notFound(res) {
  return res.status(404).json({ error: 'Not found' })
}

function callerScope(req) {
  const agentId = req.agent?.id || req.user?.agent_id || null
  const agencyId = req.agent?.agency_id || null
  const tenant = resolveRequestCreditTenant(req)
  return {
    agentId,
    agencyId,
    creditTenantId: tenant?.creditTenantId || null,
    userId: req.user?.id || null,
  }
}

function publicJobPayload(payload) {
  if (!payload) return payload
  const { agent_id: _a, agency_id: _g, is_legacy: _l, ...job } = payload.job
  return { job, destinations: payload.destinations }
}

async function loadForRequest(req, jobId) {
  const scope = callerScope(req)
  if (!scope.agentId) return null
  const result = await loadPublishingJob({
    jobId,
    agentId: scope.agentId,
    agencyId: scope.agencyId,
    creditTenantId: scope.creditTenantId,
  })
  return result
}

/**
 * @param {import('express').Application} app
 * @param {{ authMiddleware: Function, loadJob?: Function }} deps
 */
export function registerRoutes(app, { authMiddleware, loadJob } = {}) {
  if (!authMiddleware) {
    throw new Error('registerRoutes requires authMiddleware')
  }
  const load = loadJob || loadForRequest

  app.get('/api/publishing/jobs/:jobId', authMiddleware, async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const result = await load(req, req.params.jobId)
      if (!result) return notFound(res)
      return res.json(publicJobPayload(result.payload))
    } catch (err) {
      logger.error({ err: err.message, job_id: req.params.jobId, user_id: req.user?.id }, 'GET publishing job failed')
      return res.status(500).json({ error: 'Failed to load publishing job' })
    }
  })

  app.post(
    '/api/publishing/jobs/:jobId/destinations/:destinationId/retry',
    authMiddleware,
    async (req, res) => {
      if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
      const scope = callerScope(req)
      if (!scope.agentId) return notFound(res)
      try {
        const { destination, job } = await retryDestination({
          jobId: req.params.jobId,
          destinationId: req.params.destinationId,
          ...scope,
        })
        maybeEmitPublishingJobCompleted(job.job.id, { payload: job, userId: scope.userId })
          .catch((err) => logger.warn({ err: err.message }, 'publishing completed notify failed'))
        return res.json(destination)
      } catch (err) {
        if (err instanceof PublishingRetryError) {
          if (err.status === 404) return notFound(res)
          return res.status(err.status).json({
            error: err.message,
            code: err.code,
            ...err.extra,
          })
        }
        logger.error(
          { err: err.message, job_id: req.params.jobId, destination_id: req.params.destinationId },
          'POST publishing destination retry failed',
        )
        return res.status(500).json({ error: 'Failed to retry destination' })
      }
    },
  )

  app.post(
    '/api/publishing/jobs/:jobId/retry-all',
    authMiddleware,
    validate(retryAllSchema),
    async (req, res) => {
      if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
      const scope = callerScope(req)
      if (!scope.agentId) return notFound(res)
      try {
        const loaded = await load(req, req.params.jobId)
        if (!loaded) return notFound(res)
        const classes = req.validated?.error_classes_to_retry
        const destinationsToRetry = filterRetryableDestinations(loaded.payload.destinations, classes)
        const updated = await retryAllDestinations({
          jobId: req.params.jobId,
          destinationsToRetry,
          ...scope,
        })
        maybeEmitPublishingJobCompleted(updated.job.id, { payload: updated, userId: scope.userId })
          .catch((err) => logger.warn({ err: err.message }, 'publishing completed notify failed'))
        return res.json(publicJobPayload(updated))
      } catch (err) {
        if (err instanceof PublishingRetryError) {
          if (err.status === 404) return notFound(res)
          return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra })
        }
        logger.error(
          { err: err.message, job_id: req.params.jobId },
          'POST publishing retry-all failed',
        )
        return res.status(500).json({ error: 'Failed to retry publishing job' })
      }
    },
  )
}

export { registerRoutes as registerPublishingJobRoutes }
