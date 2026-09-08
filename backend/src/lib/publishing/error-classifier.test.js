import { describe, expect, it } from 'vitest'
import {
  classifyProviderError,
  ERROR_CLASS,
  ERROR_CLASSES,
} from './error-classifier.js'

describe('classifyProviderError', () => {
  it('exports the six CHECK-constrained classes', () => {
    expect(ERROR_CLASSES).toEqual([
      'auth_expired',
      'portal_rules_violation',
      'portal_down',
      'quota_exceeded',
      'invalid_content',
      'unknown_error',
    ])
  })

  it('falls back to unknown_error for empty / opaque input', () => {
    expect(classifyProviderError(null)).toBe(ERROR_CLASS.UNKNOWN_ERROR)
    expect(classifyProviderError(undefined)).toBe(ERROR_CLASS.UNKNOWN_ERROR)
    expect(classifyProviderError('')).toBe(ERROR_CLASS.UNKNOWN_ERROR)
    expect(classifyProviderError({ message: 'something odd happened' })).toBe(ERROR_CLASS.UNKNOWN_ERROR)
  })

  it('classifies auth_expired from Meta 190 / token messages / codes', () => {
    expect(classifyProviderError({
      details: { error: { code: 190, message: 'Error validating access token', type: 'OAuthException' } },
    })).toBe(ERROR_CLASS.AUTH_EXPIRED)
    expect(classifyProviderError(Object.assign(new Error('Session has expired'), { code: 'TOKEN_EXPIRED' })))
      .toBe(ERROR_CLASS.AUTH_EXPIRED)
    expect(classifyProviderError({ code: 'MISSING_OAUTH_TOKEN', message: 'Complete OAuth' }))
      .toBe(ERROR_CLASS.AUTH_EXPIRED)
    expect(classifyProviderError({ status: 401, message: 'Unauthorized' }))
      .toBe(ERROR_CLASS.AUTH_EXPIRED)
  })

  it('classifies quota_exceeded from 429 / rate-limit copy', () => {
    expect(classifyProviderError({ status: 429, message: 'Too Many Requests' }))
      .toBe(ERROR_CLASS.QUOTA_EXCEEDED)
    expect(classifyProviderError({
      details: { error: { code: 4, message: 'Application request limit reached' } },
    })).toBe(ERROR_CLASS.QUOTA_EXCEEDED)
    expect(classifyProviderError({ code: 'RATE_LIMITED', message: 'throttled' }))
      .toBe(ERROR_CLASS.QUOTA_EXCEEDED)
  })

  it('classifies portal_down from 5xx / network failures', () => {
    expect(classifyProviderError({ status: 503, message: 'Service Unavailable' }))
      .toBe(ERROR_CLASS.PORTAL_DOWN)
    expect(classifyProviderError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })))
      .toBe(ERROR_CLASS.PORTAL_DOWN)
    expect(classifyProviderError('gateway timeout from upstream'))
      .toBe(ERROR_CLASS.PORTAL_DOWN)
  })

  it('classifies portal_rules_violation from policy language', () => {
    expect(classifyProviderError({
      message: 'This content violates Community Standards',
      code: 'POLICY_VIOLATION',
    })).toBe(ERROR_CLASS.PORTAL_RULES_VIOLATION)
    expect(classifyProviderError('Post restricted: spam detected'))
      .toBe(ERROR_CLASS.PORTAL_RULES_VIOLATION)
  })

  it('classifies invalid_content from missing media / validation', () => {
    expect(classifyProviderError({
      code: 'MISSING_MEDIA',
      message: 'Instagram publish requires at least one image or video',
    })).toBe(ERROR_CLASS.INVALID_CONTENT)
    expect(classifyProviderError({ status: 400, message: 'invalid image format / aspect ratio' }))
      .toBe(ERROR_CLASS.INVALID_CONTENT)
    expect(classifyProviderError({ code: 'MISSING_CONTENT', message: 'text is required' }))
      .toBe(ERROR_CLASS.INVALID_CONTENT)
  })

  it('honours an already-normalized error_class code', () => {
    expect(classifyProviderError({ code: 'auth_expired' })).toBe(ERROR_CLASS.AUTH_EXPIRED)
    expect(classifyProviderError({ code: 'PORTAL_DOWN' })).toBe(ERROR_CLASS.PORTAL_DOWN)
  })
})
