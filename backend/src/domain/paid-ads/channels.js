/**
 * Wave 2A — ensure paid ChannelDefinitions + connect ChannelConnections.
 */

import {
  createChannelConnection,
  ensureChannelDefinition,
  getChannelConnection,
  listChannelConnections,
  updateChannelConnectionHealth,
} from '../../lib/growth-os/index.js'
import { findOne } from '../../persistence/index.js'
import { withTenant } from '../../lib/growth-os/with-tenant.js'
import { providerApprovalState } from './approval.js'
import { assertCredentialsRefPointer } from './credentials.js'
import { PAID_CHANNEL_KIND, PAID_PLATFORMS } from './constants.js'

const PAID_CAPABILITIES = {
  meta_ads: {
    formats: ['feed', 'stories', 'reels', 'audience_network'],
    objectives: ['awareness', 'traffic', 'engagement', 'leads', 'conversions'],
    insights: true,
    scheduling: true,
  },
  google_ads: {
    formats: ['search', 'display', 'demand_gen', 'demand_gen_gmail', 'demand_gen_youtube', 'performance_max'],
    objectives: ['awareness', 'traffic', 'engagement', 'leads', 'conversions'],
    insights: true,
    scheduling: true,
    notes: 'Gmail reach is Demand Gen Gmail placement — not an owned-email channel',
  },
}

export async function ensurePaidChannelDefinitions() {
  const defs = []
  for (const platform of PAID_PLATFORMS) {
    const def = await ensureChannelDefinition({
      platform,
      kind: PAID_CHANNEL_KIND,
      globalCapabilities: PAID_CAPABILITIES[platform],
      data: { wave: '2a', kind: 'paid' },
    })
    defs.push(def)
  }
  return defs
}

export async function connectPaidChannel({
  platform,
  agencyId = null,
  agentId = null,
  credentialsRef,
  providerAccountId = null,
  integrationModel = 'tenant_oauth',
  tenantCapabilities = {},
  data = {},
  health = 'connected',
} = {}) {
  if (!PAID_PLATFORMS.includes(platform)) {
    throw Object.assign(new Error(`Unsupported paid platform: ${platform}`), {
      code: 'UNSUPPORTED_PAID_PLATFORM',
    })
  }
  assertCredentialsRefPointer(credentialsRef)
  if (!credentialsRef) {
    throw Object.assign(new Error('credentialsRef is required (secret:… pointer)'), {
      code: 'MISSING_CREDENTIALS_REF',
    })
  }

  await ensurePaidChannelDefinitions()
  const definition = await withTenant(null, null, () =>
    findOne(
      'channel_definitions',
      (row) => String(row.platform || '').toLowerCase() === platform
        && row.kind === PAID_CHANNEL_KIND,
    ),
  )
  if (!definition) {
    throw Object.assign(new Error(`Paid channel_definition missing for ${platform}`), {
      code: 'CHANNEL_DEFINITION_NOT_FOUND',
    })
  }

  const approval = providerApprovalState(platform)
  return createChannelConnection({
    channelDefinitionId: definition.id,
    agencyId,
    agentId,
    integrationModel,
    credentialsRef,
    providerAccountId,
    health,
    tenantCapabilities: {
      ...tenantCapabilities,
      provider_approval: approval.state,
    },
    data: {
      ...data,
      platform,
      provider_approval_state: approval.state,
      connected_at: new Date().toISOString(),
    },
  })
}

export async function listPaidChannelStatus({ agencyId = null, agentId = null } = {}) {
  await ensurePaidChannelDefinitions()
  const connections = await listChannelConnections({ agencyId, agentId })
  const paidConnections = []

  for (const conn of connections) {
    const def = await withTenant(agencyId, agentId, () =>
      findOne('channel_definitions', (row) => row.id === conn.channel_definition_id),
    )
    // Definitions are catalog-global; also try with null tenant for read.
    const definition = def || await withTenant(null, null, () =>
      findOne('channel_definitions', (row) => row.id === conn.channel_definition_id),
    )
    if (!definition || definition.kind !== PAID_CHANNEL_KIND) continue
    const platform = definition.platform
    const approval = providerApprovalState(platform)
    paidConnections.push({
      connection: conn,
      definition,
      platform,
      approval,
      health: conn.health,
      honest_state: approval.approved
        ? (conn.health === 'connected' ? 'ready' : conn.health)
        : 'connect_pending_approval',
    })
  }

  return PAID_PLATFORMS.map((platform) => {
    const match = paidConnections.find((c) => c.platform === platform)
    const approval = providerApprovalState(platform)
    return {
      platform,
      kind: PAID_CHANNEL_KIND,
      capabilities: PAID_CAPABILITIES[platform],
      approval,
      connection: match?.connection || null,
      health: match?.health || 'disconnected',
      honest_state: match?.honest_state || (approval.approved ? 'not_connected' : 'connect_pending_approval'),
      message: approval.message,
    }
  })
}

export async function getPaidConnection(id, tenant) {
  return getChannelConnection(id, tenant)
}

export { updateChannelConnectionHealth }
