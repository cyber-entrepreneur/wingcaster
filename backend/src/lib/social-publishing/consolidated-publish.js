/**
 * Wave 1B — consolidated social publishing onto Path B with canonical Executions.
 */

import { v4 as uuidv4 } from 'uuid'
import { findAll, findOne, insert } from '../../db.js'
import { findAgentPrimaryConnection } from '../social/personal-connections-routes.js'
import { recordDistributionAttempt } from '../publishing/record-attempt.js'
import {
  checkEligibility,
  createExecution,
  getChannelConnection,
  ingestEvent,
  recordExecutionAttempt,
  transitionExecution,
  buildIdempotencyKey,
} from '../growth-os/index.js'
import {
  channelConnectionIdForMarketplaceConnection,
  isPublicSocialPlatform,
} from './constants.js'
import { dispatchPlatformPublish } from './platform-dispatch.js'

function normalizePhone(phone) {
  if (!phone) return ''
  return String(phone).replace(/[^\d+]/g, '')
}

async function resolveContactIdByPhone(phone, { agentId, agencyId } = {}) {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  const contact = await findOne('contacts', (row) => {
    if (agentId && row.assigned_agent_id && row.assigned_agent_id !== agentId) return false
    if (agencyId && row.agency_id && row.agency_id !== agencyId) return false
    return normalizePhone(row.phone) === normalized
  })
  return contact?.id || null
}

function normalizeChannelInput(raw, captions = {}, defaultCaption = '') {
  if (typeof raw === 'string') {
    return {
      platform: raw,
      format: null,
      caption: captions[raw] || defaultCaption,
      link_url: null,
    }
  }
  const platform = raw?.platform
  return {
    platform,
    format: raw?.format || null,
    caption: captions[platform] || raw?.caption || defaultCaption,
    link_url: raw?.link_url || null,
  }
}

function externalIdFromResult(publishResult, platform) {
  if (!publishResult) return null
  if (platform === 'whatsapp') return publishResult.message_id || null
  return (
    publishResult.publish_id
    || publishResult.post_id
    || publishResult.tweet_id
    || publishResult.post_urn
    || publishResult.provider_message_id
    || publishResult.media_id
    || null
  )
}

async function emitPublishOutcomeEvent({
  eventName,
  execution,
  platform,
  agencyId,
  agentId,
  propertyId,
  externalId,
  errorMessage,
}) {
  const occurredAt = new Date().toISOString()
  const idempotencyKey = buildIdempotencyKey({
    source: 'social_publish',
    objectType: 'execution',
    objectId: execution.id,
    eventName,
    occurredAt,
  })
  await ingestEvent({
    eventName,
    source: 'social_publish',
    actorType: 'agent',
    actorId: agentId,
    objectType: 'execution',
    objectId: execution.id,
    executionId: execution.id,
    channelConnectionId: execution.channel_connection_id,
    agencyId,
    agentId,
    context: {
      platform,
      property_id: propertyId,
      external_id: externalId,
      error: errorMessage || null,
    },
    occurredAt,
    idempotencyKey,
  })
}

async function writeLegacyDistributionRow({
  property,
  agentId,
  platform,
  connection,
  status,
  externalId,
  error,
  errorCode,
  format,
  caption,
  mediaUrls,
  publishResult,
  source,
  meta = {},
}) {
  const row = {
    id: uuidv4(),
    property_id: property.id,
    agent_id: agentId,
    platform,
    owner_type: 'agent',
    status,
    external_id: externalId,
    error: error || null,
    error_code: errorCode || null,
    formats: format ? [format] : [],
    connection_id: connection?.id || null,
    account_name: connection?.account_name || null,
    meta: {
      format: format || null,
      caption,
      media_count: mediaUrls?.length || 0,
      external_url: publishResult?.external_url || null,
      simulated: publishResult?.simulated || false,
      provider: publishResult?.provider || null,
      intent: meta.intent || 'publish',
      consolidated: true,
      ...meta,
    },
    views: 0,
    leads: 0,
    clicks: 0,
    cost: 0,
    published_at: status === 'published' ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  }
  await insert('distributions', row)
  if (status !== 'draft') {
    await recordDistributionAttempt({
      distributionJobId: row.id,
      status,
      error: error ? { message: error } : null,
      errorMessage: error,
      response: publishResult || (externalId ? { external_id: externalId } : null),
      extra: { platform, source, format: format || null },
    })
  }
  return row
}

/**
 * Publish a listing to one or more social/messaging platforms via real adapters.
 * Records canonical Executions + legacy distributions (expand-contract).
 */
export async function publishListingToSocialChannels({
  property,
  serializedProperty = null,
  agentId,
  agencyId = null,
  channels = [],
  captions = {},
  defaultCaption = '',
  mediaUrls = null,
  recipient = null,
  contactId = null,
  creativeId = null,
  creditContext = null,
  intent = 'publish',
  source = 'publish_social',
} = {}) {
  if (!property?.id) {
    throw Object.assign(new Error('property is required'), { code: 'MISSING_PROPERTY' })
  }
  if (!agentId) {
    throw Object.assign(new Error('agentId is required'), { code: 'MISSING_AGENT' })
  }
  if (!Array.isArray(channels) || channels.length === 0) {
    throw Object.assign(new Error('channels must have at least one entry'), { code: 'CHANNELS_REQUIRED' })
  }

  const listing = serializedProperty || property
  const resolvedMedia = mediaUrls?.length
    ? mediaUrls
    : (Array.isArray(property.photos) ? property.photos : [])

  const results = []
  const distributions = []

  for (const raw of channels) {
    const { platform, format, caption, link_url: linkUrl } = normalizeChannelInput(
      raw,
      captions,
      defaultCaption,
    )
    if (!platform) {
      results.push({ platform: null, status: 'failed', error: 'platform is required' })
      continue
    }

    const conn = await findAgentPrimaryConnection(agentId, platform)
    const channelConnectionId = conn ? channelConnectionIdForMarketplaceConnection(conn.id) : null
    let channelConn = null
    if (channelConnectionId) {
      channelConn = await getChannelConnection(channelConnectionId, { agencyId, agentId })
    }

    if (!conn || conn.status !== 'connected') {
      const execution = await createExecution({
        kind: 'social_post',
        status: 'failed',
        agencyId,
        agentId,
        channelConnectionId,
        creativeId,
        subjectType: 'property',
        subjectId: property.id,
        data: { platform, source, intent, reason: 'NOT_CONNECTED' },
      })
      const dist = await writeLegacyDistributionRow({
        property,
        agentId,
        platform,
        connection: conn,
        status: 'failed',
        externalId: null,
        error: `${platform} is not connected. Connect it in Settings → Integrations.`,
        errorCode: 'NOT_CONNECTED',
        format,
        caption,
        mediaUrls: resolvedMedia,
        publishResult: null,
        source,
        meta: { execution_id: execution.id, intent },
      })
      await recordExecutionAttempt({
        executionId: execution.id,
        status: 'failed',
        errorMessage: dist.error,
        errorClass: 'NOT_CONNECTED',
        agencyId,
        agentId,
        data: { platform },
      })
      await emitPublishOutcomeEvent({
        eventName: 'post.failed',
        execution,
        platform,
        agencyId,
        agentId,
        propertyId: property.id,
        externalId: null,
        errorMessage: dist.error,
      })
      results.push({
        platform,
        status: 'failed',
        error: dist.error,
        error_code: 'NOT_CONNECTED',
        execution_id: execution.id,
        distribution_id: dist.id,
      })
      distributions.push(dist)
      continue
    }

    if (channelConn && channelConn.health && channelConn.health !== 'connected') {
      const execution = await createExecution({
        kind: 'social_post',
        status: 'failed',
        agencyId,
        agentId,
        channelConnectionId,
        creativeId,
        subjectType: 'property',
        subjectId: property.id,
        data: { platform, source, intent, reason: 'CHANNEL_UNHEALTHY' },
      })
      const errMsg = `${platform} connection is ${channelConn.health}. Reconnect in Channel Settings.`
      const dist = await writeLegacyDistributionRow({
        property,
        agentId,
        platform,
        connection: conn,
        status: 'failed',
        externalId: null,
        error: errMsg,
        errorCode: 'CHANNEL_UNHEALTHY',
        format,
        caption,
        mediaUrls: resolvedMedia,
        publishResult: null,
        source,
        meta: { execution_id: execution.id, intent },
      })
      await recordExecutionAttempt({
        executionId: execution.id,
        status: 'failed',
        errorMessage: errMsg,
        errorClass: 'CHANNEL_UNHEALTHY',
        agencyId,
        agentId,
      })
      await emitPublishOutcomeEvent({
        eventName: 'post.failed',
        execution,
        platform,
        agencyId,
        agentId,
        propertyId: property.id,
        externalId: null,
        errorMessage: errMsg,
      })
      results.push({
        platform,
        status: 'failed',
        error: errMsg,
        error_code: 'CHANNEL_UNHEALTHY',
        execution_id: execution.id,
        distribution_id: dist.id,
      })
      distributions.push(dist)
      continue
    }

    const execution = await createExecution({
      kind: 'social_post',
      status: 'processing',
      agencyId,
      agentId,
      channelConnectionId,
      creativeId,
      subjectType: 'property',
      subjectId: property.id,
      data: { platform, source, intent, format },
    })

    if (platform === 'whatsapp') {
      const resolvedContactId = contactId
        || await resolveContactIdByPhone(recipient || conn.settings?.notify_number, { agentId, agencyId })
      if (resolvedContactId) {
        const eligibility = await checkEligibility({
          contactId: resolvedContactId,
          channel: 'whatsapp',
          purpose: 'marketing',
          agencyId,
          agentId,
        })
        if (!eligibility.allowed) {
          const errMsg = `WhatsApp send suppressed: ${eligibility.reason_code}`
          await transitionExecution(execution.id, 'failed', { agencyId, agentId })
          const dist = await writeLegacyDistributionRow({
            property,
            agentId,
            platform,
            connection: conn,
            status: 'failed',
            externalId: null,
            error: errMsg,
            errorCode: eligibility.reason_code,
            format,
            caption,
            mediaUrls: resolvedMedia,
            publishResult: null,
            source,
            meta: { execution_id: execution.id, intent, suppressed: true },
          })
          await recordExecutionAttempt({
            executionId: execution.id,
            status: 'failed',
            errorMessage: errMsg,
            errorClass: eligibility.reason_code,
            agencyId,
            agentId,
            data: { suppressed: true },
          })
          await emitPublishOutcomeEvent({
            eventName: 'message.failed',
            execution,
            platform,
            agencyId,
            agentId,
            propertyId: property.id,
            externalId: null,
            errorMessage: errMsg,
          })
          results.push({
            platform,
            status: 'failed',
            error: errMsg,
            error_code: eligibility.reason_code,
            execution_id: execution.id,
            distribution_id: dist.id,
          })
          distributions.push(dist)
          continue
        }
      }
    }

    const { publishResult, publishError } = await dispatchPlatformPublish({
      platform,
      connection: conn,
      property,
      serializedProperty: listing,
      caption,
      format,
      linkUrl,
      mediaUrls: resolvedMedia,
      recipient,
      creditContext,
    })

    const status = publishError ? 'failed' : 'published'
    const externalId = externalIdFromResult(publishResult, platform)
    const externalUrl = publishResult?.external_url || null

    await transitionExecution(execution.id, status, {
      providerRef: externalId,
      agencyId,
      agentId,
    })

    const dist = await writeLegacyDistributionRow({
      property,
      agentId,
      platform,
      connection: conn,
      status,
      externalId,
      error: publishError?.message || null,
      errorCode: publishError?.code || null,
      format,
      caption,
      mediaUrls: resolvedMedia,
      publishResult,
      source,
      meta: { execution_id: execution.id, intent },
    })

    await recordExecutionAttempt({
      executionId: execution.id,
      status,
      errorMessage: publishError?.message || null,
      errorClass: publishError?.code || null,
      response: publishResult || (externalId ? { external_id: externalId, external_url: externalUrl } : null),
      agencyId,
      agentId,
      data: { platform, distribution_id: dist.id },
    })

    const eventName = platform === 'whatsapp'
      ? (status === 'published' ? 'message.delivered' : 'message.failed')
      : (status === 'published' ? 'post.published' : 'post.failed')
    await emitPublishOutcomeEvent({
      eventName,
      execution,
      platform,
      agencyId,
      agentId,
      propertyId: property.id,
      externalId,
      errorMessage: publishError?.message || null,
    })

    results.push({
      platform,
      status,
      external_id: externalId,
      external_url: externalUrl,
      provider: publishResult?.provider || null,
      simulated: publishResult?.simulated || false,
      error: publishError?.message || null,
      error_code: publishError?.code || null,
      execution_id: execution.id,
      distribution_id: dist.id,
    })
    distributions.push(dist)
  }

  return { results, distributions }
}

/**
 * Retry a legacy distribution row through the consolidated real-adapter path.
 */
export async function retryLegacyDistribution(row, {
  serializedProperty,
  creditContext = null,
  source = 'retry_worker',
} = {}) {
  const property = serializedProperty || await findOne('properties', (p) => p.id === row.property_id)
  if (!property) {
    throw new Error('Property no longer exists for this distribution')
  }

  const meta = row.meta || {}
  const { results } = await publishListingToSocialChannels({
    property,
    serializedProperty,
    agentId: row.agent_id,
    agencyId: row.agency_id || null,
    channels: [{
      platform: row.platform,
      format: (row.formats || meta.formats || [])[0] || meta.format || null,
      caption: meta.caption,
    }],
    defaultCaption: meta.caption || '',
    mediaUrls: meta.media_urls,
    recipient: meta.recipient,
    creditContext,
    intent: meta.intent || 'distribute',
    source,
  })

  const result = results[0]
  if (!result) {
    throw new Error(`Retry produced no result for ${row.platform}`)
  }

  const updated = await findOne('distributions', (d) => d.id === result.distribution_id)
  return updated || {
    ...row,
    status: result.status,
    external_id: result.external_id,
    error: result.error,
    published_at: result.status === 'published' ? new Date().toISOString() : row.published_at,
    meta: {
      ...meta,
      retry_via_consolidated: true,
      execution_id: result.execution_id,
    },
  }
}

export { isPublicSocialPlatform }
