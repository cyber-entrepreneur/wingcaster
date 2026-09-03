/**
 * Registered feature identifiers for the platform credit engine.
 * Codes match public.metered_features seeded in migration 303.
 * `whatsapp-listings` is the PR A compat alias used by the intake pipeline.
 */
export const FEATURES = {
  WHATSAPP_LISTINGS: 'whatsapp-listings',
  PUBLISHING_SOCIAL_INSTAGRAM: 'publishing.social.instagram',
  PUBLISHING_SOCIAL_FACEBOOK: 'publishing.social.facebook',
  PUBLISHING_SOCIAL_TIKTOK: 'publishing.social.tiktok',
  PUBLISHING_SOCIAL_X: 'publishing.social.x',
  PUBLISHING_SOCIAL_LINKEDIN: 'publishing.social.linkedin',
  PUBLISHING_SOCIAL_WHATSAPP: 'publishing.social.whatsapp',
  PUBLISHING_REALESTATE_OLX: 'publishing.realestate.olx',
  PUBLISHING_REALESTATE_PROPERTY_FINDER: 'publishing.realestate.property_finder',
  PUBLISHING_REALESTATE_BAYUT: 'publishing.realestate.bayut',
  PUBLISHING_REALESTATE_DUBIZZLE: 'publishing.realestate.dubizzle',
  COMMUNICATION_WHATSAPP_CONVERSATION_WINDOW_24H: 'communication.whatsapp.conversation_window_24h',
  COMMUNICATION_SMS_PER_MESSAGE: 'communication.sms.per_message',
  AI_POST_CREATION: 'ai.post_creation',
  AI_LISTINGS_DESCRIBE: 'ai.listings_describe',
  AI_CONTACT_LEAD_SCORE: 'ai.contact_lead_score',
  AI_CONTACT_LEAD_SUMMARY: 'ai.contact_lead_summary',
  AI_COMMENT_CLASSIFIER: 'ai.comment_classifier',
  AI_AREA_SCORING: 'ai.area_scoring',
  AI_MARKET_PRICING_ANALYSIS: 'ai.market_pricing_analysis',
  AI_PROPERTY_RATING: 'ai.property_rating',
  AI_LEAD_GEN_ACTIVATION: 'ai.lead_gen_activation',
  ASSETS_RENDER_SOCIAL_CARD: 'assets.render.social_card',
}

export const FEATURE_LIST = Object.values(FEATURES)
