/**
 * Aqarmap (EG) per-portal validator.
 *
 * PORTAL_LIST_RESEARCH_2026-09-04.md §C (verbatim):
 *   `developer_registration` **when listing is primary/off-plan**
 *   (`listing.market_type` or `listing.off_plan` or `listing.sale_type`
 *   in `primary|off_plan|off-plan`). Image: min 600px.
 */

import { isOffPlanOrPrimary, makeCheck, requiredFieldCheck } from './fields.js'
import { AQARMAP_IMAGE_SPEC, checkImageSpec } from './image-spec.js'

export function validate(listing, _portalContext = {}) {
  const checks = []
  if (isOffPlanOrPrimary(listing)) {
    checks.push(requiredFieldCheck(listing, {
      code: 'required_developer_registration',
      names: ['developer_registration', 'developerRegistration', 'developer_reg'],
      label: 'developer_registration (required for primary/off-plan)',
      expected: 'developer_registration',
    }))
  } else {
    checks.push(makeCheck({
      code: 'required_developer_registration',
      severity: 'pass',
      message: 'developer_registration not required for secondary/resale listings',
      expected: 'n/a (not primary/off-plan)',
      actual: null,
    }))
  }
  checks.push(...checkImageSpec(listing, AQARMAP_IMAGE_SPEC))
  return { checks }
}
