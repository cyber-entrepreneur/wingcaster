/**
 * Jurisdiction requirements — backend gate source of truth.
 *
 * Parallel copy of `web/src/lib/marketRegistry.ts` (repo convention: client +
 * server checks are duplicated, not shared). The gate-eligible permit field
 * KEYS/NAMES here MUST match the per-portal validators in
 * `backend/src/lib/portal-validators/*` and the web registry — asserted by
 * `jurisdiction-requirements.parity.test.js`.
 *
 * Publish-time filter tiers (see docs/design/JURISDICTION_REQUIREMENTS_RESEARCH.md):
 *   - hard : sourced permit enforced by law → BLOCKS publish if missing (UAE, KSA).
 *   - soft : no permit required → verification badge from references + validation. Never blocks.
 *   - none : nothing required → publishes automatically (default for unlisted markets).
 *
 * Gating applies ONLY to PUBLISHED listings (visible to market). A draft/private
 * listing in the agent's database is never gated.
 */

import { getListingField } from '../portal-validators/fields.js'

/** Gate-eligible permit fields per hard jurisdiction (names align to portal-validators). */
export const GATE_ELIGIBLE_PERMITS = Object.freeze({
  AE: {
    // Canonical key matches the web market registry (marketRegistry.ts). Aliases
    // cover the per-portal validators (bayut.js requires trakheesi_number).
    key: 'trakheesi_permit',
    names: ['trakheesi_permit', 'trakheesi_number', 'trakheesiNumber', 'trakheesi'],
    label: 'Trakheesi permit number',
  },
  SA: {
    key: 'rega_ad_licence',
    names: ['rega_ad_licence', 'advertiser_license', 'advertiserLicense', 'fal_license', 'falLicense'],
    label: 'REGA advertising licence',
  },
})

/** Publish-time filter tier per jurisdiction. Everything else → 'none'. */
export const GATE_POLICY = Object.freeze({
  AE: 'hard',
  SA: 'hard',
  KW: 'soft',
  QA: 'soft',
  BH: 'soft',
  OM: 'soft',
  EG: 'soft',
  JO: 'soft',
  LB: 'soft',
})

/** Soft-tier badge references (Layer B/C) checked when present. */
const SOFT_BADGE_FIELDS = Object.freeze([
  { key: 'authorization_ref', names: ['authorization_ref', 'authorizationRef'] },
  { key: 'ownership_ref', names: ['ownership_ref', 'ownershipRef'] },
])

const COUNTRY_ALIASES = Object.freeze({
  AE: 'AE', UAE: 'AE', 'U.A.E': 'AE', 'UNITED ARAB EMIRATES': 'AE', EMIRATES: 'AE', DUBAI: 'AE', 'ABU DHABI': 'AE', ABUDHABI: 'AE', SHARJAH: 'AE',
  SA: 'SA', KSA: 'SA', 'SAUDI ARABIA': 'SA', SAUDI: 'SA',
  LB: 'LB', LEBANON: 'LB', BEIRUT: 'LB',
  EG: 'EG', EGYPT: 'EG', CAIRO: 'EG',
  JO: 'JO', JORDAN: 'JO', AMMAN: 'JO',
  KW: 'KW', KUWAIT: 'KW',
  QA: 'QA', QATAR: 'QA', DOHA: 'QA',
  BH: 'BH', BAHRAIN: 'BH',
  OM: 'OM', OMAN: 'OM', MUSCAT: 'OM',
})

/** Normalize free-text / ISO country into a supported ISO2 code, else ''. */
export function normalizeCountry(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  const upper = raw.toUpperCase()
  return COUNTRY_ALIASES[upper] || ''
}

/**
 * The property's own jurisdiction (anti-fraud driver = where the property is),
 * from `country_code` first, then a free-text `country`/`city` fallback.
 */
export function resolvePropertyCountry(property) {
  if (!property || typeof property !== 'object') return ''
  const direct = property.country_code || property.countryCode
  const fromDirect = normalizeCountry(direct)
  if (fromDirect) return fromDirect
  return (
    normalizeCountry(getListingField(property, 'country'))
    || normalizeCountry(getListingField(property, 'city'))
  )
}

/**
 * Whether a market is currently ON. `enabledMarkets` is the PA-controlled set of
 * enabled ISO2 codes (migration 804). When omitted, every market is treated as
 * enabled (back-compat for callers that don't consult market settings).
 */
function marketEnabled(country, enabledMarkets) {
  if (enabledMarkets == null) return true
  const set = enabledMarkets instanceof Set ? enabledMarkets : new Set(enabledMarkets)
  return set.has(country)
}

/**
 * Publish-time filter tier for the property's jurisdiction. A market that the PA
 * has turned OFF resolves to 'none' (no trigger), regardless of its policy.
 */
export function gatePolicyForProperty(property, { enabledMarkets } = {}) {
  const country = resolvePropertyCountry(property)
  if (!marketEnabled(country, enabledMarkets)) return 'none'
  return GATE_POLICY[country] || 'none'
}

/**
 * Hard-gate blockers for a PUBLISHED listing: the required, sourced permit
 * fields that are missing. Empty ⇒ allowed. Only HARD markets return blockers;
 * soft/none never block. A PA-disabled market never blocks (policy 'none').
 *
 * @returns {{ country: string, policy: string, missing: {key:string,label:string}[] }}
 */
export function hardGateBlockers(property, { enabledMarkets } = {}) {
  const country = resolvePropertyCountry(property)
  const policy = marketEnabled(country, enabledMarkets) ? (GATE_POLICY[country] || 'none') : 'none'
  if (policy !== 'hard') return { country, policy, missing: [] }
  const permit = GATE_ELIGIBLE_PERMITS[country]
  if (!permit) return { country, policy, missing: [] }
  const value = getListingField(property, ...permit.names)
  const present = value != null && String(value).trim() !== ''
  return {
    country,
    policy,
    missing: present ? [] : [{ key: permit.key, label: permit.label }],
  }
}

/**
 * Derive the verification badge status from a property's captured values.
 *  - hard → 'authorised' when the permit is present.
 *  - soft → 'authorised' when the Layer B/C references are present.
 *  - none → 'unverified'.
 *  - 'registry_verified' requires a regulator API cross-check (future PR).
 */
export function deriveVerificationStatus(property, { enabledMarkets } = {}) {
  const country = resolvePropertyCountry(property)
  const policy = marketEnabled(country, enabledMarkets) ? (GATE_POLICY[country] || 'none') : 'none'
  if (policy === 'hard') {
    const permit = GATE_ELIGIBLE_PERMITS[country]
    if (!permit) return 'unverified'
    const value = getListingField(property, ...permit.names)
    return value != null && String(value).trim() !== '' ? 'authorised' : 'unverified'
  }
  if (policy === 'soft') {
    const allPresent = SOFT_BADGE_FIELDS.every((f) => {
      const value = getListingField(property, ...f.names)
      return value != null && String(value).trim() !== ''
    })
    return allPresent ? 'authorised' : 'unverified'
  }
  return 'unverified'
}

/**
 * Whether a target status/visibility makes a listing "published" (visible to
 * market / promoted) vs merely stored in the agent's database.
 */
export function isPublishedState({ status, visibility } = {}) {
  const s = String(status || '').toLowerCase()
  const publicStatus = s === 'active' || s === 'published'
  if (!publicStatus) return false
  const v = String(visibility || '').toLowerCase()
  // private / pocket listings are DB-only, never gated. Anything else that is
  // active/published is visible to the market → gated.
  if (v === 'private' || v === 'pocket') return false
  return true
}
