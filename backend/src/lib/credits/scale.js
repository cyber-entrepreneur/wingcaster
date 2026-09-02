/**
 * Legacy NUMERIC(12,6) credits → BIGINT units.
 * Scale 100 preserves the two-decimal costs used by whatsapp-listings
 * (0.05 extraction, 0.02 caption) without inflating approval-threshold math.
 */
export const CREDIT_SCALE = 100

export function toCreditUnits(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.max(0, Math.round(n * CREDIT_SCALE))
}

export function fromCreditUnits(units) {
  return Number(units || 0) / CREDIT_SCALE
}
