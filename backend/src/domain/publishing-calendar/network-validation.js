/**
 * Wave 2B — pre-publish network validation for Executions.
 * Surfaces blockers/warnings (missing connection, expired token, media, caption, creative).
 * Reuses Wave 0 channel health + Wave 1B media expectations; no side effects.
 */

import {
  getChannelConnection,
  getExecution,
  resolveCapabilities,
} from '../../lib/growth-os/index.js'
import { loadCreativeBundle } from '../creative/repository.js'
import { CAPTION_LIMITS, PLATFORM_MEDIA_RULES } from './constants.js'

/**
 * @typedef {{ code: string, severity: 'blocker'|'warning', message: string, meta?: object }} ValidationIssue
 */

/**
 * Validate an execution for publish readiness under withTenant (via growth-os accessors).
 * @returns {Promise<{ execution: object, blockers: ValidationIssue[], warnings: ValidationIssue[], ok: boolean }>}
 */
export async function validateExecutionNetwork(
  executionId,
  { agencyId = null, agentId = null } = {},
) {
  const execution = await getExecution(executionId, { agencyId, agentId })
  if (!execution) {
    throw Object.assign(new Error(`execution not found: ${executionId}`), {
      code: 'EXECUTION_NOT_FOUND',
    })
  }

  const blockers = []
  const warnings = []
  const tenant = {
    agencyId: agencyId ?? execution.agency_id ?? null,
    agentId: agentId ?? execution.agent_id ?? null,
  }

  if (!execution.channel_connection_id) {
    blockers.push({
      code: 'MISSING_CONNECTION',
      severity: 'blocker',
      message: 'Execution has no channel connection',
    })
  } else {
    let connection = null
    try {
      connection = await getChannelConnection(execution.channel_connection_id, tenant)
    } catch {
      connection = null
    }
    if (!connection) {
      blockers.push({
        code: 'MISSING_CONNECTION',
        severity: 'blocker',
        message: 'Channel connection not found for this tenant',
        meta: { channel_connection_id: execution.channel_connection_id },
      })
    } else {
      const health = String(connection.health || '').toLowerCase()
      if (health === 'expired') {
        blockers.push({
          code: 'EXPIRED_TOKEN',
          severity: 'blocker',
          message: 'Channel connection token is expired',
          meta: { channel_connection_id: connection.id, health },
        })
      } else if (health && health !== 'connected') {
        blockers.push({
          code: 'CHANNEL_UNHEALTHY',
          severity: 'blocker',
          message: `Channel connection health is ${health}`,
          meta: { channel_connection_id: connection.id, health },
        })
      }

      let platform = null
      let capabilities = {}
      try {
        const resolved = await resolveCapabilities(connection.id, tenant)
        platform = String(resolved?.definition?.platform || '').toLowerCase() || null
        capabilities = resolved?.capabilities || {}
      } catch {
        warnings.push({
          code: 'CAPABILITIES_UNRESOLVED',
          severity: 'warning',
          message: 'Could not resolve channel capabilities',
        })
      }

      const mediaIssues = await collectMediaAndCreativeIssues(execution, {
        ...tenant,
        platform,
        capabilities,
      })
      blockers.push(...mediaIssues.blockers)
      warnings.push(...mediaIssues.warnings)

      const caption = extractCaption(execution)
      if (platform && caption != null) {
        const limit = CAPTION_LIMITS[platform]
        if (limit != null && caption.length > limit) {
          blockers.push({
            code: 'CAPTION_TOO_LONG',
            severity: 'blocker',
            message: `Caption exceeds ${platform} limit of ${limit} characters`,
            meta: { platform, length: caption.length, limit },
          })
        }
      } else if (
        ['social_post', 'message', 'paid_ad'].includes(execution.kind) &&
        !caption
      ) {
        warnings.push({
          code: 'MISSING_CAPTION',
          severity: 'warning',
          message: 'No caption/copy found on execution or creative',
        })
      }
    }
  }

  if (execution.kind === 'social_post' && !execution.creative_id) {
    const hasInlineMedia = extractMediaUrls(execution).length > 0
    if (!hasInlineMedia) {
      // Already covered if media rules fire; still flag missing creative when expected.
      if (!blockers.some((b) => b.code === 'MISSING_CREATIVE' || b.code === 'MISSING_MEDIA')) {
        warnings.push({
          code: 'MISSING_CREATIVE',
          severity: 'warning',
          message: 'Social post has no linked creative',
        })
      }
    }
  }

  return {
    execution,
    blockers,
    warnings,
    ok: blockers.length === 0,
  }
}

async function collectMediaAndCreativeIssues(execution, { agencyId, agentId, platform }) {
  const blockers = []
  const warnings = []
  let mediaUrls = extractMediaUrls(execution)
  let caption = extractCaption(execution)

  if (execution.creative_id) {
    const bundle = await loadCreativeBundle(execution.creative_id, { agencyId, agentId })
    if (!bundle?.creative) {
      blockers.push({
        code: 'MISSING_CREATIVE',
        severity: 'blocker',
        message: 'Linked creative was not found',
        meta: { creative_id: execution.creative_id },
      })
    } else {
      const renditionUrls = []
      for (const variant of bundle.variants || []) {
        for (const rendition of variant.renditions || []) {
          if (rendition.asset_url) renditionUrls.push(rendition.asset_url)
        }
        if (!caption) {
          const copy = variant.copy || {}
          const first = Object.values(copy).find((v) => typeof v === 'string' && v.trim())
          if (first) caption = String(first)
        }
      }
      mediaUrls = mediaUrls.length ? mediaUrls : renditionUrls
      if (bundle.creative.approval_state === 'pending') {
        blockers.push({
          code: 'APPROVAL_PENDING',
          severity: 'blocker',
          message: 'Creative is pending approval',
          meta: { creative_id: execution.creative_id },
        })
      } else if (bundle.creative.approval_state === 'rejected') {
        blockers.push({
          code: 'APPROVAL_REJECTED',
          severity: 'blocker',
          message: 'Creative approval was rejected',
          meta: { creative_id: execution.creative_id },
        })
      }
    }
  }

  const rules = platform ? PLATFORM_MEDIA_RULES[platform] : null
  if (rules?.required && mediaUrls.length === 0) {
    blockers.push({
      code: 'MISSING_MEDIA',
      severity: 'blocker',
      message: `${platform} requires media before publish`,
      meta: { platform },
    })
  }
  if (rules?.maxImages != null && mediaUrls.length > rules.maxImages) {
    warnings.push({
      code: 'MEDIA_COUNT_EXCEEDED',
      severity: 'warning',
      message: `${platform} allows at most ${rules.maxImages} media items`,
      meta: { platform, count: mediaUrls.length, max: rules.maxImages },
    })
  }

  const format = String(execution.data?.format || execution.data?.publish_format || '').toLowerCase()
  if (rules?.formatsNeedingVideo?.includes(format)) {
    const hasVideo = mediaUrls.some((url) => /\.(mp4|mov|webm)(\?|$)/i.test(url) || /video/i.test(url))
    if (!hasVideo) {
      blockers.push({
        code: 'MISSING_MEDIA',
        severity: 'blocker',
        message: `${platform} ${format} requires video media`,
        meta: { platform, format },
      })
    }
  }

  return { blockers, warnings, mediaUrls, caption }
}

function extractCaption(execution) {
  const data = execution?.data || {}
  const candidates = [
    data.caption,
    data.copy,
    data.text,
    data.default_caption,
    data.message,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  if (data.captions && typeof data.captions === 'object') {
    const first = Object.values(data.captions).find((v) => typeof v === 'string' && v.trim())
    if (first) return String(first).trim()
  }
  return null
}

function extractMediaUrls(execution) {
  const data = execution?.data || {}
  const raw = data.media_urls || data.mediaUrls || data.image_urls || data.assets || []
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === 'string' ? item : item?.url)).filter(Boolean)
  }
  if (typeof data.media_url === 'string' && data.media_url) return [data.media_url]
  if (typeof data.image_url === 'string' && data.image_url) return [data.image_url]
  if (typeof data.video_url === 'string' && data.video_url) return [data.video_url]
  return []
}

export { extractCaption, extractMediaUrls }
