/**
 * Platform CFG reads for vendor admin. Key seeded in migration 313.
 */
import { query } from '../../../db.js'

export const VENDOR_RATE_APPROVAL_THRESHOLD_KEY = 'VENDOR_RATE_APPROVAL_THRESHOLD_PCT'
export const DEFAULT_VENDOR_RATE_APPROVAL_THRESHOLD_PCT = 20.0

export async function getPlatformConfig(key) {
  const rows = await query(
    `SELECT value FROM platform_configuration WHERE key = $1`,
    [key],
  )
  return rows[0]?.value ?? null
}

export async function getVendorRateApprovalThresholdPct() {
  const raw = await getPlatformConfig(VENDOR_RATE_APPROVAL_THRESHOLD_KEY)
  const n = Number(raw?.value ?? raw)
  return Number.isFinite(n) ? n : DEFAULT_VENDOR_RATE_APPROVAL_THRESHOLD_PCT
}
