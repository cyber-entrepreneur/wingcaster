/**
 * Growth-OS Wave 0 — channel access layer.
 * Canonical writes for channel_definitions / channel_connections.
 */

import { randomUUID } from 'node:crypto'
import { findAll, findOne, insert, update } from '../../persistence/index.js'

const CHANNEL_KINDS = new Set(['owned_messaging', 'organic_social', 'paid', 'portal'])
const CONNECTION_HEALTH = new Set(['connected', 'disconnected', 'expired', 'error'])

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

function assertKind(kind) {
  if (!CHANNEL_KINDS.has(kind)) {
    throw Object.assign(new Error(`Invalid channel_definition.kind: ${kind}`), {
      code: 'INVALID_CHANNEL_KIND',
    })
  }
}

function assertHealth(health) {
  if (health != null && !CONNECTION_HEALTH.has(health)) {
    throw Object.assign(new Error(`Invalid channel_connection.health: ${health}`), {
      code: 'INVALID_CHANNEL_HEALTH',
    })
  }
}

/**
 * Ensure a catalog channel_definition exists for platform+kind.
 * @returns {Promise<object>}
 */
export async function ensureChannelDefinition({
  platform,
  kind,
  globalCapabilities = {},
  id = null,
  data = {},
} = {}) {
  if (!platform) {
    throw Object.assign(new Error('platform is required'), { code: 'MISSING_PLATFORM' })
  }
  assertKind(kind)

  const existing = await findOne(
    'channel_definitions',
    (row) => String(row.platform || '').toLowerCase() === String(platform).toLowerCase(),
  )
  if (existing) return existing

  return insert('channel_definitions', {
    id: id || prefixedId('chnd_'),
    platform,
    kind,
    global_capabilities: globalCapabilities,
    data,
  })
}

/**
 * Create a tenant channel_connection. credentials_ref is a pointer only —
 * never pass raw tokens into this row.
 */
export async function createChannelConnection({
  channelDefinitionId,
  agencyId = null,
  agentId = null,
  integrationModel = null,
  credentialsRef = null,
  providerAccountId = null,
  rateLimits = {},
  health = 'connected',
  tenantCapabilities = {},
  id = null,
  data = {},
} = {}) {
  if (!channelDefinitionId) {
    throw Object.assign(new Error('channelDefinitionId is required'), {
      code: 'MISSING_CHANNEL_DEFINITION_ID',
    })
  }
  if (credentialsRef && /token|secret|password/i.test(credentialsRef) && !credentialsRef.startsWith('secret:')) {
    throw Object.assign(
      new Error('credentials_ref must be a pointer (secret:…), not raw credentials'),
      { code: 'RAW_CREDENTIALS_FORBIDDEN' },
    )
  }
  assertHealth(health)

  const definition = await findOne('channel_definitions', (row) => row.id === channelDefinitionId)
  if (!definition) {
    throw Object.assign(new Error(`channel_definition not found: ${channelDefinitionId}`), {
      code: 'CHANNEL_DEFINITION_NOT_FOUND',
    })
  }

  return insert('channel_connections', {
    id: id || prefixedId('chn_'),
    channel_definition_id: channelDefinitionId,
    agency_id: agencyId,
    agent_id: agentId,
    integration_model: integrationModel,
    credentials_ref: credentialsRef,
    provider_account_id: providerAccountId,
    rate_limits: rateLimits,
    health,
    tenant_capabilities: tenantCapabilities,
    data,
  })
}

export async function getChannelConnection(id) {
  if (!id) return null
  return findOne('channel_connections', (row) => row.id === id)
}

export async function listChannelConnections({ agencyId = null, agentId = null, health = null } = {}) {
  return findAll('channel_connections', (row) => {
    if (agencyId != null && row.agency_id !== agencyId) return false
    if (agentId != null && row.agent_id !== agentId) return false
    if (health != null && row.health !== health) return false
    return true
  })
}

/**
 * Resolve merged capabilities: definition.global ∪ connection.tenant.
 */
export async function resolveCapabilities(channelConnectionId) {
  const connection = await getChannelConnection(channelConnectionId)
  if (!connection) {
    throw Object.assign(new Error(`channel_connection not found: ${channelConnectionId}`), {
      code: 'CHANNEL_CONNECTION_NOT_FOUND',
    })
  }
  const definition = await findOne(
    'channel_definitions',
    (row) => row.id === connection.channel_definition_id,
  )
  return {
    connection,
    definition,
    capabilities: {
      ...(definition?.global_capabilities || {}),
      ...(connection.tenant_capabilities || {}),
    },
  }
}

export async function updateChannelConnectionHealth(id, health) {
  assertHealth(health)
  const changed = await update(
    'channel_connections',
    (row) => row.id === id,
    (row) => ({ ...row, health }),
  )
  if (!changed) return null
  return getChannelConnection(id)
}

export { CHANNEL_KINDS, CONNECTION_HEALTH }
