/**
 * Dynamic portal registry — loads `portal_registry` rows and resolves
 * adapter modules under this directory. Boot-time sync also registers
 * metered feature codes via credits/features.js.
 *
 * Adapter files are keyed by portal `code` (`./<code>.js`). Class names
 * from `adapter_class_name` are preferred when the module exports them;
 * otherwise the module default / first PortalPublisher subclass is used.
 */
import { registerPortalFeaturesFromRows, portalFeatureCode } from '../../credits/features.js'

const ADAPTER_LOADERS = {
  olx: () => import('./olx.js'),
  property_finder: () => import('./property_finder.js'),
  bayut: () => import('./bayut.js'),
  dubizzle: () => import('./dubizzle.js'),
}

/** Deterministic stub rows used when DB is unavailable (unit tests / offline). */
export const FALLBACK_PORTAL_ROWS = [
  {
    id: '32300000-0000-4000-8000-000000000001',
    code: 'olx',
    display_name: 'OLX',
    country_codes: ['AE', 'SA', 'EG', 'LB', 'JO'],
    adapter_class_name: 'OlxPortalPublisher',
    is_active: false,
  },
  {
    id: '32300000-0000-4000-8000-000000000002',
    code: 'property_finder',
    display_name: 'Property Finder',
    country_codes: ['AE', 'SA', 'EG', 'LB', 'JO', 'QA', 'KW', 'BH', 'OM'],
    adapter_class_name: 'PropertyFinderPortalPublisher',
    is_active: false,
  },
  {
    id: '32300000-0000-4000-8000-000000000003',
    code: 'bayut',
    display_name: 'Bayut',
    country_codes: ['AE', 'SA', 'EG'],
    adapter_class_name: 'BayutPortalPublisher',
    is_active: false,
  },
  {
    id: '32300000-0000-4000-8000-000000000004',
    code: 'dubizzle',
    display_name: 'dubizzle',
    country_codes: ['AE'],
    adapter_class_name: 'DubizzlePortalPublisher',
    is_active: false,
  },
]

/** @type {Map<string, { row: object, adapter: import('./base.js').PortalPublisher, featureCode: string }> | null} */
let portalCache = null
let bootPromise = null

function notImplemented(message) {
  const err = new Error(message)
  err.code = 'NOT_IMPLEMENTED'
  return err
}

async function instantiateAdapter(row) {
  const code = String(row.code)
  const loader = ADAPTER_LOADERS[code]
  if (!loader) {
    // Unknown portal code — stub publisher that still throws NOT_IMPLEMENTED.
    const { PortalPublisher } = await import('./base.js')
    return new PortalPublisher(row)
  }
  const mod = await loader()
  const ClassRef = mod[row.adapter_class_name]
    || mod.default
    || Object.values(mod).find((v) => typeof v === 'function' && v.prototype?.publish)
  if (!ClassRef) {
    throw new Error(`Portal adapter module for ${code} has no publisher class`)
  }
  return new ClassRef(row)
}

export async function buildPortalEntry(row) {
  const adapter = await instantiateAdapter(row)
  return {
    row,
    adapter,
    featureCode: portalFeatureCode(row.code),
  }
}

/**
 * Replace the in-memory portal map from rows and register feature codes.
 * Registers every registry row (including inactive stubs) so existing
 * metering feature codes stay wired; `is_active` gates live availability
 * for future publish surfaces, not feature-code presence.
 */
export async function applyPortalRows(rows, { registerFeatures = true } = {}) {
  const map = new Map()
  for (const row of rows || []) {
    const entry = await buildPortalEntry(row)
    map.set(String(row.code), entry)
  }
  portalCache = map
  if (registerFeatures) {
    registerPortalFeaturesFromRows(rows)
  }
  return map
}

export function getPortalCache() {
  return portalCache
}

export function listPortalCodes() {
  if (!portalCache) return FALLBACK_PORTAL_ROWS.map((r) => r.code)
  return [...portalCache.keys()]
}

export function getPortalEntry(code) {
  if (!portalCache) return null
  return portalCache.get(String(code)) || null
}

export async function ensurePortalCache() {
  if (portalCache) return portalCache
  return applyPortalRows(FALLBACK_PORTAL_ROWS, { registerFeatures: true })
}

/**
 * Load portal_registry from Postgres and hydrate adapters + feature codes.
 * Safe to call multiple times; concurrent boots share one promise.
 */
export async function bootPortalRegistry({ queryFn = null, logger = null } = {}) {
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    let rows = null
    try {
      let q = queryFn
      if (!q) {
        const { query } = await import('../../../db.js')
        q = query
      }
      rows = await q(
        `SELECT id, code, display_name, description, logo_url, country_codes,
                primary_language, adapter_class_name, publisher_config,
                inbound_config, validator_ref, is_active, effective_from,
                deprecated_at, created_at, updated_at
           FROM public.portal_registry
          WHERE deprecated_at IS NULL
          ORDER BY code`,
      )
    } catch (error) {
      logger?.warn?.(
        { err: error?.message || String(error) },
        'portal_registry load failed; using filesystem stub fallback',
      )
      rows = FALLBACK_PORTAL_ROWS
    }
    if (!rows?.length) rows = FALLBACK_PORTAL_ROWS
    const map = await applyPortalRows(rows, { registerFeatures: true })
    logger?.info?.(
      { portals: [...map.keys()], active: [...map.values()].filter((e) => e.row.is_active).map((e) => e.row.code) },
      'portal_registry loaded',
    )
    return map
  })()
  try {
    return await bootPromise
  } finally {
    // Allow a later explicit reload (tests / admin activate).
    bootPromise = null
  }
}

/** Test helper — wipe cache so the next boot/ensure rebuilds. */
export function resetPortalRegistryForTests() {
  portalCache = null
  bootPromise = null
}

export { notImplemented, ADAPTER_LOADERS }
