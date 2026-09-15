/**
 * Agent routes for the WhatsApp Listing module.
 */

import { authMiddleware } from '../../../auth.js'
import { findOne, update } from '../../../db.js'
import { Collections, findAllModule, findOneModule, updateModule } from '../infrastructure/db.js'

export function registerAgentRoutes(app, { entitlements, credits, pipeline, config }) {
  app.get('/api/agent/whatsapp-listings/drafts', authMiddleware, async (req, res) => {
    try {
      const drafts = await findAllModule(Collections.DRAFTS, (d) => d.agent_id === req.user.id)
      const sorted = drafts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      res.json(sorted)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/agent/whatsapp-listings/drafts/:id', authMiddleware, async (req, res) => {
    try {
      const draft = await findOneModule(Collections.DRAFTS, (d) => d.id === req.params.id && d.agent_id === req.user.id)
      if (!draft) return res.status(404).json({ error: 'Draft not found' })
      res.json(draft)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * Partial PATCH for AGT-ONB-003 inline editors (BE-NEW-07 / BE-VERIFY-19).
   * Also mounted at `/api/onboarding/drafts/:id` for the onboarding funnel client.
   */
  async function patchDraftHandler(req, res) {
    try {
      const draft = await findOneModule(Collections.DRAFTS, (d) => d.id === req.params.id && d.agent_id === req.user.id)
      if (!draft) return res.status(404).json({ error: 'Draft not found' })
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const extracted = { ...(draft.extracted_property || {}) }

      if (body.price_cents != null && Number.isFinite(Number(body.price_cents))) {
        const cents = Math.round(Number(body.price_cents))
        extracted.price = cents / 100
        extracted.price_cents = cents
      } else if (body.price != null && Number.isFinite(Number(body.price))) {
        const major = Number(body.price)
        extracted.price = major
        extracted.price_cents = Math.round(major * 100)
      }
      if (typeof body.currency === 'string' && body.currency.trim()) {
        extracted.currency = body.currency.trim().toUpperCase()
      }
      if (typeof body.description === 'string') extracted.description = body.description
      if (typeof body.address === 'string') {
        extracted.address = body.address
        extracted.address_display = body.address
      }
      if (typeof body.area_name === 'string') extracted.area_name = body.area_name
      if (typeof body.building_name === 'string') extracted.building_name = body.building_name
      if (typeof body.floor === 'string' || typeof body.floor === 'number') {
        extracted.floor = String(body.floor)
      }
      if (body.lat != null && Number.isFinite(Number(body.lat))) extracted.lat = Number(body.lat)
      if (body.lng != null && Number.isFinite(Number(body.lng))) extracted.lng = Number(body.lng)

      let photo_urls = draft.photo_urls
      if (Array.isArray(body.photo_urls)) photo_urls = body.photo_urls.filter(Boolean)
      else if (Array.isArray(body.photos)) {
        photo_urls = body.photos
          .map((item) => (typeof item === 'string' ? item : item?.url))
          .filter(Boolean)
      }

      const updated = await updateModule(
        Collections.DRAFTS,
        (d) => d.id === draft.id,
        (d) => ({
          ...d,
          extracted_property: extracted,
          photo_urls: photo_urls ?? d.photo_urls,
          photos: photo_urls ?? d.photos,
          address: extracted.address ?? d.address,
          area_name: extracted.area_name ?? d.area_name,
          building_name: extracted.building_name ?? d.building_name,
          floor: extracted.floor ?? d.floor,
          description: extracted.description ?? d.description,
          price: extracted.price ?? d.price,
          currency: extracted.currency ?? d.currency,
          updated_at: new Date().toISOString(),
        }),
      )
      res.json(updated || { ...draft, extracted_property: extracted, photo_urls })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }

  app.patch('/api/agent/whatsapp-listings/drafts/:id', authMiddleware, patchDraftHandler)
  app.patch('/api/onboarding/drafts/:id', authMiddleware, patchDraftHandler)

  app.post('/api/agent/whatsapp-listings/drafts/:id/approve', authMiddleware, async (req, res) => {
    try {
      const draft = await findOneModule(Collections.DRAFTS, (d) => d.id === req.params.id && d.agent_id === req.user.id)
      if (!draft) return res.status(404).json({ error: 'Draft not found' })
      const session = await findOneModule(Collections.SESSIONS, (s) => s.id === draft.session_id)
      if (!session) return res.status(404).json({ error: 'Session not found' })
      const result = await pipeline.publishDraft(session.id, { publishSocial: req.body.publish_social || false })
      res.json({ success: true, result })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/agent/whatsapp-listings/drafts/:id/discard', authMiddleware, async (req, res) => {
    try {
      const draft = await findOneModule(Collections.DRAFTS, (d) => d.id === req.params.id && d.agent_id === req.user.id)
      if (!draft) return res.status(404).json({ error: 'Draft not found' })
      await pipeline.discardDraft(draft.session_id)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/agent/whatsapp-listings/drafts/:id/reprocess', authMiddleware, async (req, res) => {
    try {
      const draft = await findOneModule(Collections.DRAFTS, (d) => d.id === req.params.id && d.agent_id === req.user.id)
      if (!draft) return res.status(404).json({ error: 'Draft not found' })
      const session = await findOneModule(Collections.SESSIONS, (s) => s.id === draft.session_id)
      if (!session) return res.status(404).json({ error: 'Session not found' })
      await updateModule(Collections.SESSIONS, (s) => s.id === session.id, (s) => ({ ...s, state: 'collecting', updated_at: new Date().toISOString() }))
      res.json({ success: true, message: 'Send new details or photos to re-process.' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/agent/whatsapp-listings/settings', authMiddleware, async (req, res) => {
    try {
      const agent = await findOne('agents', (a) => a.id === req.user.id)
      const agencyId = agent?.agency_id || null
      const entitlement = await entitlements.getConfig({ agentId: req.user.id, agencyId })
      res.json({
        ai_provider_preference: agent?.whatsapp_listings_ai_provider || config.aiProvider,
        default_template_variant: agent?.whatsapp_listings_template_variant || 'modern',
        auto_publish_social: agent?.whatsapp_listings_auto_publish_social || entitlement.auto_publish_social || false,
        ai_providers_allowed: entitlement.ai_providers_allowed || [],
        thumbnail_variants_allowed: entitlement.thumbnail_variants || [],
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.patch('/api/agent/whatsapp-listings/settings', authMiddleware, async (req, res) => {
    try {
      const allowed = ['whatsapp_listings_ai_provider', 'whatsapp_listings_template_variant', 'whatsapp_listings_auto_publish_social']
      const patch = {}
      for (const key of allowed) {
        if (req.body[key] !== undefined) patch[key] = req.body[key]
      }
      await update('agents', (a) => a.id === req.user.id, (a) => ({ ...a, ...patch, updated_at: new Date().toISOString() }))
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/agent/whatsapp-listings/analytics', authMiddleware, async (req, res) => {
    try {
      const drafts = await findAllModule(Collections.DRAFTS, (d) => d.agent_id === req.user.id)
      const published = drafts.filter((d) => d.status === 'published').length
      const discarded = drafts.filter((d) => d.status === 'discarded').length
      const awaiting = drafts.filter((d) => d.status === 'awaiting_approval').length
      const quota = await entitlements.checkMonthlyQuota({ agentId: req.user.id })
      res.json({
        total_drafts: drafts.length,
        published,
        discarded,
        awaiting_approval: awaiting,
        approval_rate: drafts.length ? Math.round((published / drafts.length) * 100) : 0,
        quota,
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
