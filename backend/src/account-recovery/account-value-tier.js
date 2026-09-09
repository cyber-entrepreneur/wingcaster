/**
 * Account-value tier derivation for account-recovery (BE-ACR-04 / PA-ACR-001).
 *
 * Used by cast-vote (BE-BLOCKER-22) and list/detail extensions.
 *
 * Tiers (PA-ACR-001):
 *   - high_value  → agency_owner on Enterprise, OR platform admin (PA),
 *                   OR agency credit-outstanding above threshold
 *   - elevated    → agency_owner on Broker plan, OR PA-designate
 *   - standard    → otherwise
 *
 * `requires_two_person` === (tier === 'high_value').
 *
 * Safety: when the applicant is an agency owner but plan/tier data is missing
 * or ambiguous, treat as high_value rather than bypassing two-person.
 *
 * Plan mapping (product_packages.tier → marketing names):
 *   enterprise           → Enterprise  → high_value
 *   pro / growth / custom / broker     → Broker family → elevated
 *   free / starter / semsar            → Semsar/trial  → standard (as owner)
 */

import { query } from '../db.js'
import { findUserById } from '../identity.js'

export const ACCOUNT_VALUE_TIERS = Object.freeze({
  STANDARD: 'standard',
  ELEVATED: 'elevated',
  HIGH_VALUE: 'high_value',
})

/**
 * Agency AR / credit outstanding (minor currency units) at or above this
 * threshold forces high_value. Documented default: 500_000 = $5,000.00 USD
 * (or 5,000.000 in three-decimal currencies). Override via opts or env
 * ACCOUNT_RECOVERY_CREDIT_OUTSTANDING_THRESHOLD_MINOR.
 */
export const DEFAULT_CREDIT_OUTSTANDING_HIGH_VALUE_MINOR = Number(
  process.env.ACCOUNT_RECOVERY_CREDIT_OUTSTANDING_THRESHOLD_MINOR || 500_000,
)

const OPEN_SUBSCRIPTION_STATUSES = [
  'PENDING_START',
  'ACTIVE',
  'PAUSED',
  'CANCELED_AT_PERIOD_END',
]

const ENTERPRISE_PLAN_TIERS = new Set(['enterprise'])
const BROKER_PLAN_TIERS = new Set(['broker', 'pro', 'growth', 'custom'])
const STANDARD_PLAN_TIERS = new Set(['free', 'starter', 'semsar', 'trial'])

/**
 * Normalize a package tier / display name into a classification bucket.
 * @param {unknown} raw
 * @returns {'enterprise'|'broker'|'standard'|'unknown'}
 */
export function classifyPlanTier(raw) {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return 'unknown'
  if (ENTERPRISE_PLAN_TIERS.has(value) || value.includes('enterprise')) {
    return 'enterprise'
  }
  if (BROKER_PLAN_TIERS.has(value) || value.includes('broker') || value.includes('brokerage')) {
    return 'broker'
  }
  if (STANDARD_PLAN_TIERS.has(value) || value.includes('semsar')) {
    return 'standard'
  }
  return 'unknown'
}

/**
 * Pure classifier from already-collected signals.
 * Prefer calling deriveAccountValueTier() in production paths.
 *
 * @param {{
 *   is_platform_admin?: boolean,
 *   is_pa_designate?: boolean,
 *   is_agency_owner?: boolean,
 *   agency_plan_classes?: string[],
 *   uncertain_agency_owner?: boolean,
 *   credit_outstanding_minor?: number,
 *   credit_outstanding_threshold_minor?: number,
 * }} signals
 * @returns {{ tier: string, requires_two_person: boolean }}
 */
export function classifyAccountValueTier(signals = {}) {
  const threshold = Number.isFinite(Number(signals.credit_outstanding_threshold_minor))
    ? Number(signals.credit_outstanding_threshold_minor)
    : DEFAULT_CREDIT_OUTSTANDING_HIGH_VALUE_MINOR
  const outstanding = Number(signals.credit_outstanding_minor || 0)

  if (signals.is_platform_admin) {
    return {
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
    }
  }

  if (Number.isFinite(outstanding) && outstanding >= threshold) {
    return {
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
    }
  }

  const planClasses = Array.isArray(signals.agency_plan_classes)
    ? signals.agency_plan_classes
    : []

  if (signals.is_agency_owner && planClasses.some((c) => c === 'enterprise')) {
    return {
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
    }
  }

  // Owner but no readable subscription/tier → fail closed.
  if (signals.is_agency_owner && (signals.uncertain_agency_owner || !planClasses.length)) {
    return {
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
    }
  }

  if (signals.is_agency_owner && planClasses.some((c) => c === 'broker')) {
    return {
      tier: ACCOUNT_VALUE_TIERS.ELEVATED,
      requires_two_person: false,
    }
  }

  if (signals.is_pa_designate) {
    return {
      tier: ACCOUNT_VALUE_TIERS.ELEVATED,
      requires_two_person: false,
    }
  }

  return {
    tier: ACCOUNT_VALUE_TIERS.STANDARD,
    requires_two_person: false,
  }
}

function isPaDesignate(user) {
  if (!user) return false
  if (user.pa_designate === true || user.is_pa_designate === true) return true
  if (user.platform_designate === true) return true
  const data = user.data && typeof user.data === 'object' ? user.data : null
  if (data?.pa_designate === true || data?.is_pa_designate === true) return true
  if (data?.platform_designate === true) return true
  return false
}

function rowsOf(raw) {
  return Array.isArray(raw) ? raw : (raw?.rows || [])
}

/**
 * @param {string} userId - recovery applicant user id
 * @param {{
 *   queryFn?: typeof query,
 *   findUser?: typeof findUserById,
 *   creditOutstandingThresholdMinor?: number,
 * }} [opts]
 * @returns {Promise<{ tier: string, requires_two_person: boolean, signals: object }>}
 */
export async function deriveAccountValueTier(userId, opts = {}) {
  const queryFn = opts.queryFn || query
  const findUser = opts.findUser || findUserById
  const threshold = Number.isFinite(Number(opts.creditOutstandingThresholdMinor))
    ? Number(opts.creditOutstandingThresholdMinor)
    : DEFAULT_CREDIT_OUTSTANDING_HIGH_VALUE_MINOR

  const signals = {
    is_platform_admin: false,
    is_pa_designate: false,
    is_agency_owner: false,
    agency_tiers: [],
    agency_plan_classes: [],
    uncertain_agency_owner: false,
    credit_outstanding_minor: 0,
    credit_outstanding_threshold_minor: threshold,
  }

  if (!userId) {
    const classified = classifyAccountValueTier(signals)
    return { ...classified, signals }
  }

  const user = await findUser(userId)
  if (user?.platform_role === 'platform_admin') {
    signals.is_platform_admin = true
    const classified = classifyAccountValueTier(signals)
    return { ...classified, signals }
  }

  signals.is_pa_designate = isPaDesignate(user)

  // db.query returns rows[]; pg client.query returns { rows }.
  const ownershipRaw = await queryFn(
    `SELECT tm.tenant_id, tm.role
       FROM public.tenant_memberships tm
      WHERE tm.user_id = $1
        AND tm.role = 'owner'
        AND tm.status = 'active'
        AND tm.affiliation_mode IS DISTINCT FROM 'personal'
        AND tm.tenant_id LIKE 'agency:%'`,
    [String(userId)],
  )
  const ownerRows = rowsOf(ownershipRaw)
  if (!ownerRows.length) {
    const classified = classifyAccountValueTier(signals)
    return { ...classified, signals }
  }

  signals.is_agency_owner = true

  const tiersRaw = await queryFn(
    `SELECT DISTINCT pp.tier, pp.display_name
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
        AND tm.affiliation_mode IS DISTINCT FROM 'personal'
        AND tm.tenant_id LIKE 'agency:%'
        AND s.status = ANY($2::text[])`,
    [String(userId), OPEN_SUBSCRIPTION_STATUSES],
  )
  const tierRows = rowsOf(tiersRaw)
  const agencyTiers = tierRows.map((r) => r.tier).filter(Boolean)
  const planClasses = []
  for (const row of tierRows) {
    const fromTier = classifyPlanTier(row.tier)
    const fromName = classifyPlanTier(row.display_name)
    const chosen = fromTier !== 'unknown' ? fromTier : fromName
    if (chosen !== 'unknown' && !planClasses.includes(chosen)) {
      planClasses.push(chosen)
    }
  }
  signals.agency_tiers = agencyTiers
  signals.agency_plan_classes = planClasses

  if (!agencyTiers.length && !planClasses.length) {
    signals.uncertain_agency_owner = true
  }

  // AR outstanding on ISSUED/PART_PAID invoices for wallets owned by the agency.
  // Soft-fail to 0 when fin.invoices is unavailable in a given test DB shape.
  try {
    const outstandingRaw = await queryFn(
      `SELECT COALESCE(SUM(
                GREATEST(
                  i.total_minor - COALESCE(paid.qty, 0),
                  0
                )
              ), 0)::bigint AS outstanding_minor
         FROM public.tenant_memberships tm
         JOIN public.credit_wallets w
           ON (
             (w.scope = 'agency' AND (
               w.scope_id = REPLACE(tm.tenant_id, 'agency:', '')
               OR ('agency:' || w.scope_id) = tm.tenant_id
             ))
             OR w.tenant_id::text = tm.tenant_id
           )
         JOIN fin.invoices i ON i.tenant_id = w.tenant_id
         LEFT JOIN (
           SELECT invoice_id, SUM(amount_minor) AS qty
             FROM fin.invoice_payment_allocations
            GROUP BY invoice_id
         ) paid ON paid.invoice_id = i.id
        WHERE tm.user_id = $1
          AND tm.role = 'owner'
          AND tm.status = 'active'
          AND tm.affiliation_mode IS DISTINCT FROM 'personal'
          AND tm.tenant_id LIKE 'agency:%'
          AND i.status IN ('ISSUED', 'PART_PAID')`,
      [String(userId)],
    )
    const outstandingRows = rowsOf(outstandingRaw)
    signals.credit_outstanding_minor = Number(outstandingRows[0]?.outstanding_minor || 0)
  } catch {
    signals.credit_outstanding_minor = 0
  }

  const classified = classifyAccountValueTier(signals)
  return { ...classified, signals }
}

/** @param {string} tier */
export function requiresTwoPersonForTier(tier) {
  return tier === ACCOUNT_VALUE_TIERS.HIGH_VALUE
}
