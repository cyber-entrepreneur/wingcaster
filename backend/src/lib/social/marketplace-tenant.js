/**
 * Tenant context for marketplace_connections / oauth_states (PR6 RLS).
 */
import { findOne, transaction } from '../../persistence/index.js'
import { withTenant } from '../growth-os/with-tenant.js'

/**
 * Ensure global channel_definitions row exists before a tenanted marketplace_connections
 * write. The forward-sync trigger calls growth_os_ensure_channel_definition(), which
 * requires channel_definitions writes with unset tenant GUCs.
 *
 * @param {string} platform
 */
export async function ensureChannelDefinitionForPlatform(platform) {
  if (!platform) return
  await transaction(async (client) => {
    await client.query('SELECT public.growth_os_ensure_channel_definition($1)', [platform])
  })
}

/**
 * Resolve agency_id for an agent (direct column or active affiliation).
 *
 * @param {string} agentId
 * @param {(agentId: string) => Promise<{ agency_id?: string|null }|null>} [getActiveAffiliation]
 */
export async function resolveAgentAgencyId(agentId, getActiveAffiliation = null) {
  const agent = await findOne('agents', (a) => a.id === agentId)
  if (agent?.agency_id) return agent.agency_id
  if (getActiveAffiliation) {
    const affiliation = await getActiveAffiliation(agentId)
    return affiliation?.agency_id || null
  }
  return null
}

/**
 * Run fn under growth_os_app_role with agency + agent GUCs set.
 *
 * @param {string|null|undefined} agencyId
 * @param {string|null|undefined} agentId
 * @param {() => Promise<*>} fn
 */
export async function withMarketplaceTenant(agencyId, agentId, fn) {
  if (!agencyId && !agentId) {
    throw Object.assign(new Error('Tenant context required'), { code: 'TENANT_REQUIRED' })
  }
  return withTenant(agencyId, agentId, fn)
}

/**
 * Resolve agency for agentId, then run fn under tenant GUCs.
 *
 * @param {string} agentId
 * @param {() => Promise<*>} fn
 * @param {(agentId: string) => Promise<{ agency_id?: string|null }|null>} [getActiveAffiliation]
 */
export async function withAgentTenant(agentId, fn, getActiveAffiliation = null) {
  const agencyId = await resolveAgentAgencyId(agentId, getActiveAffiliation)
  return withMarketplaceTenant(agencyId, agentId, fn)
}

/**
 * Tenanted marketplace_connections write — seeds channel_definitions first (no GUCs).
 */
export async function withMarketplaceConnectionWrite(agencyId, agentId, platform, fn) {
  await ensureChannelDefinitionForPlatform(platform)
  return withMarketplaceTenant(agencyId, agentId, fn)
}

/**
 * Resolve agency, seed channel_definitions, then run a tenanted connection write.
 */
export async function withAgentConnectionWrite(agentId, platform, fn, getActiveAffiliation = null) {
  const agencyId = await resolveAgentAgencyId(agentId, getActiveAffiliation)
  return withMarketplaceConnectionWrite(agencyId, agentId, platform, fn)
}
