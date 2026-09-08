/**
 * Dynamic portal registry — loads `portal_registry` rows and resolves
 * adapter modules under this directory. Boot-time sync also registers
 * metered feature codes via credits/features.js.
 *
 * Adapter files are keyed by `adapter_class_name` (`portals/olx.js`) with
 * a filesystem fallback to `./<code>.js` so tests/boot work if the table
 * is empty.
 */
import {
  portalFeatureCode,
  registerPortalFeaturesFromRows,
} from '../../credits/features.js'
import { PortalPublisher } from './base.js'

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
    country_codes: ['EG', 'LB'],
    adapter_class_name: 'portals/olx.js',
    is_active: false,
  },
  {
    id: '32300000-0000-4000-8000-000000000002',
    code: 'property_finder',
    display_name: 'Property Finder',
    country_codes: ['AE', 'SA', 'EG', 'LB', 'JO', 'QA', 'KW', 'BH', 'OM'],
    adapter_class_name: 'portals/property_finder.js',
    is_active: false,
  },
  {
    id: '32300000-0000-4000-8000-000000000003',
    code: 'bayut',
    display_name: 'Bayut',
    country_codes: ['AE', 'SA'],
    adapter_class_name: 'portals/bayut.js',
    is_active: false,
  },
  {
    id: '32300000-0000-4000-8000-000000000004',
    code: 'dubizzle',
    display_name: 'dubizzle',
    country_codes: ['AE'],
    adapter_class_name: 'portals/dubizzle.js',
    is_active: false,
  },
]

/** @type {Map<string, { row: object, adapter: import('./base.js').PortalPublisher, featureCode: string }> | null} */
let portalCache = null
let bootPromise = null

function adapterFileName(row) {
  const named = String(row?.adapter_class_name || '')
    .replace(/^portals\//, '')
    .replace(/^\.\//, '')
  if (named.endsWith('.js')) return named
  if (row?.code) return `${row.code}.js`
  return null
}

export async function loadPortalAdapterClass(code, adapterClassName) {
  const file = adapterFileName({ code, adapter_class_name: adapterClassName })
  const loader = ADAPTER_LOADERS[code]
  let mod
  if (file) {
    try {
      mod = await import(new URL(`./${file}`, import.meta.url).href)
    } catch (error) {
      if (!loader) throw error
      mod = await loader()
    }
  } else if (loader) {
    mod = await loader()
  } else {
    const err = new Error(`Cannot resolve adapter for portal ${code}`)
    err.code = 'ADAPTER_NOT_FOUND'
    throw err
  }
  const ClassRef = (adapterClassName && !String(adapterClassName).includes('/') && mod[adapterClassName])
    || mod.default
    || Object.values(mod).find((value) => (
      typeof value === 'function'
        && value !== PortalPublisher
        && value.prototype instanceof PortalPublisher
    ))
  if (!ClassRef) {
    throw new Error(`Portal adapter module for ${code} has no publisher class`)
  }
  return ClassRef
}

async function instantiateAdapter(row) {
  try {
    const ClassRef = await loadPortalAdapterClass(row.code, row.adapter_class_name)
    return new ClassRef(row)
  } catch {
    return new PortalPublisher(row)
  }
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
 * Replace the in-memory portal map from rows.
 * Inactive stubs still load (so publishOlx keeps working) but only **active**
 * rows auto-register extra FEATURES keys.
 */
export async function applyPortalRows(rows, { registerFeatures = true } = {}) {
  const map = new Map()
  for (const row of rows || []) {
    const entry = await buildPortalEntry(row)
    map.set(String(row.code), entry)
  }
  portalCache = map
  if (registerFeatures) {
    registerPortalFeaturesFromRows(rows.filter((row) => row?.is_active))
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
    try {
      const { refreshPortalFeatures } = await import('../../credits/features.js')
      await refreshPortalFeatures()
    } catch {
      // Offline / unit tests: FEATURES bootstrap constants are enough.
    }
    logger?.info?.(
      { portals: [...map.keys()], active: [...map.values()].filter((e) => e.row.is_active).map((e) => e.row.code) },
      'portal_registry loaded',
    )
    return map
  })()
  try {
    return await bootPromise
  } finally {
    bootPromise = null
  }
}

/** Test helper — wipe cache so the next boot/ensure rebuilds. */
export function resetPortalRegistryForTests() {
  portalCache = null
  bootPromise = null
}

export { ADAPTER_LOADERS, PortalPublisher }
