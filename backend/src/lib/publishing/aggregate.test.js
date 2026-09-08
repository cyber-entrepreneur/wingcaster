import { describe, expect, it } from 'vitest'
import {
  computeAggregate,
  DESTINATION_STATUS,
  filterRetryableDestinations,
  isRetryAvailable,
  JOB_AGGREGATE,
  mapDestinationStatus,
  RETRYABLE_ERROR_CLASSES,
  toApiErrorClass,
  toDbErrorClass,
} from './aggregate.js'

describe('toApiErrorClass / toDbErrorClass', () => {
  it('maps DB snake_case to uppercase JSON form', () => {
    expect(toApiErrorClass('auth_expired')).toBe('AUTH_EXPIRED')
    expect(toApiErrorClass('portal_down')).toBe('PORTAL_DOWN')
    expect(toApiErrorClass('unknown_error')).toBe('UNKNOWN_ERROR')
    expect(toApiErrorClass(null)).toBe(null)
  })

  it('maps API uppercase back to DB snake_case', () => {
    expect(toDbErrorClass('PORTAL_DOWN')).toBe('portal_down')
    expect(toDbErrorClass('AUTH_EXPIRED')).toBe('auth_expired')
  })
})

describe('mapDestinationStatus', () => {
  it('maps published/success to succeeded', () => {
    expect(mapDestinationStatus('published', null)).toBe(DESTINATION_STATUS.SUCCEEDED)
    expect(mapDestinationStatus('pending', 'published')).toBe(DESTINATION_STATUS.SUCCEEDED)
  })

  it('maps failed to failed', () => {
    expect(mapDestinationStatus('failed', null)).toBe(DESTINATION_STATUS.FAILED)
    expect(mapDestinationStatus('pending', 'failed')).toBe(DESTINATION_STATUS.FAILED)
  })

  it('maps submitted / pending_review to in_review', () => {
    expect(mapDestinationStatus('submitted', null)).toBe(DESTINATION_STATUS.IN_REVIEW)
    expect(mapDestinationStatus('pending_review', null)).toBe(DESTINATION_STATUS.IN_REVIEW)
  })
})

describe('computeAggregate', () => {
  it('all succeeded, none in_review, none failed → all_succeeded', () => {
    expect(computeAggregate(['succeeded', 'succeeded'])).toBe(JOB_AGGREGATE.ALL_SUCCEEDED)
  })

  it('all failed → all_failed', () => {
    expect(computeAggregate(['failed'])).toBe(JOB_AGGREGATE.ALL_FAILED)
    expect(computeAggregate(['failed', 'failed', 'failed'])).toBe(JOB_AGGREGATE.ALL_FAILED)
  })

  it('only in_review (no success, no fail) → in_review_only', () => {
    expect(computeAggregate(['in_review', 'in_review'])).toBe(JOB_AGGREGATE.IN_REVIEW_ONLY)
  })

  it('some succeeded + some in_review, none failed → partial', () => {
    expect(computeAggregate(['succeeded', 'in_review'])).toBe(JOB_AGGREGATE.PARTIAL)
    expect(computeAggregate(['succeeded', 'succeeded', 'in_review'])).toBe(JOB_AGGREGATE.PARTIAL)
  })

  it('mix of fail + anything → mixed', () => {
    expect(computeAggregate(['succeeded', 'failed'])).toBe(JOB_AGGREGATE.MIXED)
    expect(computeAggregate(['failed', 'in_review'])).toBe(JOB_AGGREGATE.MIXED)
    expect(computeAggregate(['succeeded', 'failed', 'in_review'])).toBe(JOB_AGGREGATE.MIXED)
  })
})

describe('retry_available + retry-all class filter', () => {
  it('is true only for failed PORTAL_DOWN / UNKNOWN_ERROR', () => {
    expect(isRetryAvailable('failed', 'PORTAL_DOWN')).toBe(true)
    expect(isRetryAvailable('failed', 'UNKNOWN_ERROR')).toBe(true)
    expect(isRetryAvailable('failed', 'AUTH_EXPIRED')).toBe(false)
    expect(isRetryAvailable('succeeded', 'PORTAL_DOWN')).toBe(false)
    expect(isRetryAvailable('in_review', 'UNKNOWN_ERROR')).toBe(false)
  })

  it('retry-all keeps only matching failed retryable classes', () => {
    const dests = [
      { id: '1', status: 'failed', error_class: 'PORTAL_DOWN', retry_available: true },
      { id: '2', status: 'failed', error_class: 'AUTH_EXPIRED', retry_available: false },
      { id: '3', status: 'failed', error_class: 'UNKNOWN_ERROR', retry_available: true },
      { id: '4', status: 'succeeded', error_class: null, retry_available: false },
      { id: '5', status: 'failed', error_class: 'QUOTA_EXCEEDED', retry_available: false },
    ]
    const filtered = filterRetryableDestinations(dests, ['PORTAL_DOWN', 'UNKNOWN_ERROR'])
    expect(filtered.map((d) => d.id)).toEqual(['1', '3'])
  })

  it('retry-all with AUTH_EXPIRED in the body still does not retry it', () => {
    const dests = [
      { id: '1', status: 'failed', error_class: 'AUTH_EXPIRED', retry_available: false },
      { id: '2', status: 'failed', error_class: 'PORTAL_DOWN', retry_available: true },
    ]
    const filtered = filterRetryableDestinations(dests, ['AUTH_EXPIRED', 'PORTAL_DOWN'])
    expect(filtered.map((d) => d.id)).toEqual(['2'])
  })

  it('defaults the retry class list to PORTAL_DOWN and UNKNOWN_ERROR', () => {
    expect(RETRYABLE_ERROR_CLASSES).toEqual(['PORTAL_DOWN', 'UNKNOWN_ERROR'])
    const dests = [
      { id: '1', status: 'failed', error_class: 'PORTAL_DOWN' },
      { id: '2', status: 'failed', error_class: 'INVALID_CONTENT' },
    ]
    expect(filterRetryableDestinations(dests).map((d) => d.id)).toEqual(['1'])
  })
})
