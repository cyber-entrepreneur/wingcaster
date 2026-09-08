import { describe, expect, it } from 'vitest'
import {
  computeAggregate,
  countDestinations,
  errorClassToApi,
  errorClassToDb,
  filterRetryableDestinations,
  JOB_AGGREGATE,
  mapDestinationStatus,
  retryAvailable,
  RETRYABLE_ERROR_CLASSES,
} from './aggregate.js'

describe('errorClass mapping', () => {
  it('maps DB snake_case to API uppercase and back', () => {
    expect(errorClassToApi('auth_expired')).toBe('AUTH_EXPIRED')
    expect(errorClassToApi('portal_down')).toBe('PORTAL_DOWN')
    expect(errorClassToDb('PORTAL_DOWN')).toBe('portal_down')
    expect(errorClassToApi(null)).toBe(null)
  })
})

describe('mapDestinationStatus', () => {
  it('treats published attempts as succeeded', () => {
    expect(mapDestinationStatus({ jobStatus: 'pending', attemptStatus: 'published' })).toBe('succeeded')
  })
  it('treats failed / pending_retry as failed', () => {
    expect(mapDestinationStatus({ jobStatus: 'pending_retry', attemptStatus: 'failed' })).toBe('failed')
    expect(mapDestinationStatus({ jobStatus: 'failed', attemptStatus: null })).toBe('failed')
  })
  it('treats submitted / queued as in_review', () => {
    expect(mapDestinationStatus({ jobStatus: 'submitted', attemptStatus: null })).toBe('in_review')
  })
})

describe('computeAggregate', () => {
  it('all succeeded, none in_review, none failed → all_succeeded', () => {
    expect(computeAggregate({ succeeded: 3, in_review: 0, failed: 0, total: 3 }))
      .toBe(JOB_AGGREGATE.ALL_SUCCEEDED)
  })
  it('all failed → all_failed', () => {
    expect(computeAggregate({ succeeded: 0, in_review: 0, failed: 2, total: 2 }))
      .toBe(JOB_AGGREGATE.ALL_FAILED)
  })
  it('only in_review (no success, no fail) → in_review_only', () => {
    expect(computeAggregate({ succeeded: 0, in_review: 4, failed: 0, total: 4 }))
      .toBe(JOB_AGGREGATE.IN_REVIEW_ONLY)
  })
  it('some succeeded + some in_review, none failed → partial', () => {
    expect(computeAggregate({ succeeded: 2, in_review: 1, failed: 0, total: 3 }))
      .toBe(JOB_AGGREGATE.PARTIAL)
  })
  it('mix of fail + anything → mixed', () => {
    expect(computeAggregate({ succeeded: 1, in_review: 0, failed: 1, total: 2 }))
      .toBe(JOB_AGGREGATE.MIXED)
    expect(computeAggregate({ succeeded: 1, in_review: 1, failed: 1, total: 3 }))
      .toBe(JOB_AGGREGATE.MIXED)
    expect(computeAggregate({ succeeded: 0, in_review: 1, failed: 2, total: 3 }))
      .toBe(JOB_AGGREGATE.MIXED)
  })
})

describe('retry_available + retry-all filter', () => {
  it('is true only for failed + PORTAL_DOWN / UNKNOWN_ERROR', () => {
    expect(retryAvailable({ status: 'failed', errorClass: 'PORTAL_DOWN' })).toBe(true)
    expect(retryAvailable({ status: 'failed', error_class: 'unknown_error' })).toBe(true)
    expect(retryAvailable({ status: 'failed', errorClass: 'AUTH_EXPIRED' })).toBe(false)
    expect(retryAvailable({ status: 'succeeded', errorClass: 'PORTAL_DOWN' })).toBe(false)
    expect(RETRYABLE_ERROR_CLASSES).toEqual(['PORTAL_DOWN', 'UNKNOWN_ERROR'])
  })

  it('retry-all keeps matching failed transient classes only', () => {
    const destinations = [
      { id: 'a', status: 'failed', error_class: 'PORTAL_DOWN' },
      { id: 'b', status: 'failed', error_class: 'UNKNOWN_ERROR' },
      { id: 'c', status: 'failed', error_class: 'AUTH_EXPIRED' },
      { id: 'd', status: 'succeeded', error_class: null },
      { id: 'e', status: 'in_review', error_class: null },
    ]
    expect(filterRetryableDestinations(destinations, ['PORTAL_DOWN', 'UNKNOWN_ERROR']).map((d) => d.id))
      .toEqual(['a', 'b'])
    expect(filterRetryableDestinations(destinations, ['PORTAL_DOWN']).map((d) => d.id))
      .toEqual(['a'])
    expect(filterRetryableDestinations(destinations, ['AUTH_EXPIRED']).map((d) => d.id))
      .toEqual([])
  })

  it('countDestinations feeds computeAggregate', () => {
    const counts = countDestinations([
      { status: 'succeeded' },
      { status: 'failed' },
      { status: 'in_review' },
    ])
    expect(counts).toEqual({ succeeded: 1, in_review: 1, failed: 1, total: 3 })
    expect(computeAggregate(counts)).toBe(JOB_AGGREGATE.MIXED)
  })
})
