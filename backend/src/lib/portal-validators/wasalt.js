/**
 * Wasalt (KSA) per-portal validator.
 *
 * PORTAL_LIST_RESEARCH_2026-09-04.md §C (verbatim):
 *   AI-verification metadata (auto-populated?) — **warn** if missing
 *   `ai_verification` / `wasalt_verified` metadata, do not fail closed.
 *   Image spec: TBD (warn, never fail closed on images).
 */

import { getListingField, isPresent, makeCheck } from './fields.js'
import { checkImageSpec } from './image-spec.js'

export function validate(listing, _portalContext = {}) {
  const ai = getListingField(
    listing,
    'ai_verification',
    'aiVerification',
    'wasalt_verified',
    'wasaltVerified',
  )
  const checks = []
  if (isPresent(ai)) {
    checks.push(makeCheck({
      code: 'ai_verification',
      severity: 'pass',
      message: 'Wasalt AI-verification metadata is present',
      expected: 'ai_verification or wasalt_verified',
      actual: typeof ai === 'object' ? 'present' : ai,
    }))
  } else {
    checks.push(makeCheck({
      code: 'ai_verification',
      severity: 'warn',
      message: 'Wasalt AI-verification metadata is missing (auto-populated?); not failing closed',
      expected: 'ai_verification or wasalt_verified',
      actual: null,
    }))
  }

  // Image spec is TBD in §C — warn only, do not fail closed.
  checks.push(...checkImageSpec(listing, {
    minPx: 800,
    requireImages: false,
    missingImageSeverity: 'warn',
    failBelowPx: 0,
  }))
  return { checks }
}
