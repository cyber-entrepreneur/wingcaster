/**
 * Registered feature identifiers for the platform credit engine.
 * Codes match public.metered_features seeded in migration 303.
 * `whatsapp-listings` is the PR A compat alias used by the intake pipeline.
 *
 * Real-estate portal features are also registered dynamically from
 * `portal_registry` at boot (see registerPortalFeaturesFromRows). Static
 * PUBLISHING_REALESTATE_* entries remain as bootstrap defaults so imports
 * work before boot and offline unit tests stay green.
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

function rebuildFeatureList() {
  return Object.values(FEATURES)
}

export let FEATURE_LIST = rebuildFeatureList()

/** `publishing.realestate.<code>` — Option 2 keeps one feature code per portal. */
export function portalFeatureCode(code) {
  return `publishing.realestate.${String(code).trim().toLowerCase()}`
}

/** FEATURES object key for a portal code, e.g. bayut → PUBLISHING_REALESTATE_BAYUT */
export function portalFeatureKey(code) {
  const normalized = String(code).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  return `PUBLISHING_REALESTATE_${normalized}`
}

/**
 * Register (or refresh) a portal metered-feature code on FEATURES / FEATURE_LIST.
 * Does not touch billing/subscription logic — wiring only.
 */
export function registerPortalFeature(code) {
  if (!code) throw new Error('portal code is required')
  const featureCode = portalFeatureCode(code)
  const key = portalFeatureKey(code)
  FEATURES[key] = featureCode
  FEATURE_LIST = rebuildFeatureList()
  return featureCode
}

/**
 * Sync FEATURES from active portal_registry rows.
 * Inactive seed rows keep the four bootstrap constants; a later activate
 * picks up PUBLISHING_REALESTATE_<CODE> automatically.
 */
export function registerPortalFeaturesFromRows(rows) {
  const codes = []
  for (const row of rows || []) {
    if (!row?.code) continue
    if (!row.is_active) continue
    codes.push(registerPortalFeature(row.code))
  }
  return codes
}

async function ensureMeteredFeature(row) {
  const { createHash } = await import('node:crypto')
  const { query } = await import('../../db.js')
  const code = portalFeatureCode(row.code)
  const hex = createHash('md5').update(code).digest('hex')
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
  await query(
    `INSERT INTO public.metered_features (
       id, code, display_name, category, meter_unit, cost_source,
       credits_per_unit, active, data
     ) VALUES (
       $1, $2, $3, 'publishing.realestate', 'post', 'platform_bulk',
       100, true, $4::jsonb
     )
     ON CONFLICT (code) DO UPDATE SET
       data = public.metered_features.data || EXCLUDED.data,
       updated_at = NOW()`,
    [
      id,
      code,
      `${row.display_name || row.code} publish`,
      JSON.stringify({
        portal: row.code,
        source: 'portal_registry',
        regions: Array.isArray(row.country_codes) ? row.country_codes : [],
      }),
    ],
  )
}

/**
 * Load active portal_registry rows and register FEATURES + metered_features.
 * Intended for boot and tests.
 */
export async function refreshPortalFeatures() {
  let rows
  try {
    const { listPortalRegistry } = await import('../portals/store.js')
    rows = await listPortalRegistry({ activeOnly: true })
  } catch {
    FEATURE_LIST = rebuildFeatureList()
    return []
  }
  const codes = registerPortalFeaturesFromRows(rows)
  for (const row of rows) {
    await ensureMeteredFeature(row)
  }
  FEATURE_LIST = rebuildFeatureList()
  return codes
}

/** Test helper — drop dynamically added portal keys (keeps bootstrap four). */
export function resetDynamicPortalFeaturesForTests() {
  const bootstrap = new Set([
    'PUBLISHING_REALESTATE_OLX',
    'PUBLISHING_REALESTATE_PROPERTY_FINDER',
    'PUBLISHING_REALESTATE_BAYUT',
    'PUBLISHING_REALESTATE_DUBIZZLE',
  ])
  for (const key of Object.keys(FEATURES)) {
    if (key.startsWith('PUBLISHING_REALESTATE_') && !bootstrap.has(key)) {
      delete FEATURES[key]
    }
  }
  FEATURE_LIST = rebuildFeatureList()
}
