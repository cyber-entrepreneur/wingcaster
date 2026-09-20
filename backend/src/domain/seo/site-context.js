/**
 * Wave 2F — resolve WingCaster-served site context from agency_site_config + agencies.
 *
 * Production white-label config lives in public.agency_site_config (mig 469).
 * Subdomain routing uses agencies.slug — not the legacy white_label_sites collection.
 */

import { findAll, findOne } from '../../persistence/index.js'

function isWhiteLabelActive(agency, config) {
  if (!agency) return false
  if (agency.site_hosting_type === 'whitelabel') return true
  if (config?.published_at) return true
  return false
}

export function buildSiteContext(agency, config) {
  if (!isWhiteLabelActive(agency, config)) return null
  return {
    agency_id: agency.id,
    subdomain: agency.slug || null,
    custom_domain: config?.custom_domain || null,
    published_at: config?.published_at || null,
    site_hosting_type: agency.site_hosting_type || 'none',
    config,
    agency,
  }
}

export async function getAgencySiteContext(agencyId) {
  if (!agencyId) return null
  const agency = await findOne('agencies', (a) => a.id === agencyId)
  if (!agency) return null
  const config = await findOne('agency_site_config', (c) => c.agency_id === agencyId)
  return buildSiteContext(agency, config)
}

export async function getAgencySiteContextBySubdomain(subdomain) {
  if (!subdomain) return null
  const agency = await findOne('agencies', (a) => a.slug === subdomain)
  if (!agency) return null
  const config = await findOne('agency_site_config', (c) => c.agency_id === agency.id)
  return buildSiteContext(agency, config)
}

/**
 * Free/independent agents may operate a solo agency they own with white-label hosting.
 */
export async function getAgentOwnWhiteLabelSite(agentId) {
  const agent = await findOne('agents', (a) => a.id === agentId)
  if (!agent?.user_id) return null

  const ownedAgencies = await findAll('agencies', (a) => a.owner_id === agent.user_id)
  for (const agency of ownedAgencies) {
    const ctx = await getAgencySiteContext(agency.id)
    if (ctx) return ctx
  }
  return null
}
