/**
 * Wave 2B — draft / scheduled execution preview (no side effects).
 * Reuses Wave 1C creative renditions when creative_id is set; otherwise
 * snapshots caption + media from execution.data.
 */

import { getChannelConnection, getExecution, resolveCapabilities } from '../../lib/growth-os/index.js'
import { loadCreativeBundle } from '../creative/repository.js'
import { extractCaption, extractMediaUrls } from './network-validation.js'

/**
 * Build a per-channel preview payload for an execution.
 * @returns {Promise<object>}
 */
export async function previewExecution(executionId, { agencyId = null, agentId = null } = {}) {
  const execution = await getExecution(executionId, { agencyId, agentId })
  if (!execution) {
    throw Object.assign(new Error(`execution not found: ${executionId}`), {
      code: 'EXECUTION_NOT_FOUND',
    })
  }

  const tenant = {
    agencyId: agencyId ?? execution.agency_id ?? null,
    agentId: agentId ?? execution.agent_id ?? null,
  }

  let platform = null
  let connection = null
  let capabilities = {}
  if (execution.channel_connection_id) {
    connection = await getChannelConnection(execution.channel_connection_id, tenant)
    if (connection) {
      try {
        const resolved = await resolveCapabilities(connection.id, tenant)
        platform = String(resolved?.definition?.platform || '').toLowerCase() || null
        capabilities = resolved?.capabilities || {}
      } catch {
        /* preview still returns execution snapshot */
      }
    }
  }

  let creative = null
  let variants = []
  if (execution.creative_id) {
    const bundle = await loadCreativeBundle(execution.creative_id, tenant)
    if (bundle) {
      creative = bundle.creative
      variants = (bundle.variants || []).map((variant) => ({
        id: variant.id,
        label: variant.label,
        copy: variant.copy || {},
        renditions: (variant.renditions || []).map((r) => ({
          id: r.id,
          channel_key: r.channel_key,
          asset_url: r.asset_url,
          dimensions: r.dimensions,
          status: r.status,
        })),
      }))
    }
  }

  const caption = extractCaption(execution)
  const mediaUrls = extractMediaUrls(execution)
  const channels = []

  if (variants.length > 0) {
    for (const variant of variants) {
      const copyEntries = Object.entries(variant.copy || {})
      if (variant.renditions.length === 0 && copyEntries.length === 0) {
        channels.push({
          channel_key: platform || 'unknown',
          platform,
          caption: caption || null,
          media_urls: mediaUrls,
          variant_id: variant.id,
          label: variant.label,
        })
        continue
      }
      const renditionKeys = new Set(variant.renditions.map((r) => r.channel_key).filter(Boolean))
      const keys = renditionKeys.size
        ? [...renditionKeys]
        : copyEntries.map(([k]) => k)
      if (keys.length === 0) keys.push(platform || 'unknown')
      for (const key of keys) {
        const renditions = variant.renditions.filter((r) => !r.channel_key || r.channel_key === key)
        channels.push({
          channel_key: key,
          platform: platform || key.split('_')[0] || null,
          caption: (typeof variant.copy?.[key] === 'string' ? variant.copy[key] : null) || caption,
          media_urls: renditions.map((r) => r.asset_url).filter(Boolean).length
            ? renditions.map((r) => r.asset_url).filter(Boolean)
            : mediaUrls,
          variant_id: variant.id,
          label: variant.label,
          renditions,
        })
      }
    }
  } else {
    channels.push({
      channel_key: platform || execution.kind || 'unknown',
      platform,
      caption,
      media_urls: mediaUrls,
      variant_id: null,
      label: null,
      renditions: [],
    })
  }

  return {
    execution: {
      id: execution.id,
      kind: execution.kind,
      status: execution.status,
      scheduled_at: execution.scheduled_at,
      campaign_id: execution.campaign_id,
      subject_type: execution.subject_type,
      subject_id: execution.subject_id,
      creative_id: execution.creative_id,
      channel_connection_id: execution.channel_connection_id,
      agent_id: execution.agent_id,
      agency_id: execution.agency_id,
    },
    connection: connection
      ? { id: connection.id, health: connection.health, provider_account_id: connection.provider_account_id }
      : null,
    platform,
    capabilities,
    creative,
    variants,
    channels,
    side_effects: false,
  }
}
