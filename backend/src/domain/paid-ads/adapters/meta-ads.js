/**
 * Meta Marketing API adapter — real Graph API calls when approved + credentialed.
 * Docs: https://developers.facebook.com/docs/marketing-api/reference/ad-account/campaigns
 */

import { assertProviderApproved } from '../approval.js'
import { mapObjectiveForProvider } from '../objectives.js'

const GRAPH_VERSION = () => process.env.META_GRAPH_VERSION || 'v21.0'
const GRAPH_BASE = () => `https://graph.facebook.com/${GRAPH_VERSION()}`

export class MetaAdsAdapter {
  /**
   * @param {{ fetchImpl?: typeof fetch }} [opts]
   */
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    this.fetchImpl = fetchImpl
    this.platform = 'meta_ads'
  }

  get name() {
    return 'meta_ads'
  }

  /**
   * @param {import('./index.js').CreatePaidCampaignInput} input
   * @returns {Promise<import('./index.js').CreatePaidCampaignResult>}
   */
  async createCampaign(input) {
    assertProviderApproved('meta_ads')

    const accessToken = input.accessToken
    const adAccountId = normalizeMetaAdAccountId(input.adAccountId)
    if (!accessToken) {
      throw Object.assign(new Error('Meta Ads access token missing'), {
        code: 'MISSING_PAID_CREDENTIALS',
      })
    }
    if (!adAccountId) {
      throw Object.assign(new Error('Meta Ads ad account id missing'), {
        code: 'MISSING_AD_ACCOUNT',
      })
    }

    const objective = input.providerObjective
      || mapObjectiveForProvider('meta_ads', input.objective)
    const body = new URLSearchParams()
    body.set('name', input.name || `WingCaster ${input.objective}`)
    body.set('objective', objective)
    body.set('status', 'PAUSED') // never auto-activate; connect-ready shell
    body.set('special_ad_categories', '[]')
    body.set('access_token', accessToken)
    if (input.budgetMicros != null) {
      // Lifetime budget in cents for Meta is approximate; store micros in our model.
      body.set('daily_budget', String(Math.max(100, Math.round(Number(input.budgetMicros) / 10_000))))
    }

    const url = `${GRAPH_BASE()}/act_${adAccountId}/campaigns`
    const res = await this.fetchImpl(url, {
      method: 'POST',
      body,
      signal: input.signal,
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok || payload?.error) {
      throw Object.assign(
        new Error(payload?.error?.message || `Meta Ads campaign create failed: ${res.status}`),
        { code: 'META_ADS_API_ERROR', details: payload, status: res.status },
      )
    }

    const campaignId = String(payload.id || '')
    return {
      provider: 'meta_marketing_api',
      provider_campaign_id: campaignId,
      provider_ref: campaignId ? `meta_ads:campaign:${campaignId}` : null,
      raw: payload,
    }
  }
}

function normalizeMetaAdAccountId(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  return s.replace(/^act_/i, '')
}
