/**
 * Baseline listing completeness for portals whose §C row does not list
 * extra license fields: title, price, currency, location/city, ≥1 image.
 * Image min 800px JPG/PNG as a warn if dimensions missing, fail if present
 * and below 600px.
 */

import {
  getCurrency,
  getLocation,
  getPrice,
  isPresent,
  makeCheck,
  requiredFieldCheck,
} from './fields.js'
import { BASELINE_IMAGE_SPEC, checkImageSpec } from './image-spec.js'

export function baselineChecks(listing) {
  const checks = [
    requiredFieldCheck(listing, {
      code: 'required_title',
      names: ['title', 'name', 'headline', 'listing_title'],
      label: 'title',
    }),
    (() => {
      const actual = getPrice(listing)
      if (isPresent(actual)) {
        return makeCheck({
          code: 'required_price',
          severity: 'pass',
          message: 'price is present',
          expected: 'price',
          actual: typeof actual === 'object' ? JSON.stringify(actual) : actual,
        })
      }
      return makeCheck({
        code: 'required_price',
        severity: 'fail',
        message: 'price is required',
        expected: 'price',
        actual: null,
      })
    })(),
    (() => {
      const actual = getCurrency(listing)
      if (isPresent(actual)) {
        return makeCheck({
          code: 'required_currency',
          severity: 'pass',
          message: 'currency is present',
          expected: 'currency',
          actual: actual,
        })
      }
      return makeCheck({
        code: 'required_currency',
        severity: 'fail',
        message: 'currency is required',
        expected: 'currency',
        actual: null,
      })
    })(),
    (() => {
      const actual = getLocation(listing)
      if (isPresent(actual)) {
        return makeCheck({
          code: 'required_location',
          severity: 'pass',
          message: 'location/city is present',
          expected: 'location or city',
          actual: typeof actual === 'object' ? JSON.stringify(actual) : actual,
        })
      }
      return makeCheck({
        code: 'required_location',
        severity: 'fail',
        message: 'location/city is required',
        expected: 'location or city',
        actual: null,
      })
    })(),
    ...checkImageSpec(listing, BASELINE_IMAGE_SPEC),
  ]
  return checks
}

export function validateBaseline(listing) {
  return { checks: baselineChecks(listing) }
}
