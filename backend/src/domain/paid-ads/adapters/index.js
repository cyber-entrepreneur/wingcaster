/**
 * Wave 2A — paid ads provider interface (mirrors Creative Asset Service factory).
 */

import { MetaAdsAdapter } from './meta-ads.js'
import { GoogleAdsAdapter } from './google-ads.js'
import { PAID_PLATFORMS } from '../constants.js'

/**
 * @typedef {object} CreatePaidCampaignInput
 * @property {string} name
 * @property {string} objective — WingCaster vocab (awareness|traffic|…)
 * @property {string} providerObjective — mapped provider enum
 * @property {number} budgetMicros
 * @property {string} currency
 * @property {object} targeting
 * @property {object|null} schedule
 * @property {string} accessToken
 * @property {string} adAccountId — Meta act_… or Google customer id
 * @property {string} [developerToken] — Google Ads
 * @property {string} [loginCustomerId] — Google Ads MCC
 * @property {string} [format] — e.g. demand_gen_gmail
 * @property {string} [creativeUrl]
 * @property {string} [landingUrl]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {object} CreatePaidCampaignResult
 * @property {string} provider
 * @property {string} provider_campaign_id
 * @property {string|null} provider_ref
 * @property {object} raw
 */

/**
 * @param {string} platform
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export function createPaidAdsAdapter(platform, opts = {}) {
  if (!PAID_PLATFORMS.includes(platform)) {
    throw Object.assign(new Error(`Unsupported paid platform: ${platform}`), {
      code: 'UNSUPPORTED_PAID_PLATFORM',
    })
  }
  if (platform === 'meta_ads') return new MetaAdsAdapter(opts)
  return new GoogleAdsAdapter(opts)
}
