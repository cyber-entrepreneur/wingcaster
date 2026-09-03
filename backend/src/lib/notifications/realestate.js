/**
 * Real-estate portal publishers. Production APIs are not wired yet; these
 * stubs are wrapped with withCredits so every migration-303 feature has a
 * metered call site. Portal integration is a separate workstream.
 */
import { FEATURES } from '../credits/features.js'
import { meterFeature } from '../credits/meter.js'

const PORTALS = {
  olx: FEATURES.PUBLISHING_REALESTATE_OLX,
  property_finder: FEATURES.PUBLISHING_REALESTATE_PROPERTY_FINDER,
  bayut: FEATURES.PUBLISHING_REALESTATE_BAYUT,
  dubizzle: FEATURES.PUBLISHING_REALESTATE_DUBIZZLE,
}

export async function publishToRealEstatePortal(portal, opts = {}) {
  const feature = PORTALS[portal]
  if (!feature) {
    const err = new Error(`Unknown real-estate portal: ${portal}`)
    err.code = 'PORTAL_NOT_SUPPORTED'
    throw err
  }
  return meterFeature(feature, opts, async () => {
    const err = new Error(`${portal} publish is not implemented`)
    err.code = 'NOT_IMPLEMENTED'
    throw err
  })
}

export async function publishOlx(opts) {
  return publishToRealEstatePortal('olx', opts)
}
export async function publishPropertyFinder(opts) {
  return publishToRealEstatePortal('property_finder', opts)
}
export async function publishBayut(opts) {
  return publishToRealEstatePortal('bayut', opts)
}
export async function publishDubizzle(opts) {
  return publishToRealEstatePortal('dubizzle', opts)
}

export const REAL_ESTATE_PORTALS = Object.keys(PORTALS)
