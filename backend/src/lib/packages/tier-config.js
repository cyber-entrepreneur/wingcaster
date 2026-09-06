/**
 * Marketing-display view of the active tier catalog.
 *
 * Display-layer only. Does not grant entitlements, meter credits, or
 * provision subscriptions. Billing continues to use properties_covered,
 * monthly_price_minor, package_feature_quotas, and package_feature_flags.
 */
import { z } from 'zod'

export const PRICING_CURRENCY = 'USD'

export const PORTAL_SCOPES = [
  'single_pick',
  'top_three_in_market',
  'all_in_market',
  'primary_plus_secondary',
  'all_mena_phase_1',
  'all_plus_priority',
]

export const SUPPORT_LEVELS = [
  'email',
  'email_chat',
  'dedicated',
  'dedicated_slack',
]

export const PortalGroupSchema = z.object({
  id: z.string().min(1),
  display_name: z.string().min(1),
  description: z.string().nullable(),
  portal_scope: z.enum(PORTAL_SCOPES),
})

export const PriceSchema = z.object({
  monthly_usd: z.number(),
  annual_usd: z.number(),
  currency: z.literal(PRICING_CURRENCY),
})

export const TierConfigSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  display_name: z.string().min(1),
  tagline: z.string().nullable(),
  agent_cap: z.number().int().nullable(),
  property_cap: z.number().int(),
  price: PriceSchema,
  trial_days: z.number().int().nonnegative(),
  sales_led: z.boolean(),
  portal_group: PortalGroupSchema,
  feature_quotas: z.record(z.number()),
  feature_toggles: z.record(z.boolean()),
  support_level: z.enum(SUPPORT_LEVELS),
  sort_order: z.number().int(),
})

export function minorToUsd(minor) {
  return Number(minor) / 100
}

function asIntOrNull(value) {
  return value == null ? null : Number(value)
}

function asNumberRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, Number(entry)]),
  )
}

function asBooleanRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, Boolean(entry)]),
  )
}

export function mapTierRow(row) {
  return {
    id: String(row.package_id),
    code: row.code,
    display_name: row.display_name,
    tagline: row.tagline ?? null,
    agent_cap: asIntOrNull(row.agent_cap),
    property_cap: Number(row.property_cap),
    price: {
      monthly_usd: minorToUsd(row.price_usd_monthly_minor),
      annual_usd: minorToUsd(row.price_usd_annual_minor),
      currency: PRICING_CURRENCY,
    },
    trial_days: Number(row.trial_days || 0),
    sales_led: Boolean(row.sales_led),
    portal_group: {
      id: row.portal_group_id,
      display_name: row.portal_display_name,
      description: row.portal_description ?? null,
      portal_scope: row.portal_scope,
    },
    feature_quotas: asNumberRecord(row.feature_quotas),
    feature_toggles: asBooleanRecord(row.feature_toggles),
    support_level: row.support_level,
    sort_order: Number(row.sort_order),
  }
}

const CATALOG_SQL = `
  SELECT catalog.*
    FROM (
      SELECT DISTINCT ON (p.id)
             p.id AS package_id,
             p.code,
             v.display_name,
             v.tagline,
             v.agent_cap,
             v.property_cap,
             v.price_usd_monthly_minor,
             v.price_usd_annual_minor,
             v.trial_days,
             v.sales_led,
             v.feature_quotas,
             v.feature_toggles,
             v.support_level,
             v.sort_order,
             g.id AS portal_group_id,
             g.display_name AS portal_display_name,
             g.description AS portal_description,
             g.portal_scope
        FROM public.product_packages p
        JOIN public.product_package_versions v ON v.package_id = p.id
        JOIN public.portal_groups g ON g.id = v.portal_group_id
       WHERE p.active = true
         AND v.state = 'PUBLISHED'
         AND COALESCE(v.effective_from, '-infinity'::timestamptz) <= NOW()
         AND (v.effective_to IS NULL OR v.effective_to > NOW())
         AND v.sort_order IS NOT NULL
         AND v.display_name IS NOT NULL
         AND v.property_cap IS NOT NULL
       ORDER BY p.id, v.version_number DESC
    ) catalog
   ORDER BY catalog.sort_order ASC, catalog.code ASC
`

/**
 * Ordered list of ACTIVE marketing tiers (package.active + PUBLISHED
 * version with marketing fields). No in-process cache — callers always
 * see the latest rows.
 */
export async function getActiveTierCatalog(client) {
  const { rows } = await client.query(CATALOG_SQL)
  return rows.map((row) => TierConfigSchema.parse(mapTierRow(row)))
}
