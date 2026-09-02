/**
 * Per-credit unit pricing used for approval-threshold math and margin reporting.
 *
 * CREDITS_PER_CREDIT_MICRO_USD default 100 = $0.0001 / integer credit unit.
 * Compat layer scales legacy NUMERIC amounts by CREDIT_SCALE (100), so one
 * historical "1.00 credit" is 100 units ≈ $0.01 at the default rate.
 */
export const DEFAULT_PER_CREDIT_MICRO_USD = 100
export const DEFAULT_APPROVAL_THRESHOLD_MICRO_USD = 10_000_000

export function perCreditMicroUsd() {
  const raw = Number(process.env.CREDITS_PER_CREDIT_MICRO_USD)
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : DEFAULT_PER_CREDIT_MICRO_USD
}

export function approvalThresholdMicroUsd() {
  const raw = Number(process.env.CREDITS_ADJUSTMENT_APPROVAL_THRESHOLD_MICRO_USD)
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : DEFAULT_APPROVAL_THRESHOLD_MICRO_USD
}

export function grantCostMicroUsd(amount) {
  return BigInt(amount) * BigInt(perCreditMicroUsd())
}

export function grantRequiresApproval(source, amount) {
  if (source !== 'adjustment.correction' && source !== 'goodwill') return false
  return grantCostMicroUsd(amount) > BigInt(approvalThresholdMicroUsd())
}
