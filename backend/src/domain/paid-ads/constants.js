/**
 * Wave 2A — Paid ads constants (Meta + Google / Demand Gen).
 */

export const PAID_PLATFORMS = Object.freeze(['meta_ads', 'google_ads'])

export const PAID_AD_OBJECTIVES = Object.freeze([
  'awareness',
  'traffic',
  'engagement',
  'leads',
  'conversions',
])

/** Google Demand Gen formats — Gmail is a placement, NOT a separate channel. */
export const GOOGLE_DEMAND_GEN_FORMATS = Object.freeze([
  'demand_gen',
  'demand_gen_gmail',
  'demand_gen_youtube',
  'demand_gen_discover',
])

export const PAID_FEATURE_CODES = Object.freeze({
  meta_ads: 'publishing.paid.meta_ads',
  google_ads: 'publishing.paid.google_ads',
})

export const META_OBJECTIVE_MAP = Object.freeze({
  awareness: 'OUTCOME_AWARENESS',
  traffic: 'OUTCOME_TRAFFIC',
  engagement: 'OUTCOME_ENGAGEMENT',
  leads: 'OUTCOME_LEADS',
  conversions: 'OUTCOME_SALES',
})

export const GOOGLE_OBJECTIVE_MAP = Object.freeze({
  awareness: 'BRAND_AWARENESS',
  traffic: 'WEBSITE_TRAFFIC',
  engagement: 'ENGAGEMENT',
  leads: 'LEAD_GENERATION',
  conversions: 'SALES',
})

export const PROVIDER_NOT_APPROVED = 'PROVIDER_NOT_APPROVED'
export const PAID_CHANNEL_KIND = 'paid'
export const PAID_EXECUTION_KIND = 'paid_ad'
