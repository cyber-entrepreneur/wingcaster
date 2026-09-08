// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  ERROR_CLASS_FIX_COPY,
  ERROR_CLASS_ICON,
  ERROR_CLASS_LABEL,
  PORTAL_ERROR_CLASSES,
  defaultFixDeepLink,
  isBulkRetryable,
} from '@/components/portals/failureClasses'

/**
 * Colocated failure-class contract tests (AGT-PUB-003 §Error-class map).
 * Kept separate so Agents 2/6 can import the same module without pulling page tests.
 */
describe('portals/failureClasses contract', () => {
  it('enumerates exactly the 6 BE-BLOCKER-03 classes', () => {
    expect([...PORTAL_ERROR_CLASSES].sort()).toEqual(
      [
        'AUTH_EXPIRED',
        'INVALID_CONTENT',
        'PORTAL_DOWN',
        'PORTAL_RULES_VIOLATION',
        'QUOTA_EXCEEDED',
        'UNKNOWN_ERROR',
      ].sort(),
    )
  })

  it('pairs every class with glyph + brief label', () => {
    expect(ERROR_CLASS_LABEL).toEqual({
      AUTH_EXPIRED: 'Auth expired',
      PORTAL_RULES_VIOLATION: 'Portal rules',
      PORTAL_DOWN: 'Portal down',
      QUOTA_EXCEEDED: 'Quota exceeded',
      INVALID_CONTENT: 'Content rejected',
      UNKNOWN_ERROR: 'Unknown error',
    })
    for (const cls of PORTAL_ERROR_CLASSES) {
      expect(typeof ERROR_CLASS_ICON[cls]).toBe('object')
    }
  })

  it('resolution deep links match brief table', () => {
    expect(defaultFixDeepLink('AUTH_EXPIRED', { portalCode: 'pf' })).toMatch(
      /\/settings\/channels\?portal=pf/,
    )
    expect(defaultFixDeepLink('PORTAL_RULES_VIOLATION', { listingId: 'x' })).toBe('/listings/x')
    expect(defaultFixDeepLink('INVALID_CONTENT', { listingId: 'x' })).toBe('/listings/x')
    expect(defaultFixDeepLink('QUOTA_EXCEEDED')).toBe('/my-credits')
    expect(defaultFixDeepLink('PORTAL_DOWN')).toBeNull()
    expect(defaultFixDeepLink('UNKNOWN_ERROR')).toBe('/support')
    expect(ERROR_CLASS_FIX_COPY.AUTH_EXPIRED).toBe('Reconnect account')
    expect(isBulkRetryable('PORTAL_DOWN')).toBe(true)
    expect(isBulkRetryable('AUTH_EXPIRED')).toBe(false)
  })
})
