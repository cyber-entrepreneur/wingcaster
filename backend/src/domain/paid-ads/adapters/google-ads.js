/**
 * Google Ads API adapter — real REST calls when approved + credentialed.
 * Gmail reach uses Demand Gen (advertising_channel_type DEMAND_GEN), never owned email.
 * Docs: https://developers.google.com/google-ads/api/docs/campaigns/overview
 */

import { assertProviderApproved } from '../approval.js'
import { mapObjectiveForProvider } from '../objectives.js'
import { GOOGLE_DEMAND_GEN_FORMATS } from '../constants.js'

const ADS_API_VERSION = () => process.env.GOOGLE_ADS_API_VERSION || 'v18'
const ADS_BASE = () => `https://googleads.googleapis.com/${ADS_API_VERSION()}`

export class GoogleAdsAdapter {
  /**
   * @param {{ fetchImpl?: typeof fetch }} [opts]
   */
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    this.fetchImpl = fetchImpl
    this.platform = 'google_ads'
  }

  get name() {
    return 'google_ads'
  }

  /**
   * @param {import('./index.js').CreatePaidCampaignInput} input
   * @returns {Promise<import('./index.js').CreatePaidCampaignResult>}
   */
  async createCampaign(input) {
    assertProviderApproved('google_ads')

    const accessToken = input.accessToken
    const customerId = normalizeCustomerId(input.adAccountId)
    const developerToken = input.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || ''
    if (!accessToken) {
      throw Object.assign(new Error('Google Ads access token missing'), {
        code: 'MISSING_PAID_CREDENTIALS',
      })
    }
    if (!customerId) {
      throw Object.assign(new Error('Google Ads customer id missing'), {
        code: 'MISSING_AD_ACCOUNT',
      })
    }
    if (!developerToken) {
      throw Object.assign(new Error('Google Ads developer token missing'), {
        code: 'MISSING_DEVELOPER_TOKEN',
      })
    }

    const format = input.format || input.targeting?.format || null
    if (format === 'gmail' || format === 'owned_email' || format === 'email_blast') {
      throw Object.assign(
        new Error('Gmail reach requires format=demand_gen_gmail (Demand Gen), not owned email'),
        { code: 'INVALID_GMAIL_FORMAT' },
      )
    }

    const advertisingChannelType = resolveGoogleChannelType(format)
    const objective = input.providerObjective
      || mapObjectiveForProvider('google_ads', input.objective)

    const resourceName = `customers/${customerId}/campaigns/-1`
    const campaignOperation = {
      create: {
        resourceName,
        name: input.name || `WingCaster ${input.objective}`,
        status: 'PAUSED',
        advertisingChannelType,
        // Demand Gen Gmail is a channel subtype placement, not a separate WingCaster channel.
        ...(format === 'demand_gen_gmail'
          ? { advertisingChannelSubType: 'DEMAND_GEN' }
          : {}),
        campaignBudget: `customers/${customerId}/campaignBudgets/-1`,
        // Objective mapped into MaximizeConversions / targeting later; stored for audit.
        // Google uses bidding strategies rather than Meta-style objectives.
      },
    }

    const url = `${ADS_BASE()}/customers/${customerId}/campaigns:mutate`
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    }
    if (input.loginCustomerId) {
      headers['login-customer-id'] = normalizeCustomerId(input.loginCustomerId)
    }

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operations: [campaignOperation],
      }),
      signal: input.signal,
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok || payload?.error) {
      throw Object.assign(
        new Error(
          payload?.error?.message
          || payload?.error?.status
          || `Google Ads campaign create failed: ${res.status}`,
        ),
        { code: 'GOOGLE_ADS_API_ERROR', details: payload, status: res.status },
      )
    }

    const result = payload?.results?.[0] || payload?.partialFailureError || {}
    const campaignResource = result.resourceName || result.campaign?.resourceName || null
    const campaignId = campaignResource
      ? String(campaignResource).split('/').pop()
      : null

    return {
      provider: 'google_ads_api',
      provider_campaign_id: campaignId || '',
      provider_ref: campaignResource
        ? `google_ads:campaign:${campaignResource}`
        : (campaignId ? `google_ads:campaign:${campaignId}` : null),
      raw: payload,
      format: format && GOOGLE_DEMAND_GEN_FORMATS.includes(format) ? format : advertisingChannelType,
    }
  }
}

function normalizeCustomerId(raw) {
  if (!raw) return null
  return String(raw).replace(/-/g, '').trim()
}

function resolveGoogleChannelType(format) {
  if (!format) return 'SEARCH'
  if (GOOGLE_DEMAND_GEN_FORMATS.includes(format) || String(format).startsWith('demand_gen')) {
    return 'DEMAND_GEN'
  }
  const upper = String(format).toUpperCase()
  if (['SEARCH', 'DISPLAY', 'VIDEO', 'PERFORMANCE_MAX', 'DEMAND_GEN'].includes(upper)) {
    return upper
  }
  return 'SEARCH'
}
