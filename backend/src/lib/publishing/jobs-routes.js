/**
 * Publishing job aggregation + retry HTTP surface (BE-BLOCKER-10 / AGT-PUB-003).
 *
 *   GET  /api/publishing/jobs/:jobId
 *   POST /api/publishing/jobs/:jobId/destinations/:destinationId/retry
 *   POST /api/publishing/jobs/:jobId/retry-all
 *
 * Other users → 404 (not 403). Auth required.
 */

import logger from '../logger.js'
import {
  filterRetryableDestinations,
  RETRYABLE_ERROR_CLASSES,
} from './aggregate.js'
import { loadPublishingJobPayload } from './job-payload.js'
import {
  PublishingRetryError,
  retryPublishingDestination,
  retryPublishingDestinations,
} from './retry-destination.js'
import { emitPublishingJobCompleted } from './notify-job-completed.js'

function notFound(res) {
  return res.status(404).json({ error: 'Not found' })
}

function callerId(req) {
  return req.user?.id || req.agent?.id || req.user?.agent_id || null
}

function parseRetryClasses(body) {
  const raw = body?.error_classes_to_retry
  if (raw == null) return [...RETRYABLE_ERROR_CLASSES]
  if (!Array.isArray(raw)) {
    const err = new Error('error_classes_to_retry must be an array')
    err.status = 400
    err.code = 'INVALID_BODY'
    throw err
  }
  return raw.map((v) => String(v || '').trim()).filter(Boolean)
}

/**
 * @param {import('express').Application} app
 * @param {{ authMiddleware: Function }} deps
 */
export function registerRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) {
    throw new Error('registerRoutes requires authMiddleware')
  }

  app.get('/api/publishing/jobs/:jobId', authMiddleware, async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const payload = await loadPublishingJobPayload(req.params.jobId, callerId(req))
      if (!payload) return notFound(res)
      return res.json(payload)
    } catch (err) {
      logger.error({ err: err.message, job_id: req.params.jobId, user_id: req.user?.id }, 'get publishing job failed')
      return res.status(500).json({ error: 'Failed to load publishing job' })
    }
  })

  app.post(
    '/api/publishing/jobs/:jobId/destinations/:destinationId/retry',
    authMiddleware,
    async (req, res) => {
      if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
      const { jobId, destinationId } = req.params
      try {
        await retryPublishingDestination({
          jobId,
          destinationId,
          callerUserId: callerId(req),
          source: 'manual_single',
        })
        const payload = await loadPublishingJobPayload(jobId, callerId(req))
        if (!payload) return notFound(res)
        emitPublishingJobCompleted(payload.job.id).catch((err) => {
          logger.warn({ err: err.message, job_id: jobId }, 'emitPublishingJobCompleted after retry failed')
        })
        const destination = payload.destinations.find((d) => d.id === destinationId)
        if (!destination) return notFound(res)
        return res.json(destination)
      } catch (err) {
        if (err instanceof PublishingRetryError || err.status === 404 || err.status === 409) {
          return res.status(err.status || 404).json({
            error: err.message,
            code: err.code || 'RETRY_FAILED',
            ...(err.extra || {}),
          })
        }
        logger.error(
          { err: err.message, job_id: jobId, destination_id: destinationId, user_id: req.user?.id },
          'retry publishing destination failed',
        )
        return res.status(500).json({ error: 'Failed to retry destination' })
      }
    },
  )

  app.post('/api/publishing/jobs/:jobId/retry-all', authMiddleware, async (req, res) => {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
    const { jobId } = req.params
    try {
      const classes = parseRetryClasses(req.body)
      const current = await loadPublishingJobPayload(jobId, callerId(req))
      if (!current) return notFound(res)
      const targets = filterRetryableDestinations(current.destinations, classes)
      await retryPublishingDestinations({
        jobId,
        destinationIds: targets.map((d) => d.id),
        callerUserId: callerId(req),
        source: 'manual_retry_all',
      })
      const payload = await loadPublishingJobPayload(jobId, callerId(req))
      if (!payload) return notFound(res)
      emitPublishingJobCompleted(payload.job.id).catch((err) => {
        logger.warn({ err: err.message, job_id: jobId }, 'emitPublishingJobCompleted after retry-all failed')
      })
      return res.json(payload)
    } catch (err) {
      if (err.status === 400) {
        return res.status(400).json({ error: err.message, code: err.code || 'INVALID_BODY' })
      }
      if (err instanceof PublishingRetryError || err.status === 404 || err.status === 409) {
        return res.status(err.status || 404).json({
          error: err.message,
          code: err.code || 'RETRY_FAILED',
          ...(err.extra || {}),
        })
      }
      logger.error({ err: err.message, job_id: jobId, user_id: req.user?.id }, 'retry-all publishing job failed')
      return res.status(500).json({ error: 'Failed to retry destinations' })
    }
  })
}

export default { registerRoutes }
