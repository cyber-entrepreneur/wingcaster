/**
 * Wave 2A — provider approval gate (external Meta/Google app-review clock).
 * Defaults OFF. Never stub-succeed when unapproved.
 */

import { PAID_PLATFORMS, PROVIDER_NOT_APPROVED } from './constants.js'

function envTruthy(name) {
  const v = process.env[name]
  return v === '1' || v === 'true' || v === 'TRUE' || v === 'yes'
}

/**
 * Platform-level WingCaster app approval (business verification + app review).
 * Independent of tenant OAuth connection health.
 */
export function isProviderApproved(platform) {
  if (platform === 'meta_ads') {
    return envTruthy('META_ADS_PROVIDER_APPROVED')
  }
  if (platform === 'google_ads') {
    return envTruthy('GOOGLE_ADS_PROVIDER_APPROVED')
  }
  return false
}

export function assertProviderApproved(platform) {
  if (!PAID_PLATFORMS.includes(platform)) {
    throw Object.assign(new Error(`Unsupported paid platform: ${platform}`), {
      code: 'UNSUPPORTED_PAID_PLATFORM',
    })
  }
  if (!isProviderApproved(platform)) {
    throw Object.assign(
      new Error(
        `${platform} is not approved for live delivery yet (business verification / app review pending)`,
      ),
      { code: PROVIDER_NOT_APPROVED, status: 503 },
    )
  }
}

export function providerApprovalState(platform) {
  return {
    platform,
    approved: isProviderApproved(platform),
    state: isProviderApproved(platform) ? 'approved' : 'pending_approval',
    message: isProviderApproved(platform)
      ? 'Provider approved for live ad delivery'
      : 'Connect your ad account; live delivery waits on Meta/Google app review',
  }
}
