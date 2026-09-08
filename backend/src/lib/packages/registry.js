/**
 * Feature registry query helpers. Seed data lives in migration 303.
 */
export async function listMeteredFeatures(client, { activeOnly = true } = {}) {
  const { rows } = await client.query(
    `SELECT * FROM public.metered_features
      WHERE ($1::boolean IS NOT TRUE OR active = true)
      ORDER BY code`,
    [activeOnly],
  )
  return rows
}

export async function getFeatureByCode(client, code) {
  const { rows } = await client.query(
    `SELECT * FROM public.metered_features WHERE code = $1`,
    [code],
  )
  return rows[0] || null
}

export const FREE_TIER_PACKAGE_CODES = Object.freeze({
  agent: 'free-agent',
  agency: 'free-agency',
})

export function freeTierPackageCode(audience = 'agent') {
  return audience === 'agency' ? FREE_TIER_PACKAGE_CODES.agency : FREE_TIER_PACKAGE_CODES.agent
}

export function freeTierAudienceForScope(scope) {
  return scope === 'agency' ? 'agency' : 'agent'
}

/**
 * Resolve the published free-tier package for an audience.
 * Agent personal tenants use `free-agent` (migration 304).
 * Agency tenants use `free-agency` (migration 319).
 */
export async function getFreeTierPackage(client, { audience = 'agent' } = {}) {
  const code = freeTierPackageCode(audience)
  const { rows } = await client.query(
    `SELECT p.*, v.id AS version_id, v.version_number, v.state AS version_state,
            v.properties_covered, v.monthly_price_minor, v.effective_from, v.effective_to
       FROM public.product_packages p
       JOIN public.product_package_versions v ON v.package_id = p.id
      WHERE p.code = $1
        AND v.state = 'PUBLISHED'
      ORDER BY v.version_number DESC
      LIMIT 1`,
    [code],
  )
  return rows[0] || null
}

export const SEEDED_FEATURE_CODES = [
  'publishing.social.instagram',
  'publishing.social.facebook',
  'publishing.social.tiktok',
  'publishing.social.x',
  'publishing.social.linkedin',
  'publishing.social.whatsapp',
  'publishing.realestate.olx',
  'publishing.realestate.property_finder',
  'publishing.realestate.bayut',
  'publishing.realestate.dubizzle',
  'communication.whatsapp.conversation_window_24h',
  'communication.sms.per_message',
  'ai.post_creation',
  'ai.listings_describe',
  'ai.contact_lead_score',
  'ai.contact_lead_summary',
  'ai.comment_classifier',
  'ai.area_scoring',
  'ai.market_pricing_analysis',
  'ai.property_rating',
  'ai.lead_gen_activation',
  'assets.render.social_card',
]

export const FREE_TIER_FLAG_CODES = [
  'crm.contacts',
  'crm.tasks',
  'crm.opportunities',
  'listings.crud',
]
