/**
 * Creative Asset Service — orchestration for generation, approval, publish prep.
 */

import { findOne } from '../../persistence/index.js'
import { produceAiPostVariants } from '../../lib/credits/ai-producers/create-ai-post-variants.js'
import { isValidPlatformKey, PLATFORM_DIMENSIONS } from '../../modules/social-cards/dimensions.js'
import { createRendererProvider } from './renderer-providers.js'
import {
  aiChannelsForKeys,
  CHANNEL_KEY_TO_AI_CHANNEL,
  CHANNEL_KEY_TO_PUBLISH,
  hasPublicChannels,
  variantLabelForTone,
} from './constants.js'
import {
  createApprovalRequest,
  createCreative,
  createRendition,
  createVariant,
  getVariant,
  loadCreativeBundle,
  updateApprovalRequest,
  updateCreative,
  updateVariant,
} from './repository.js'

function assertChannelKeys(channelKeys) {
  const keys = Array.isArray(channelKeys) ? channelKeys.filter((k) => isValidPlatformKey(k)) : []
  if (!keys.length) {
    throw Object.assign(new Error('At least one valid channel_key is required'), { code: 'INVALID_CHANNELS' })
  }
  return keys
}

function copyForChannelKeys(variantCaptions, channelKeys) {
  const out = {}
  for (const key of channelKeys) {
    const aiChannel = CHANNEL_KEY_TO_AI_CHANNEL[key]
    if (aiChannel && variantCaptions[aiChannel]) {
      out[key] = variantCaptions[aiChannel]
    }
  }
  return out
}

export async function generateAiCreative({
  listing,
  agent,
  agencyId,
  agentId,
  channelKeys,
  description,
  template,
  provider = 'local',
  storageRoot,
  publicBaseUrl,
  brand = null,
  creditContext = null,
}) {
  const keys = assertChannelKeys(channelKeys)
  const aiChannels = aiChannelsForKeys(keys)
  const needsApproval = hasPublicChannels(keys)

  const aiResult = await produceAiPostVariants({
    description,
    propertyPayload: listing,
    channels: aiChannels,
    language: 'en',
    creditContext,
    relatedEntityId: listing.id,
  })

  const approvalState = needsApproval ? 'pending' : 'not_required'
  const creative = await createCreative({
    agencyId,
    agentId,
    subjectType: 'listing',
    subjectId: listing.id,
    source: 'ai',
    approvalState,
    status: 'ready',
    channelKeys: keys,
    data: { description, template_id: template?.id || null },
  })

  if (needsApproval) {
    await createApprovalRequest({
      agencyId,
      agentId,
      subjectType: 'creative',
      subjectId: creative.id,
      requestedBy: agentId,
      state: 'pending',
      reviewers: [],
      decisionHistory: [],
      data: { policy: 'ai_public_content_requires_approval' },
    })
  }

  const renderer = createRendererProvider(provider)
  const variants = []

  for (let i = 0; i < aiResult.variants.length; i++) {
    const v = aiResult.variants[i]
    const label = v.label || variantLabelForTone(v.tone)
    const copy = copyForChannelKeys(v.captions, keys)
    const variant = await createVariant({
      agencyId,
      agentId,
      creativeId: creative.id,
      label,
      copy,
      sortOrder: i,
      data: { tone: v.tone },
    })

    const renditions = []
    for (const channelKey of keys) {
      const rendered = await renderer.renderRendition({
        template,
        listing,
        agent,
        brand,
        platform: channelKey,
        storageRoot,
        publicBaseUrl,
        creditContext,
        tenantId: agentId,
      })
      const dims = PLATFORM_DIMENSIONS[channelKey]
      const rendition = await createRendition({
        agencyId,
        agentId,
        creativeVariantId: variant.id,
        channelKey,
        width: rendered.width || dims.width,
        height: rendered.height || dims.height,
        provider: rendered.provider,
        assetUrl: rendered.asset_url,
        status: 'ready',
        data: rendered.meta || {},
      })
      renditions.push(rendition)
    }
    variants.push({ ...variant, renditions })
  }

  return loadCreativeBundle(creative.id, { agencyId, agentId })
}

export async function updateVariantCopy(variantId, copyPatch, { agencyId, agentId }) {
  const current = await getVariant(variantId, { agencyId, agentId })
  if (!current) {
    throw Object.assign(new Error('Variant not found'), { code: 'VARIANT_NOT_FOUND' })
  }
  const variant = await updateVariant(variantId, {
    copy: { ...current.copy, ...copyPatch },
  }, { agencyId, agentId })
  if (!variant) {
    throw Object.assign(new Error('Variant not found'), { code: 'VARIANT_NOT_FOUND' })
  }
  return variant
}

export async function approveCreative(creativeId, { agencyId, agentId, decidedBy, decision = 'approved', note = null }) {
  const bundle = await loadCreativeBundle(creativeId, { agencyId, agentId })
  if (!bundle?.creative) {
    throw Object.assign(new Error('Creative not found'), { code: 'CREATIVE_NOT_FOUND' })
  }
  if (bundle.creative.approval_state !== 'pending') {
    throw Object.assign(new Error('Creative is not pending approval'), { code: 'NOT_PENDING' })
  }

  const nextState = decision === 'rejected' ? 'rejected' : 'approved'
  await updateCreative(creativeId, { approval_state: nextState }, { agencyId, agentId })

  if (bundle.approval_request) {
    const history = Array.isArray(bundle.approval_request.decision_history)
      ? bundle.approval_request.decision_history
      : []
    history.push({
      decided_by: decidedBy,
      decision: nextState,
      note,
      decided_at: new Date().toISOString(),
    })
    await updateApprovalRequest(bundle.approval_request.id, {
      state: nextState,
      decision_history: history,
    }, { agencyId, agentId })
  }

  return loadCreativeBundle(creativeId, { agencyId, agentId })
}

export function assertPublishable(creative) {
  if (creative.source === 'ai' && creative.approval_state === 'pending') {
    throw Object.assign(
      new Error('AI-generated public creative requires approval before publish'),
      { code: 'APPROVAL_PENDING' },
    )
  }
  if (creative.approval_state === 'rejected') {
    throw Object.assign(
      new Error('Creative was rejected and cannot be published'),
      { code: 'APPROVAL_REJECTED' },
    )
  }
}

/**
 * Build publish-social payloads for selected variant/channel pairs.
 * Returns array of { variant_id, channel_key, platform, format, caption, media_url }.
 */
export function buildPublishPayloads(bundle, selections) {
  assertPublishable(bundle.creative)
  const payloads = []
  const variantMap = new Map(bundle.variants.map((v) => [v.id, v]))

  for (const sel of selections) {
    const variant = variantMap.get(sel.variant_id)
    if (!variant) {
      throw Object.assign(new Error(`Unknown variant: ${sel.variant_id}`), { code: 'VARIANT_NOT_FOUND' })
    }
    const rendition = (variant.renditions || []).find((r) => r.channel_key === sel.channel_key)
    if (!rendition?.asset_url) {
      throw Object.assign(
        new Error(`No rendition for variant ${sel.variant_id} on ${sel.channel_key}`),
        { code: 'RENDITION_NOT_FOUND' },
      )
    }
    const publishMeta = CHANNEL_KEY_TO_PUBLISH[sel.channel_key]
    if (!publishMeta) {
      throw Object.assign(new Error(`Channel ${sel.channel_key} is not publishable`), { code: 'NOT_PUBLISHABLE' })
    }
    const caption = variant.copy?.[sel.channel_key] || ''
    payloads.push({
      variant_id: sel.variant_id,
      channel_key: sel.channel_key,
      platform: publishMeta.platform,
      format: publishMeta.format || null,
      caption,
      media_url: rendition.asset_url,
      creative_id: bundle.creative.id,
    })
  }
  return payloads
}

export async function resolveListingContext(listingId, agentId) {
  const listing = await findOne('properties', (p) => p.id === listingId)
  if (!listing) {
    throw Object.assign(new Error('Listing not found'), { code: 'LISTING_NOT_FOUND' })
  }
  if (listing.agent_id !== agentId) {
    throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' })
  }
  const agent = await findOne('agents', (a) => a.id === agentId)
  const agencyId = agent?.agency_id || null
  return { listing, agent, agencyId, agentId }
}

export async function getCreativeIfOwned(creativeId, agentId) {
  const agent = await findOne('agents', (a) => a.id === agentId)
  const agencyId = agent?.agency_id || null
  const bundle = await loadCreativeBundle(creativeId, { agencyId, agentId })
  if (!bundle?.creative) return null
  const listing = await findOne('properties', (p) => p.id === bundle.creative.subject_id)
  if (!listing || listing.agent_id !== agentId) return null
  return bundle
}
