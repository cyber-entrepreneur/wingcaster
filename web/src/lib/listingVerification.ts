/**
 * Listing verification policy layer (Layers B/C/D enforcement + badge).
 *
 * Sits ON TOP of `marketRegistry.ts` (the data source of record for agent
 * licence + per-property permit + marketplaces). This module adds the
 * *enforcement policy* the listing/publish flow needs and that the registry
 * intentionally doesn't carry:
 *   - the publish-time gate tier per jurisdiction (hard / soft / none),
 *   - the Layer B/C capture fields (authorization + ownership references),
 *   - the verification badge ladder, and the selectors the composer uses.
 *
 * The permit (Layer D) is NOT redefined here — it is read from the registry's
 * `propertyVerificationFor`, so the field keys (UAE → `trakheesi_permit`,
 * KSA → `rega_ad_licence`) have a single source of truth. The backend gate
 * (`backend/src/lib/listings/jurisdiction-requirements.js`) mirrors these keys.
 *
 * Governance: only the registry's permit fields (regulator-sourced) can HARD
 * gate a publish. Soft markets collect references and earn a badge but never
 * block; none markets publish automatically.
 */

import {
  propertyVerificationFor as registryPropertyVerificationFor,
  type CredentialField,
} from './marketRegistry'

export type { CredentialField }

/**
 * Publish-time filter tier (applies only to PUBLISHED listings — a draft/private
 * listing in the agent's database is never filtered):
 *  - `hard` — permit enforced by law; missing it BLOCKS publish (UAE, KSA).
 *  - `soft` — no permit required, but a verification badge is shown, earned via
 *             agent references + validation. Never blocks.
 *  - `none` — nothing required; publishes automatically (default for unlisted markets).
 */
export type GatePolicy = 'hard' | 'soft' | 'none'

/** Verification badge ladder. `registry_verified` requires a future regulator-API check. */
export type VerificationStatus = 'unverified' | 'authorised' | 'registry_verified'

export type ListingRole = 'principal' | 'referral'
export type RepresentsType = 'developer' | 'brokerage'

const AUTHORIZATION_REF: CredentialField = {
  key: 'authorization_ref',
  label: 'Owner authorization reference',
  help: 'The signed owner↔broker listing agreement (UAE "Form A", or the developer authorization for off-plan). Self-declared for now.',
  placeholder: 'e.g. Form A reference or agreement no.',
}

const OWNERSHIP_REF: CredentialField = {
  key: 'ownership_ref',
  label: 'Title / ownership reference',
  help: 'Title deed / land-registry reference proving the unit exists and who owns it. Self-declared for now.',
  placeholder: 'e.g. title deed no.',
}

interface VerificationPolicy {
  gatePolicy: GatePolicy
  /** Layer B/C collect-only capture fields (earn the badge in soft markets). */
  authorization: CredentialField[]
  ownership: CredentialField[]
}

const HARD: VerificationPolicy = { gatePolicy: 'hard', authorization: [AUTHORIZATION_REF], ownership: [OWNERSHIP_REF] }
const SOFT: VerificationPolicy = { gatePolicy: 'soft', authorization: [AUTHORIZATION_REF], ownership: [OWNERSHIP_REF] }

/**
 * Per-jurisdiction verification policy. Hard markets (UAE, KSA) also carry a
 * registry permit; the GCC + LB/EG/JO markets are soft (badge from references,
 * no hard block until a regulator source/expert pass upgrades them). Anything
 * absent → 'none'.
 */
const VERIFICATION_POLICY: Record<string, VerificationPolicy> = {
  AE: HARD,
  SA: HARD,
  KW: SOFT,
  QA: SOFT,
  BH: SOFT,
  OM: SOFT,
  EG: SOFT,
  JO: SOFT,
  LB: SOFT,
}

/** Markets offered in the composer's Country select (order = display order). */
export const SUPPORTED_MARKETS: { code: string; label: string }[] = [
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'LB', label: 'Lebanon' },
  { code: 'EG', label: 'Egypt' },
  { code: 'JO', label: 'Jordan' },
  { code: 'KW', label: 'Kuwait' },
  { code: 'QA', label: 'Qatar' },
  { code: 'BH', label: 'Bahrain' },
  { code: 'OM', label: 'Oman' },
]

const COUNTRY_ALIASES: Record<string, string> = {
  ae: 'AE', uae: 'AE', 'u.a.e': 'AE', 'united arab emirates': 'AE', emirates: 'AE', dubai: 'AE', 'abu dhabi': 'AE', abudhabi: 'AE', sharjah: 'AE',
  sa: 'SA', ksa: 'SA', 'saudi arabia': 'SA', saudi: 'SA',
  lb: 'LB', lebanon: 'LB', beirut: 'LB',
  eg: 'EG', egypt: 'EG', cairo: 'EG',
  jo: 'JO', jordan: 'JO', amman: 'JO',
  kw: 'KW', kuwait: 'KW',
  qa: 'QA', qatar: 'QA', doha: 'QA',
  bh: 'BH', bahrain: 'BH',
  om: 'OM', oman: 'OM', muscat: 'OM',
}

/** Normalize free-text country / city into a supported ISO2 code, else ''. */
export function normalizeCountryToIso2(input: string | null | undefined): string {
  const raw = String(input || '').trim()
  if (!raw) return ''
  const upper = raw.toUpperCase()
  if (VERIFICATION_POLICY[upper]) return upper
  return COUNTRY_ALIASES[raw.toLowerCase()] || ''
}

function policyFor(countryCode: string | null | undefined): VerificationPolicy | null {
  const code = normalizeCountryToIso2(countryCode) || String(countryCode || '').toUpperCase()
  return VERIFICATION_POLICY[code] || null
}

/** Publish-time filter tier for a jurisdiction ('none' when unlisted). */
export function gatePolicyFor(countryCode: string | null | undefined): GatePolicy {
  return policyFor(countryCode)?.gatePolicy ?? 'none'
}

/**
 * The sourced permit fields REQUIRED for a property located in `countryCode`
 * (Layer D). Delegates to the market registry so the field keys have one source
 * of truth (UAE → trakheesi_permit, KSA → rega_ad_licence, else []).
 */
export function propertyVerificationFor(countryCode: string | null | undefined): CredentialField[] {
  const code = normalizeCountryToIso2(countryCode) || String(countryCode || '').toUpperCase()
  return registryPropertyVerificationFor(code)
}

/** Layer B (collect-only) capture fields for a jurisdiction. */
export function listingAuthorizationFor(countryCode: string | null | undefined): CredentialField[] {
  return policyFor(countryCode)?.authorization ?? []
}

/** Layer C (collect-only) capture fields for a jurisdiction. */
export function ownershipDocFor(countryCode: string | null | undefined): CredentialField[] {
  return policyFor(countryCode)?.ownership ?? []
}

/** True when the jurisdiction hard-gates on a sourced permit. */
export function isGateEligibleJurisdiction(countryCode: string | null | undefined): boolean {
  return gatePolicyFor(countryCode) === 'hard' && propertyVerificationFor(countryCode).length > 0
}

/** All capture fields shown in the composer's Property-verification section. */
export function verificationCaptureFor(countryCode: string | null | undefined): {
  permit: CredentialField[]
  authorization: CredentialField[]
  ownership: CredentialField[]
} {
  return {
    permit: propertyVerificationFor(countryCode),
    authorization: listingAuthorizationFor(countryCode),
    ownership: ownershipDocFor(countryCode),
  }
}

/**
 * Fields whose presence earns the verification badge:
 *  - hard markets → the sourced permit fields.
 *  - soft markets → the Layer B/C references (authorization + ownership).
 *  - none markets → none.
 */
export function badgeFieldsFor(countryCode: string | null | undefined): CredentialField[] {
  const policy = gatePolicyFor(countryCode)
  if (policy === 'hard') return propertyVerificationFor(countryCode)
  if (policy === 'soft') return [...listingAuthorizationFor(countryCode), ...ownershipDocFor(countryCode)]
  return []
}

/**
 * Publish-gate decision for the client (mirrors the backend gate). Only HARD
 * markets block; soft/none never block. Returns the missing permit fields.
 */
export function publishBlockers(
  countryCode: string | null | undefined,
  values: Record<string, string | undefined | null>,
): CredentialField[] {
  if (gatePolicyFor(countryCode) !== 'hard') return []
  return propertyVerificationFor(countryCode).filter((f) => String(values?.[f.key] ?? '').trim() === '')
}

/**
 * Derive the verification badge status from captured values.
 *  - hard → `authorised` when the permit is present.
 *  - soft → `authorised` when the Layer B/C references are present.
 *  - none → `unverified`.
 *  - `registry_verified` requires a regulator API cross-check (future PR).
 */
export function deriveVerificationStatus(
  countryCode: string | null | undefined,
  values: Record<string, string | undefined | null>,
): VerificationStatus {
  const fields = badgeFieldsFor(countryCode)
  if (fields.length === 0) return 'unverified'
  const allPresent = fields.every((f) => String(values?.[f.key] ?? '').trim() !== '')
  return allPresent ? 'authorised' : 'unverified'
}
