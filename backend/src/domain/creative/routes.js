/**
 * Creative Asset Service HTTP routes.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findOne } from '../../persistence/index.js'
import { isValidPlatformKey, PLATFORM_KEYS } from '../../modules/social-cards/dimensions.js'
import { creditContextFromRequest } from '../../lib/credits/tenant-context.js'
import { publishSocialChannel } from '../../lib/publishing/publish-social-channel.js'
import {
  approveCreative,
  buildPublishPayloads,
  generateAiCreative,
  getCreativeIfOwned,
  resolveListingContext,
  updateVariantCopy,
} from './service.js'
import { listCreativesForSubject, loadCreativeBundle } from './repository.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getStorageConfig() {
  const env = (key, fallback = '') => process.env[key] ?? fallback
  return {
    storagePath: env('SOCIAL_CARDS_STORAGE_PATH', join(__dirname, '../../../uploads/social-cards')),
    publicBaseUrl: env('SOCIAL_CARDS_PUBLIC_BASE_URL', '/uploads/social-cards'),
  }
}

function normaliseChannelKeys(input) {
  const arr = Array.isArray(input) ? input : []
  return [...new Set(arr.filter((k) => isValidPlatformKey(String(k))))]
}

export function registerCreativeRoutes(app, { authMiddleware } = {}) {
  const auth = authMiddleware || ((_req, _res, next) => next())
  const storage = getStorageConfig()

  app.get('/api/listings/:id/creatives', auth, async (req, res) => {
    try {
      const { listing, agencyId, agentId } = await resolveListingContext(req.params.id, req.user.id)
      const creatives = await listCreativesForSubject('listing', listing.id, { agencyId, agentId })
      res.json({ creatives })
    } catch (err) {
      const status = err.code === 'LISTING_NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 500
      res.status(status).json({ error: err.message, code: err.code || null })
    }
  })

  app.post('/api/listings/:id/creatives/generate', auth, async (req, res) => {
    try {
      const { listing, agent, agencyId, agentId } = await resolveListingContext(req.params.id, req.user.id)
      const channelKeys = normaliseChannelKeys(req.body?.channel_keys || req.body?.platforms)
      if (!channelKeys.length) {
        return res.status(400).json({ error: `channel_keys must include at least one of: ${PLATFORM_KEYS.join(', ')}` })
      }

      const description = String(req.body?.description || listing.description || listing.title || '').trim()
      if (!description) {
        return res.status(400).json({ error: 'description is required (or listing must have description/title)' })
      }

      const templateId = req.body?.template_id || 'platform_editorial_v1'
      const template = await findOne('social_card_templates', (t) => t.id === templateId)
      if (!template) {
        return res.status(404).json({ error: `Template not found: ${templateId}` })
      }

      const provider = req.body?.provider === 'bannerbear' ? 'bannerbear' : 'local'
      const bundle = await generateAiCreative({
        listing,
        agent,
        agencyId,
        agentId,
        channelKeys,
        description,
        template,
        provider,
        storageRoot: storage.storagePath,
        publicBaseUrl: storage.publicBaseUrl,
        brand: req.body?.brand || null,
        creditContext: creditContextFromRequest(req, { relatedEntityId: listing.id, callType: 'creativeGenerate' }),
      })

      res.json(bundle)
    } catch (err) {
      const status = err.code === 'LISTING_NOT_FOUND' ? 404
        : err.code === 'FORBIDDEN' ? 403
          : err.code === 'LANGUAGE_NOT_YET_SUPPORTED' ? 400
            : 500
      res.status(status).json({ error: err.message, code: err.code || null })
    }
  })

  app.get('/api/creatives/:id', auth, async (req, res) => {
    const bundle = await getCreativeIfOwned(req.params.id, req.user.id)
    if (!bundle) return res.status(404).json({ error: 'Creative not found' })
    res.json(bundle)
  })

  app.patch('/api/creative-variants/:id', auth, async (req, res) => {
    try {
      const agent = await findOne('agents', (a) => a.id === req.user.id)
      const agencyId = agent?.agency_id || null
      const variant = await updateVariantCopy(
        req.params.id,
        req.body?.copy || {},
        { agencyId, agentId: req.user.id },
      )
      res.json({ variant })
    } catch (err) {
      const status = err.code === 'VARIANT_NOT_FOUND' ? 404 : 500
      res.status(status).json({ error: err.message, code: err.code || null })
    }
  })

  app.post('/api/creatives/:id/approve', auth, async (req, res) => {
    try {
      const agent = await findOne('agents', (a) => a.id === req.user.id)
      const agencyId = agent?.agency_id || null
      const decision = req.body?.decision === 'rejected' ? 'rejected' : 'approved'
      const bundle = await approveCreative(req.params.id, {
        agencyId,
        agentId: req.user.id,
        decidedBy: req.user.id,
        decision,
        note: req.body?.note || null,
      })
      res.json(bundle)
    } catch (err) {
      const status = err.code === 'CREATIVE_NOT_FOUND' ? 404
        : err.code === 'NOT_PENDING' ? 409
          : 500
      res.status(status).json({ error: err.message, code: err.code || null })
    }
  })

  app.post('/api/creatives/:id/publish', auth, async (req, res) => {
    try {
      const bundle = await getCreativeIfOwned(req.params.id, req.user.id)
      if (!bundle) return res.status(404).json({ error: 'Creative not found' })

      const selections = Array.isArray(req.body?.selections) ? req.body.selections : []
      if (!selections.length) {
        return res.status(400).json({ error: 'selections[] is required' })
      }

      const payloads = buildPublishPayloads(bundle, selections)
      const { listing } = await resolveListingContext(bundle.creative.subject_id, req.user.id)

      const results = []
      const creditContext = creditContextFromRequest(req, { relatedEntityId: listing.id, callType: 'creativePublish' })
      for (const payload of payloads) {
        try {
          const publishResult = await publishSocialChannel({
            agentId: req.user.id,
            platform: payload.platform,
            format: payload.format,
            caption: payload.caption,
            mediaUrls: [payload.media_url],
            creditContext,
          })
          results.push({
            variant_id: payload.variant_id,
            channel_key: payload.channel_key,
            platform: payload.platform,
            status: 'published',
            ...publishResult,
          })
        } catch (publishErr) {
          results.push({
            variant_id: payload.variant_id,
            channel_key: payload.channel_key,
            platform: payload.platform,
            status: 'failed',
            error: publishErr.message,
            error_code: publishErr.code || null,
          })
        }
      }

      res.json({ creative_id: bundle.creative.id, results })
    } catch (err) {
      const status = err.code === 'APPROVAL_PENDING' || err.code === 'APPROVAL_REJECTED' ? 403
        : err.code === 'VARIANT_NOT_FOUND' || err.code === 'RENDITION_NOT_FOUND' ? 400
          : 500
      res.status(status).json({ error: err.message, code: err.code || null })
    }
  })
}
