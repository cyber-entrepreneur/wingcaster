/**
 * Per-portal validation dispatcher for PA-MOD `validator_lint`.
 *
 * `validate(listing, portalContext) → { checks: [{ code, severity, message, expected, actual }] }`
 * Dispatches on `portalContext.portalCode` / `.code` / `.countryCode`.
 * Unknown portal → `{ checks: [{ code: 'unknown_portal', severity: 'fail', ... }] }`.
 *
 * Modules: bayut, property_finder, dubizzle, olx, aqar, wasalt, aqarmap, 3akarat.
 */

import { makeCheck } from './fields.js'
import * as akarat from './3akarat.js'
import * as aqar from './aqar.js'
import * as aqarmap from './aqarmap.js'
import * as bayut from './bayut.js'
import * as dubizzle from './dubizzle.js'
import * as olx from './olx.js'
import * as propertyFinder from './property_finder.js'
import * as wasalt from './wasalt.js'

export const PORTAL_VALIDATORS = Object.freeze({
  bayut,
  property_finder: propertyFinder,
  dubizzle,
  olx,
  aqar,
  wasalt,
  aqarmap,
  '3akarat': akarat,
})

export const KNOWN_PORTAL_CODES = Object.freeze(Object.keys(PORTAL_VALIDATORS))

export function normalizePortalCode(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!s) return ''
  if (s === '3akarat' || s === 'akarat' || s.startsWith('3akarat')) return '3akarat'
  if (s.includes('property_finder') || s.includes('propertyfinder') || s === 'pf') {
    return 'property_finder'
  }
  if (s.startsWith('bayut')) return 'bayut'
  if (s.startsWith('dubizzle')) return 'dubizzle'
  if (s.startsWith('olx')) return 'olx'
  if (s.startsWith('aqarmap') || s === 'aqar_map') return 'aqarmap'
  if (s.startsWith('wasalt')) return 'wasalt'
  if (s === 'aqar' || s.startsWith('aqar_') || s.startsWith('aqar.')) return 'aqar'
  return s
}

function resolvePortalCode(portalContext = {}) {
  const ctx = portalContext || {}
  return normalizePortalCode(ctx.portalCode || ctx.code || ctx.portal)
}

export function validate(listing, portalContext = {}) {
  const portalCode = resolvePortalCode(portalContext)
  const mod = PORTAL_VALIDATORS[portalCode]
  if (!mod) {
    const actual = portalContext?.portalCode || portalContext?.code || portalContext?.portal || null
    return {
      checks: [
        makeCheck({
          code: 'unknown_portal',
          severity: 'fail',
          message: portalCode
            ? `Unknown portal '${portalCode}'`
            : 'portalContext.portalCode / .code is required',
          expected: KNOWN_PORTAL_CODES.join('|'),
          actual,
        }),
      ],
    }
  }
  return mod.validate(listing, portalContext)
}

export {
  akarat as threeAkarat,
  aqar,
  aqarmap,
  bayut,
  dubizzle,
  olx,
  propertyFinder,
  wasalt,
}
