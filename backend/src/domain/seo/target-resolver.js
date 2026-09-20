/**
 * Wave 2F — resolve canonical SEO surface for an agent/listing.
 */

import { findAll, findOne } from '../../persistence/index.js'
import { getActiveAgencyForUser } from '../../platformModel.js'
import { withTenant } from '../../lib/growth-os/index.js'
import { getSeoTargetPreference } from './repository.js'
import { getAgencySiteContext, getAgentOwnWhiteLabelSite } from './site-context.js'

async function agentHasExternalSite(agentId, agencyId) {
  const agent = await findOne('agents', (a) => a.id === agentId)
  const website = agent?.website || agent?.data?.website
  if (website) return { url: website, source: 'agent_profile' }

  if (agencyId) {
    const agency = await findOne('agencies', (a) => a.id === agencyId)
    if (agency?.site_hosting_type === 'external' && agency?.website) {
      return { url: agency.website, source: 'agency_external' }
    }
  }

  const syncConns = await findAll('sync_connections', (c) => {
    if (c.agent_id !== agentId) return false
    if (agencyId && c.agency_id && c.agency_id !== agencyId) return false
    const config = typeof c.config === 'string' ? JSON.parse(c.config || '{}') : (c.config || {})
    return Boolean(config.url || config.endpoint)
  })
  if (syncConns.length) {
    const config = typeof syncConns[0].config === 'string'
      ? JSON.parse(syncConns[0].config || '{}')
      : (syncConns[0].config || {})
    const url = config.url || config.endpoint
    if (url) return { url, source: 'sync_connection' }
  }

  return null
}

function isAgencyTagged(property, agency) {
  if (!agency) return false
  if (property.agency_id === agency.id) return true
  if (property.agency_tied === true || property.agency_tied === 1) return true
  if (property.listing_owner_type === 'agency') return true
  return false
}

/**
 * Resolve the canonical SEO target surface for a property.
 */
export async function resolveSeoTarget({
  property,
  agentId,
  agencyId = null,
  preference = null,
} = {}) {
  if (!property?.id || !agentId) {
    throw Object.assign(new Error('property and agentId are required'), { code: 'MISSING_SEO_CONTEXT' })
  }

  const agency = agencyId
    ? await findOne('agencies', (a) => a.id === agencyId)
    : await getActiveAgencyForUser(agentId)

  const effectiveAgencyId = agency?.id || property.agency_id || null

  if (isAgencyTagged(property, agency)) {
    const site = await getAgencySiteContext(effectiveAgencyId)
    return {
      target_surface: 'agency_white_label',
      resolved: true,
      can_toggle: false,
      available_surfaces: ['agency_white_label'],
      subdomain: site?.subdomain || null,
      custom_domain: site?.custom_domain || null,
      agency_id: effectiveAgencyId,
      agent_id: agentId,
    }
  }

  const ownWhiteLabel = await getAgentOwnWhiteLabelSite(agentId)
  const external = await agentHasExternalSite(agentId, effectiveAgencyId)

  const available = []
  if (ownWhiteLabel) available.push('own_white_label')
  if (external) available.push('external_site')
  if (!ownWhiteLabel && !external) available.push('bazaar')

  let targetSurface = 'bazaar'
  if (preference?.target_surface && available.includes(preference.target_surface)) {
    targetSurface = preference.target_surface
  } else if (ownWhiteLabel && !external) {
    targetSurface = 'own_white_label'
  } else if (external && !ownWhiteLabel) {
    targetSurface = 'external_site'
  } else if (ownWhiteLabel && external) {
    targetSurface = preference?.target_surface || 'own_white_label'
  }

  return {
    target_surface: targetSurface,
    resolved: true,
    can_toggle: Boolean(ownWhiteLabel && external),
    available_surfaces: available.length ? available : ['bazaar'],
    subdomain: ownWhiteLabel?.subdomain || null,
    custom_domain: ownWhiteLabel?.custom_domain || null,
    external_site_url: external?.url || preference?.external_site_url || null,
    agency_id: effectiveAgencyId,
    agent_id: agentId,
  }
}

export async function resolveSeoTargetForProperty(propertyId, { agencyId, agentId } = {}) {
  const property = await withTenant(agencyId, agentId, () =>
    findOne('properties', (p) => p.id === propertyId),
  )
  if (!property) {
    throw Object.assign(new Error(`property not found: ${propertyId}`), { code: 'PROPERTY_NOT_FOUND' })
  }
  const preference = await getSeoTargetPreference({ agentId, propertyId, agencyId })
  return resolveSeoTarget({
    property,
    agentId: agentId || property.agent_id,
    agencyId: agencyId || property.agency_id,
    preference,
  })
}
