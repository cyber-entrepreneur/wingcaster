/**
 * Fast unit tests for publishing job aggregate / status / retry helpers.
 */
import { describe, expect, it } from 'vitest'
import {
  computeAggregate,
  isRetryAvailable,
  mapDestinationStatus,
  RETRYABLE_ERROR_CLASSES,
  toApiErrorClass,
  toDbErrorClass,
} from './jobs.js'
import { templateCodeForAggregate, buildDeepLink, buildWebPath } from './notify-job-completed.js'
import { PUBLISHING_JOB_AGGREGATION_SQL } from './jobs.js'

describe('publishing job aggregate mapping', () => {
  it('maps all succeeded', () => {
    expect(computeAggregate({ succeeded: 3, in_review: 0, failed: 0, total: 3 })).toBe('all_succeeded')
  })

  it('maps all failed', () => {
    expect(computeAggregate({ succeeded: 0, in_review: 0, failed: 2, total: 2 })).toBe('all_failed')
  })

  it('maps in_review_only', () => {
    expect(computeAggregate({ succeeded: 0, in_review: 4, failed: 0, total: 4 })).toBe('in_review_only')
  })

  it('maps partial (success + in_review, no fail)', () => {
    expect(computeAggregate({ succeeded: 2, in_review: 1, failed: 0, total: 3 })).toBe('partial')
  })

  it('maps mixed when any failure accompanies other outcomes', () => {
    expect(computeAggregate({ succeeded: 1, in_review: 0, failed: 1, total: 2 })).toBe('mixed')
    expect(computeAggregate({ succeeded: 1, in_review: 1, failed: 1, total: 3 })).toBe('mixed')
  })
})

describe('destination status + error_class mapping', () => {
  it('prefers attempt status over job status', () => {
    expect(mapDestinationStatus('pending', 'published')).toBe('succeeded')
    expect(mapDestinationStatus('published', 'failed')).toBe('failed')
    expect(mapDestinationStatus('pending', 'in_review')).toBe('in_review')
    expect(mapDestinationStatus('pending_retry', null)).toBe('failed')
  })

  it('round-trips snake_case DB ↔ UPPER_SNAKE API', () => {
    expect(toApiErrorClass('portal_down')).toBe('PORTAL_DOWN')
    expect(toApiErrorClass('auth_expired')).toBe('AUTH_EXPIRED')
    expect(toDbErrorClass('PORTAL_DOWN')).toBe('portal_down')
    expect(toDbErrorClass('unknown-error')).toBe('unknown_error')
  })

  it('retry_available only for failed + transient classes', () => {
    expect(isRetryAvailable('failed', 'portal_down')).toBe(true)
    expect(isRetryAvailable('failed', 'UNKNOWN_ERROR')).toBe(true)
    expect(isRetryAvailable('failed', 'auth_expired')).toBe(false)
    expect(isRetryAvailable('succeeded', 'portal_down')).toBe(false)
    expect(RETRYABLE_ERROR_CLASSES).toEqual(['PORTAL_DOWN', 'UNKNOWN_ERROR'])
  })
})

describe('notify helpers', () => {
  it('picks template code by aggregate', () => {
    expect(templateCodeForAggregate('all_succeeded')).toBe('publishing_job.completed.all_succeeded')
    expect(templateCodeForAggregate('mixed')).toBe('publishing_job.completed.mixed')
    expect(templateCodeForAggregate('all_failed')).toBe('publishing_job.completed.all_failed')
    expect(templateCodeForAggregate('in_review_only')).toBe('publishing_job.completed.in_review_only')
    expect(templateCodeForAggregate('partial')).toBe('publishing_job.completed.partial')
  })

  it('builds deep links', () => {
    expect(buildDeepLink('job_1')).toBe('wingcaster://publish-receipt/job_1')
    expect(buildWebPath('job_1')).toBe('/publish/receipts/job_1')
  })
})

describe('N+1 guard (SQL shape)', () => {
  it('aggregation SQL uses JOINs / CTEs and does not imply per-row loops', () => {
    const sql = PUBLISHING_JOB_AGGREGATION_SQL
    expect(sql).toMatch(/WITH\s+scoped_jobs/i)
    expect(sql).toMatch(/LEFT JOIN public\.portal_registry/i)
    expect(sql).toMatch(/LEFT JOIN latest_attempt/i)
    expect(sql).toMatch(/credit_consumptions|credit_reservations/i)
    // Must not be a template that embeds a JS loop placeholder.
    expect(sql).not.toMatch(/\$\{portal/)
    expect(sql).not.toMatch(/FOR\s+EACH/i)
  })
})
