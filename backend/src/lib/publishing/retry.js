/**
 * Retry a publishing destination: enqueue a new distribution_attempts row,
 * bump retry_count, and call the portal publish path when one exists.
 *
 * PF / real-estate adapters are currently stubs (Agent 1). NOT_IMPLEMENTED
 * is recorded as a queued pending_retry attempt rather than a hard failure.
 */

import { query } from '../../db.js'
import { recordDistributionAttempt } from './record-attempt.js'
import { isRetryAvailable } from './aggregate.js'
import { loadPublishingJobPayload } from './job-query.js'
import logger from '../logger.js'

export class PublishingRetryError extends Error {
  constructor(message, { status = 409, code = 'NOT_RETRYABLE', extra = {} } = {}) {
    super(message)
    this.name = 'PublishingRetryError'
    this.status = status
    this.code = code
    this.extra = extra
  }
}

async function tryPortalPublish(platform, listing, agentContext) {
  if (!platform) return { skipped: true, reason: 'no_platform' }
  try {
    const { publishToRealEstatePortal } = await import('../notifications/realestate.js')
    const result = await publishToRealEstatePortal(platform, {
      listing: listing || {},
      agentContext,
      creditContext: { skipMetering: true, tenantId: agentContext?.tenantId || null },
    })
    return { ok: true, result }
  } catch (err) {
    const code = err?.code || ''
    if (code === 'NOT_IMPLEMENTED' || code === 'PORTAL_NOT_SUPPORTED') {
      return { skipped: true, reason: code, error: err }
    }
    return { ok: false, error: err }
  }
}

async function loadListing(propertyId) {
  if (!propertyId) return null
  const rows = await query(
    `SELECT id, title, description, city, status, data, canonical_id
       FROM public.properties WHERE id = $1`,
    [propertyId],
  )
  return rows[0] || null
}

/**
 * Re-attempt one destination. Throws PublishingRetryError on 404/409.
 * @returns {Promise<object>} updated destination row (from a fresh job load)
 */
export async function retryDestination({
  jobId,
  destinationId,
  agentId,
  agencyId = null,
  creditTenantId = null,
  userId = null,
} = {}) {
  const payload = await loadPublishingJobPayload({
    jobId, agentId, agencyId, creditTenantId,
  })
  if (!payload) {
    throw new PublishingRetryError('Not found', { status: 404, code: 'NOT_FOUND' })
  }
  const dest = payload.destinations.find((d) => d.id === destinationId)
  if (!dest) {
    throw new PublishingRetryError('Not found', { status: 404, code: 'NOT_FOUND' })
  }
  if (!isRetryAvailable(dest.status, dest.error_class)) {
    throw new PublishingRetryError('Destination is not retryable', {
      status: 409,
      code: 'NOT_RETRYABLE',
      extra: { error_class: dest.error_class },
    })
  }

  const listing = await loadListing(payload.job.listing_id)
  const publish = await tryPortalPublish(dest.portal?.code, listing, {
    tenantId: creditTenantId,
    agentId,
    userId,
  })

  await query(
    `UPDATE public.distribution_jobs
        SET retry_count = COALESCE(retry_count, 0) + 1,
            status = CASE
              WHEN $2::text = 'published' THEN 'published'
              WHEN $2::text = 'failed' THEN 'failed'
              ELSE 'pending_retry'
            END,
            published_at = CASE WHEN $2::text = 'published' THEN NOW() ELSE published_at END,
            error_message = CASE WHEN $2::text = 'failed' THEN $3 ELSE error_message END,
            updated_at = NOW()
      WHERE id = $1`,
    [
      destinationId,
      publish.ok ? 'published' : (publish.skipped ? 'pending_retry' : 'failed'),
      publish.error?.message || null,
    ],
  )

  if (publish.ok) {
    await recordDistributionAttempt({
      distributionJobId: destinationId,
      status: 'published',
      response: publish.result || { retried: true },
    })
  } else if (publish.skipped) {
    await recordDistributionAttempt({
      distributionJobId: destinationId,
      status: 'pending_retry',
      extra: { queued: true, retry: true, reason: publish.reason || 'queued' },
    })
  } else {
    await recordDistributionAttempt({
      distributionJobId: destinationId,
      status: 'failed',
      error: publish.error,
    })
  }

  const updated = await loadPublishingJobPayload({
    jobId, agentId, agencyId, creditTenantId,
  })
  const updatedDest = updated?.destinations?.find((d) => d.id === destinationId)
  if (!updatedDest) {
    throw new PublishingRetryError('Not found', { status: 404, code: 'NOT_FOUND' })
  }
  return { destination: updatedDest, job: updated }
}

/**
 * Retry every matching failed destination. Returns the full updated job payload.
 */
export async function retryAllDestinations({
  jobId,
  agentId,
  agencyId = null,
  creditTenantId = null,
  userId = null,
  destinationsToRetry = [],
} = {}) {
  const payload = await loadPublishingJobPayload({
    jobId, agentId, agencyId, creditTenantId,
  })
  if (!payload) {
    throw new PublishingRetryError('Not found', { status: 404, code: 'NOT_FOUND' })
  }

  for (const dest of destinationsToRetry) {
    try {
      await retryDestination({
        jobId,
        destinationId: dest.id,
        agentId,
        agencyId,
        creditTenantId,
        userId,
      })
    } catch (err) {
      if (err instanceof PublishingRetryError && err.status === 409) continue
      logger.warn(
        { err: err.message, destination_id: dest.id, job_id: jobId },
        'publishing retry-all skipped a destination',
      )
    }
  }

  const updated = await loadPublishingJobPayload({
    jobId, agentId, agencyId, creditTenantId,
  })
  if (!updated) {
    throw new PublishingRetryError('Not found', { status: 404, code: 'NOT_FOUND' })
  }
  return updated
}
