/**
 * Minimal account-value tier derivation for account-recovery cast-vote.
 *
 * Agent 4 owns the full derivation; this helper is exported so it can be
 * replaced/extended without breaking cast-vote callers.
 *
 * Tiers:
 *   - high_value  → requires two-person review
 *   - elevated    → single-admin (future: Agent 4 may tighten)
 *   - standard    → single-admin
 *
 * Safety: when the applicant is an agency owner but plan/tier data is missing
 * or ambiguous, treat as high_value rather than bypassing two-person.
 */

import { query } from '../db.js'
import { findUserById } from '../identity.js'

export const ACCOUNT_VALUE_TIERS = Object.freeze({
  STANDARD: 'standard',
  ELEVATED: 'elevated',
  HIGH_VALUE: 'high_value',
})

const OPEN_SUBSCRIPTION_STATUSES = [
  'PENDING_START',
  'ACTIVE',
  'PAUSED',
  'CANCELED_AT_PERIOD_END',
]

/**
 * @param {string} userId - recovery applicant user id
 * @param {{ queryFn?: typeof query, findUser?: typeof findUserById }} [opts]
 * @returns {Promise<{ tier: string, requires_two_person: boolean, signals: object }>}
 */
export async function deriveAccountValueTier(userId, opts = {}) {
  const queryFn = opts.queryFn || query
  const findUser = opts.findUser || findUserById

  const signals = {
    is_platform_admin: false,
    is_agency_owner: false,
    agency_tiers: [],
    uncertain_agency_owner: false,
  }

  if (!userId) {
    return {
      tier: ACCOUNT_VALUE_TIERS.STANDARD,
      requires_two_person: false,
      signals,
    }
  }

  const user = await findUser(userId)
  if (user?.platform_role === 'platform_admin') {
    signals.is_platform_admin = true
    return {
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
      signals,
    }
  }

  // db.query returns rows[]; pg client.query returns { rows }.
  const ownershipRaw = await queryFn(
    `SELECT tm.tenant_id, tm.role
       FROM public.tenant_memberships tm
      WHERE tm.user_id = $1
        AND tm.role = 'owner'
        AND tm.status = 'active'`,
    [String(userId)],
  )
  const ownerRows = Array.isArray(ownershipRaw) ? ownershipRaw : (ownershipRaw?.rows || [])
  if (!ownerRows.length) {
    return {
      tier: ACCOUNT_VALUE_TIERS.STANDARD,
      requires_two_person: false,
      signals,
    }
  }

  signals.is_agency_owner = true

  const tiersRaw = await queryFn(
    `SELECT DISTINCT pp.tier
       FROM public.tenant_memberships tm
       JOIN public.credit_wallets w
         ON (
           (w.scope = 'agency' AND (
             w.scope_id = REPLACE(tm.tenant_id, 'agency:', '')
             OR ('agency:' || w.scope_id) = tm.tenant_id
           ))
           OR w.tenant_id::text = tm.tenant_id
         )
       JOIN public.tenant_subscriptions s ON s.tenant_id = w.tenant_id
       JOIN public.product_package_versions v ON v.id = s.package_version_id
       JOIN public.product_packages pp ON pp.id = v.package_id
      WHERE tm.user_id = $1
        AND tm.role = 'owner'
        AND tm.status = 'active'
        AND s.status = ANY($2::text[])`,
    [String(userId), OPEN_SUBSCRIPTION_STATUSES],
  )
  const tierRows = Array.isArray(tiersRaw) ? tiersRaw : (tiersRaw?.rows || [])
  const agencyTiers = tierRows.map((r) => r.tier).filter(Boolean)
  signals.agency_tiers = agencyTiers

  if (agencyTiers.some((t) => String(t).toLowerCase() === 'enterprise')) {
    return {
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
      signals,
    }
  }

  // Owner but no readable subscription/tier → fail closed.
  if (!agencyTiers.length) {
    signals.uncertain_agency_owner = true
    return {
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
      signals,
    }
  }

  // Known non-enterprise paid tiers → elevated (still single-admin for Agent 1).
  if (agencyTiers.some((t) => ['pro', 'growth', 'custom'].includes(String(t).toLowerCase()))) {
    return {
      tier: ACCOUNT_VALUE_TIERS.ELEVATED,
      requires_two_person: false,
      signals,
    }
  }

  return {
    tier: ACCOUNT_VALUE_TIERS.STANDARD,
    requires_two_person: false,
    signals,
  }
}

/** @param {string} tier */
export function requiresTwoPersonForTier(tier) {
  return tier === ACCOUNT_VALUE_TIERS.HIGH_VALUE
}
