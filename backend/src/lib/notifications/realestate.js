/**
 * Real-estate portal publishers. Portal codes and feature wiring come from
 * `portal_registry` (loaded at boot via bootPortalRegistry); filesystem
 * fallback covers offline / unit tests.
 *
 * Property Finder Group (`property_finder`) is the Phase-1 publisher
 * (BE-BLOCKER-01). Other portals remain NOT_IMPLEMENTED stubs until their
 * adapters ship.
 *
 * Metering uses one feature code per portal (`publishing.realestate.<code>`)
 * with a `country_code` dimension on the consumption payload (PORTAL_LIST
 * RESEARCH Option 2). Adapters must not call meterFeature themselves.
 */
import { meterFeature } from '../credits/meter.js'
import {
  ensurePortalCache,
  getPortalEntry,
  listPortalCodes,
} from './portals/registry.js'

function resolveCountryCode(opts = {}) {
  const ctx = opts.creditContext || {}
  return ctx.countryCode || ctx.country_code || opts.countryCode || opts.country_code || null
}

function resolveEventType(opts = {}) {
  const ctx = opts.creditContext || {}
  return ctx.eventType || ctx.event_type || opts.eventType || opts.event_type || 'publish'
}

export async function publishToRealEstatePortal(portal, opts = {}) {
  await ensurePortalCache()
  refreshRealEstatePortalExport()
  const code = String(portal || '').trim()
  const entry = getPortalEntry(code)
  if (!entry) {
    const err = new Error(`Unknown real-estate portal: ${portal}`)
    err.code = 'PORTAL_NOT_SUPPORTED'
    throw err
  }

  const countryCode = resolveCountryCode(opts)
  const eventType = resolveEventType(opts)
  const listing = opts.listing || opts
  const agentContext = opts.agentContext || {
    tenantId: opts.tenantId || opts.creditContext?.tenantId || null,
    agentId: opts.agentId || null,
    countryCode,
  }

  return meterFeature(entry.featureCode, {
    ...opts,
    portal: code,
    countryCode,
    eventType,
    creditContext: {
      ...(opts.creditContext || {}),
      portal: code,
      countryCode,
      eventType,
    },
  }, async () => entry.adapter.publish(listing, agentContext))
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

export function getRealEstatePortals() {
  return listPortalCodes()
}

/** Live portal codes; refreshed whenever the registry cache is applied. */
export let REAL_ESTATE_PORTALS = ['olx', 'property_finder', 'bayut', 'dubizzle']

export function refreshRealEstatePortalExport() {
  REAL_ESTATE_PORTALS = listPortalCodes()
  return REAL_ESTATE_PORTALS
}
