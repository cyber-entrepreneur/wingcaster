/**
 * Bayut per-portal validator.
 *
 * PORTAL_LIST_RESEARCH_2026-09-04.md §C (verbatim):
 *   Bayut UAE (`countryCode=AE`) — required: `trakheesi_number` (Dubai permit),
 *     `broker_orn`. Image: min 800px, JPG/PNG, ≤5MB.
 *   Bayut KSA (`countryCode=SA`) — required: `advertiser_license` (Fal license).
 *     Image: same as UAE (800px, JPG/PNG, ≤5MB).
 *
 * `validate(listing, portalContext) → { checks }`
 * severity: 'pass' | 'warn' | 'fail'  (PA-MOD pills / validator_lint)
 */

import { getCountryCode, requiredFieldCheck } from './fields.js'
import { BAYUT_IMAGE_SPEC, checkImageSpec } from './image-spec.js'

export function validate(listing, portalContext = {}) {
  const country = getCountryCode(portalContext, listing)
  const checks = []

  if (country === 'SA') {
    checks.push(requiredFieldCheck(listing, {
      code: 'required_advertiser_license',
      names: ['advertiser_license', 'advertiserLicense', 'fal_license', 'falLicense'],
      label: 'advertiser_license (Fal license)',
      expected: 'advertiser_license',
    }))
  } else {
    // UAE (AE) and unspecified country — §C UAE required fields.
    checks.push(requiredFieldCheck(listing, {
      code: 'required_trakheesi_number',
      names: ['trakheesi_number', 'trakheesiNumber', 'trakheesi'],
      label: 'trakheesi_number (Dubai permit)',
      expected: 'trakheesi_number',
    }))
    checks.push(requiredFieldCheck(listing, {
      code: 'required_broker_orn',
      names: ['broker_orn', 'brokerOrn', 'orn'],
      label: 'broker_orn',
      expected: 'broker_orn',
    }))
  }

  checks.push(...checkImageSpec(listing, BAYUT_IMAGE_SPEC))
  return { checks }
}
