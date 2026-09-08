/**
 * 3akarat (Lebanon) per-portal validator.
 *
 * PORTAL_LIST_RESEARCH_2026-09-04.md §C does not list extra license fields
 * for 3akarat. Extra portal-specific fields were not in §C.
 *
 * Baseline: title, price, currency, location/city, ≥1 image.
 * Image min 800px JPG/PNG as a **warn** if dimensions missing,
 * **fail** if present and below 600px.
 */

import { validateBaseline } from './baseline.js'

export function validate(listing, _portalContext = {}) {
  return validateBaseline(listing)
}
