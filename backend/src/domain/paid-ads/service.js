/**
 * Wave 2A — paid Execution create + launch (adapters + events).
 */

import {
  buildIdempotencyKey,
  createExecution,
  getChannelConnection,
  getExecution,
  ingestEvent,
  listEvents,
  listExecutions,
  recordExecutionAttempt,
  transitionExecution,
  withTenant,
} from '../../lib/growth-os/index.js'
import { findOne } from '../../persistence/index.js'
import { createPaidAdsAdapter } from './adapters/index.js'
import { assertProviderApproved, isProviderApproved, providerApprovalState } from './approval.js'
import { PAID_CHANNEL_KIND, PAID_EXECUTION_KIND, PROVIDER_NOT_APPROVED } from './constants.js'
import { resolvePaidCredentials } from './credentials.js'
import { assertBudget, assertPaidAdObjective, normalizeTargeting } from './objectives.js'
import { recordPaidMetricObservation } from './metrics.js'

async function loadDefinitionForConnection(connection, { agencyId, agentId }) {
  if (!connection?.channel_definition_id) return null
  return (
    await withTenant(agencyId, agentId, () =>
      findOne('channel_definitions', (row) => row.id === connection.channel_definition_id),
    )
  ) || (
    await withTenant(null, null, () =>
      findOne('channel_definitions', (row) => row.id === connection.channel_definition_id),
    )
  )
}

function paidPayload(execution) {
  // After fromRow, paid attrs are top-level; accept nested .data for older rows.
  const nested = execution?.data && typeof execution.data === 'object' ? execution.data : {}
  return {
    objective: execution.objective ?? nested.objective ?? null,
    budget_micros: execution.budget_micros ?? nested.budget_micros ?? null,
    currency: execution.currency ?? nested.currency ?? null,
    targeting: execution.targeting ?? nested.targeting ?? {},
    schedule: execution.schedule ?? nested.schedule ?? null,
    format: execution.format ?? nested.format ?? null,
    name: execution.name ?? nested.name ?? null,
    platform: execution.platform ?? nested.platform ?? null,
    creative_url: execution.creative_url ?? nested.creative_url ?? null,
    landing_url: execution.landing_url ?? nested.landing_url ?? null,
    provider_approval_state:
      execution.provider_approval_state ?? nested.provider_approval_state ?? null,
  }
}

/**
 * Create a draft paid_ad Execution with objective / budget / targeting.
 */
export async function createPaidAdExecution({
  agencyId = null,
  agentId = null,
  channelConnectionId,
  campaignId = null,
  creativeId = null,
  audienceId = null,
  objective,
  budgetMicros,
  currency = 'USD',
  targeting = {},
  schedule = null,
  format = null,
  name = null,
  subjectType = null,
  subjectId = null,
  scheduledAt = null,
  data = {},
} = {}) {
  if (!channelConnectionId) {
    throw Object.assign(new Error('channelConnectionId is required'), {
      code: 'MISSING_CHANNEL_CONNECTION',
    })
  }
  assertPaidAdObjective(objective)
  const budget = assertBudget(budgetMicros, currency)
  const normalizedTargeting = normalizeTargeting(targeting, { audienceId })

  const connection = await getChannelConnection(channelConnectionId, { agencyId, agentId })
  if (!connection) {
    throw Object.assign(new Error(`channel_connection not found: ${channelConnectionId}`), {
      code: 'CHANNEL_CONNECTION_NOT_FOUND',
    })
  }
  const definition = await loadDefinitionForConnection(connection, { agencyId, agentId })
  if (!definition || definition.kind !== PAID_CHANNEL_KIND) {
    throw Object.assign(new Error('channel_connection is not a paid channel'), {
      code: 'NOT_PAID_CHANNEL',
    })
  }

  const paidData = {
    objective,
    budget_micros: budget.budgetMicros,
    currency: budget.currency,
    targeting: normalizedTargeting,
    schedule,
    format: format || normalizedTargeting.format || null,
    name,
    creative_id: creativeId,
    platform: definition.platform,
    provider_approval_state: providerApprovalState(definition.platform).state,
    ...(data && typeof data === 'object' ? data : {}),
  }

  return createExecution({
    kind: PAID_EXECUTION_KIND,
    status: 'draft',
    agencyId,
    agentId,
    channelConnectionId,
    campaignId,
    creativeId,
    audienceId: audienceId || normalizedTargeting.audience_ref || null,
    subjectType,
    subjectId,
    scheduledAt,
    data: paidData,
  })
}

/**
 * Launch a paid_ad Execution through the real provider adapter.
 * Unapproved → PROVIDER_NOT_APPROVED (no stub, no ad.delivered).
 */
export async function launchPaidAdExecution(
  executionId,
  {
    agencyId = null,
    agentId = null,
    fetchImpl = globalThis.fetch,
    emitEngagement = false,
  } = {},
) {
  const execution = await getExecution(executionId, { agencyId, agentId })
  if (!execution) {
    throw Object.assign(new Error(`execution not found: ${executionId}`), {
      code: 'EXECUTION_NOT_FOUND',
    })
  }
  if (execution.kind !== PAID_EXECUTION_KIND) {
    throw Object.assign(new Error('execution is not kind=paid_ad'), {
      code: 'NOT_PAID_AD_EXECUTION',
    })
  }

  const payload = paidPayload(execution)
  const platform = payload.platform
  if (!platform) {
    throw Object.assign(new Error('paid execution missing data.platform'), {
      code: 'MISSING_PLATFORM',
    })
  }

  // Hard gate before any HTTP — never stub success.
  if (!isProviderApproved(platform)) {
    await recordExecutionAttempt({
      executionId: execution.id,
      status: 'failed',
      errorMessage: `${platform} provider not approved`,
      errorClass: PROVIDER_NOT_APPROVED,
      agencyId: agencyId ?? execution.agency_id,
      agentId: agentId ?? execution.agent_id,
      data: { code: PROVIDER_NOT_APPROVED },
    }).catch(() => null)

    const err = Object.assign(
      new Error(
        `${platform} is not approved for live delivery yet (business verification / app review pending)`,
      ),
      { code: PROVIDER_NOT_APPROVED, status: 503 },
    )
    throw err
  }

  assertProviderApproved(platform)

  const connection = await getChannelConnection(execution.channel_connection_id, {
    agencyId: agencyId ?? execution.agency_id,
    agentId: agentId ?? execution.agent_id,
  })
  if (!connection) {
    throw Object.assign(new Error('channel_connection not found for execution'), {
      code: 'CHANNEL_CONNECTION_NOT_FOUND',
    })
  }

  const creds = resolvePaidCredentials(connection)
  const adapter = createPaidAdsAdapter(platform, { fetchImpl })

  let queued = execution
  if (execution.status === 'draft' || execution.status === 'scheduled') {
    queued = await transitionExecution(execution.id, 'queued', {
      agencyId: agencyId ?? execution.agency_id,
      agentId: agentId ?? execution.agent_id,
    })
  }
  if (queued.status !== 'processing') {
    queued = await transitionExecution(queued.id, 'processing', {
      agencyId: agencyId ?? execution.agency_id,
      agentId: agentId ?? execution.agent_id,
    })
  }

  let result
  try {
    result = await adapter.createCampaign({
      name: payload.name || `WingCaster ${payload.objective}`,
      objective: payload.objective,
      budgetMicros: payload.budget_micros,
      currency: payload.currency,
      targeting: payload.targeting || {},
      schedule: payload.schedule || null,
      format: payload.format || payload.targeting?.format || null,
      accessToken: creds.accessToken,
      adAccountId: creds.adAccountId,
      developerToken: creds.developerToken,
      loginCustomerId: creds.loginCustomerId,
      creativeUrl: payload.creative_url || null,
      landingUrl: payload.landing_url || null,
    })
  } catch (error) {
    await transitionExecution(execution.id, 'failed', {
      agencyId: agencyId ?? execution.agency_id,
      agentId: agentId ?? execution.agent_id,
    }).catch(() => null)
    await recordExecutionAttempt({
      executionId: execution.id,
      status: 'failed',
      errorMessage: error.message,
      errorClass: error.code || 'PAID_ADS_ADAPTER_ERROR',
      agencyId: agencyId ?? execution.agency_id,
      agentId: agentId ?? execution.agent_id,
      response: error.details || null,
    }).catch(() => null)
    throw error
  }

  const published = await transitionExecution(execution.id, 'published', {
    providerRef: result.provider_ref,
    agencyId: agencyId ?? execution.agency_id,
    agentId: agentId ?? execution.agent_id,
  })

  await recordExecutionAttempt({
    executionId: execution.id,
    status: 'succeeded',
    response: { provider_campaign_id: result.provider_campaign_id, provider: result.provider },
    agencyId: agencyId ?? execution.agency_id,
    agentId: agentId ?? execution.agent_id,
  })

  const deliveredEvent = await emitAdDeliveredEvent({
    execution: published,
    platform,
    providerCampaignId: result.provider_campaign_id,
    agencyId: agencyId ?? execution.agency_id,
    agentId: agentId ?? execution.agent_id,
    payload,
  })

  let engagementEvent = null
  if (emitEngagement) {
    engagementEvent = await emitAdEngagementEvent({
      execution: published,
      platform,
      agencyId: agencyId ?? execution.agency_id,
      agentId: agentId ?? execution.agent_id,
    })
  }

  // Seed a zero spend observation so 2C has a cumulative series anchor.
  await recordPaidMetricObservation({
    agencyId: agencyId ?? execution.agency_id,
    agentId: agentId ?? execution.agent_id,
    executionId: execution.id,
    metricName: 'spend_micros',
    metricValue: 0,
    aggregationType: 'cumulative',
    source: platform,
    providerRef: result.provider_ref,
    dimensions: { objective: payload.objective },
  })

  return {
    execution: published,
    provider: result,
    events: { delivered: deliveredEvent, engagement: engagementEvent },
  }
}

async function emitAdDeliveredEvent({
  execution,
  platform,
  providerCampaignId,
  agencyId,
  agentId,
  payload = null,
}) {
  const paid = payload || paidPayload(execution)
  const occurredAt = new Date().toISOString()
  const idempotencyKey = buildIdempotencyKey({
    source: 'paid_ads',
    objectType: 'execution',
    objectId: execution.id,
    eventName: 'ad.delivered',
    occurredAt,
  })
  return ingestEvent({
    eventName: 'ad.delivered',
    source: 'paid_ads',
    actorType: 'system',
    actorId: null,
    objectType: 'execution',
    objectId: execution.id,
    executionId: execution.id,
    channelConnectionId: execution.channel_connection_id,
    campaignId: execution.campaign_id,
    agencyId,
    agentId,
    occurredAt,
    idempotencyKey,
    providerEventId: providerCampaignId
      ? `${platform}:campaign:${providerCampaignId}:delivered`
      : null,
    context: {
      platform,
      objective: paid.objective,
      budget_micros: paid.budget_micros,
      currency: paid.currency,
    },
  })
}

/**
 * Discrete engagement → taxonomy §4C link.clicked (no cumulative impressions as events).
 */
async function emitAdEngagementEvent({ execution, platform, agencyId, agentId }) {
  const occurredAt = new Date().toISOString()
  const idempotencyKey = buildIdempotencyKey({
    source: 'paid_ads',
    objectType: 'execution',
    objectId: execution.id,
    eventName: 'link.clicked',
    occurredAt,
  })
  return ingestEvent({
    eventName: 'link.clicked',
    source: 'paid_ads',
    actorType: 'contact',
    actorId: null,
    objectType: 'execution',
    objectId: execution.id,
    executionId: execution.id,
    channelConnectionId: execution.channel_connection_id,
    campaignId: execution.campaign_id,
    agencyId,
    agentId,
    occurredAt,
    idempotencyKey,
    context: { platform, kind: 'paid_ad_engagement' },
  })
}

export async function listPaidAdExecutions({ agencyId = null, agentId = null, status = null } = {}) {
  return listExecutions({
    agencyId,
    agentId,
    kind: PAID_EXECUTION_KIND,
    status,
  })
}

export async function getPaidAdExecution(id, tenant) {
  const execution = await getExecution(id, tenant)
  if (!execution || execution.kind !== PAID_EXECUTION_KIND) return null
  return execution
}

export async function listPaidAdEvents(executionId, { agencyId = null, agentId = null } = {}) {
  return listEvents({
    agencyId,
    agentId,
    executionId,
  })
}

export { PROVIDER_NOT_APPROVED }
