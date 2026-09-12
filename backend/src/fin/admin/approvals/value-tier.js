/** BE-APR-EXEC value-tier for fin approvals (NOT account-recovery ACR). */

import { VALUE_TIERS } from './workflow-map.js'

export const HIGH_VALUE_AMOUNT_MINOR = Number(
  process.env.FIN_APPROVAL_HIGH_VALUE_AMOUNT_MINOR || 25_000,
)

export const ELEVATED_AMOUNT_MINOR = Number(
  process.env.FIN_APPROVAL_ELEVATED_AMOUNT_MINOR || 5_000,
)

const ALWAYS_HIGH_VALUE = new Set([
  'PLATFORM_ADMIN_RECOVERY', 'AUDIT_RETENTION', 'MASS_OPERATION', 'LARGE_REFUND',
])

const ALWAYS_ELEVATED = new Set([
  'FACILITY_OPS', 'WRITE_OFF', 'VENDOR_RATE_CHANGE', 'NEGATIVE_ADJUSTMENT',
  'RECONCILIATION_OVERRIDE', 'VENDOR_VARIANCE_OVERRIDE', 'PACKAGE_PUBLISH',
  'INVOICE_VOID', 'BACKDATED_AMENDMENT', 'PRICE_REPORT_INCORPORATE', 'COMPARABLE_REMOVE',
])

function amountFromPayload(payload = {}) {
  const candidates = [
    payload.amount_minor, payload.amountMinor, payload.units,
    payload.grant_units, payload.grantUnits,
    payload.impact_summary?.monthly_cost_delta_micro_usd,
    payload.payload?.units, payload.payload?.amount_minor,
  ]
  for (const c of candidates) {
    const n = Number(c)
    if (Number.isFinite(n) && n !== 0) return Math.abs(n)
  }
  return 0
}

export function evaluateApprovalValueTier(row = {}) {
  if (row.value_tier && Object.values(VALUE_TIERS).includes(row.value_tier)) {
    return {
      tier: row.value_tier,
      requires_two_person: row.value_tier === VALUE_TIERS.HIGH_VALUE
        || Number(row.min_distinct_approvers || 1) >= 2,
      amount_minor: amountFromPayload(row.payload || {}),
    }
  }

  const kind = row.action_kind
  const amount = amountFromPayload(row.payload || {})

  if (ALWAYS_HIGH_VALUE.has(kind)) {
    return { tier: VALUE_TIERS.HIGH_VALUE, requires_two_person: true, amount_minor: amount }
  }
  if (kind === 'LARGE_GRANT') {
    if (amount >= HIGH_VALUE_AMOUNT_MINOR) {
      return { tier: VALUE_TIERS.HIGH_VALUE, requires_two_person: true, amount_minor: amount }
    }
    if (amount >= ELEVATED_AMOUNT_MINOR) {
      return { tier: VALUE_TIERS.ELEVATED, requires_two_person: true, amount_minor: amount }
    }
    return { tier: VALUE_TIERS.STANDARD, requires_two_person: false, amount_minor: amount }
  }
  if (ALWAYS_ELEVATED.has(kind)) {
    return { tier: VALUE_TIERS.ELEVATED, requires_two_person: true, amount_minor: amount }
  }
  if (Number(row.min_distinct_approvers || 1) >= 2) {
    return { tier: VALUE_TIERS.ELEVATED, requires_two_person: true, amount_minor: amount }
  }
  return { tier: VALUE_TIERS.STANDARD, requires_two_person: false, amount_minor: amount }
}
