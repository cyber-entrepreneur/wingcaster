/**
 * Agent routes for the WhatsApp Listing module.
 */

import { z } from 'zod'
import { authMiddleware } from '../../../auth.js'
import { findAll, findOne, update } from '../../../db.js'
import { Collections, findAllModule, findOneModule, updateModule } from '../infrastructure/db.js'

const analyticsQuerySchema = z
  .object({
    range: z.enum(['7d', '30d', '90d']).default('30d'),
  })
  .strict()

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 }
const DAY_MS = 24 * 60 * 60 * 1000
const FIELD_DEFINITIONS = [
  { field: 'title', label: 'Title', keys: ['title'] },
  { field: 'price', label: 'Price', keys: ['price', 'price_cents'] },
  { field: 'bedrooms', label: 'Bedrooms', keys: ['bedrooms'] },
  { field: 'bathrooms', label: 'Bathrooms', keys: ['bathrooms'] },
  { field: 'property_type', label: 'Property type', keys: ['property_type', 'type'] },
  { field: 'location', label: 'Location', keys: ['address_display', 'address', 'location', 'area_name'] },
  { field: 'description', label: 'Description', keys: ['description'] },
]

function asTimestamp(value) {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== ''
}

function clampConfidence(value) {
  const confidence = Number(value)
  if (!Number.isFinite(confidence)) return null
  return Math.max(0, Math.min(1, confidence))
}

function fieldConfidence(property, definition) {
  const confidenceMap =
    property?.field_confidences ||
    property?.field_confidence ||
    property?.confidence_by_field ||
    {}
  for (const key of definition.keys) {
    const explicit = clampConfidence(confidenceMap[key])
    if (explicit !== null) return explicit
  }
  const populated = definition.keys.some((key) => hasValue(property?.[key]))
  return populated ? clampConfidence(property?.confidence) : null
}

/**
 * AGT-WLA-005 analytics aggregator. `drafts` must already be scoped to the
 * authenticated agent. The result deliberately calls the field metric
 * model-confidence rather than verified accuracy: corrected-field history is
 * not retained, so claiming ground-truth accuracy would be misleading.
 */
export function buildAgentAnalytics({ drafts, usageRows, range, quota, now = new Date() }) {
  const days = RANGE_DAYS[range]
  const endDayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const startMs = endDayMs - (days - 1) * DAY_MS
  const endMs = endDayMs + DAY_MS
  const inRange = (value) => {
    const timestamp = asTimestamp(value)
    return timestamp !== null && timestamp >= startMs && timestamp < endMs
  }

  const filteredDrafts = drafts.filter((draft) => inRange(draft.created_at))
  const approvedDrafts = filteredDrafts.filter((draft) => draft.status === 'published')
  const discardedDrafts = filteredDrafts.filter((draft) => draft.status === 'discarded')
  const awaitingDrafts = filteredDrafts.filter((draft) => draft.status === 'awaiting_approval')
  const approvalMinutes = approvedDrafts
    .map((draft) => {
      const created = asTimestamp(draft.created_at)
      const approved = asTimestamp(draft.updated_at)
      if (created === null || approved === null || approved < created) return null
      return (approved - created) / 60_000
    })
    .filter((value) => value !== null)

  const activityByDate = new Map()
  for (let index = 0; index < days; index += 1) {
    const date = new Date(startMs + index * DAY_MS).toISOString().slice(0, 10)
    activityByDate.set(date, { date, drafts: 0, approved: 0 })
  }
  for (const draft of filteredDrafts) {
    const date = new Date(draft.created_at).toISOString().slice(0, 10)
    const bucket = activityByDate.get(date)
    if (!bucket) continue
    bucket.drafts += 1
    if (draft.status === 'published') bucket.approved += 1
  }

  const fieldAccuracy = FIELD_DEFINITIONS.map((definition) => {
    const confidences = filteredDrafts
      .map((draft) => fieldConfidence(draft.extracted_property || {}, definition))
      .filter((value) => value !== null)
    if (!confidences.length) return null
    return {
      field: definition.field,
      label: definition.label,
      accuracy: Math.round(
        (confidences.reduce((sum, value) => sum + value, 0) / confidences.length) * 100,
      ),
      sample_size: confidences.length,
    }
  }).filter(Boolean)

  const aiCostMicroUsd = usageRows
    .filter((row) => inRange(row.occurred_at || row.created_at))
    .reduce((sum, row) => sum + Math.max(0, Number(row.cost_estimate_micro_usd) || 0), 0)
  const approvalRate = filteredDrafts.length
    ? Math.round((approvedDrafts.length / filteredDrafts.length) * 100)
    : 0

  return {
    range: {
      key: range,
      days,
      from: new Date(startMs).toISOString(),
      to: new Date(endMs - 1).toISOString(),
    },
    summary: {
      total_drafts: filteredDrafts.length,
      approved: approvedDrafts.length,
      approval_rate: approvalRate,
      avg_approval_minutes: approvalMinutes.length
        ? Math.round(approvalMinutes.reduce((sum, value) => sum + value, 0) / approvalMinutes.length)
        : null,
      // Historical column name says micro-USD; canonical logger unit is USD × 10,000.
      ai_cost_estimate_usd: Number((aiCostMicroUsd / 10_000).toFixed(4)),
    },
    activity: [...activityByDate.values()],
    field_accuracy: fieldAccuracy,
    field_accuracy_basis: 'model_confidence',
    quota,
    // Backward-compatible fields used by the combined drafts/settings screen.
    total_drafts: filteredDrafts.length,
    published: approvedDrafts.length,
    discarded: discardedDrafts.length,
    awaiting_approval: awaitingDrafts.length,
    approval_rate: approvalRate,
  }
}

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
      const parsed = analyticsQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid analytics filters',
          details: parsed.error.flatten(),
        })
      }
      const [drafts, usageRows] = await Promise.all([
        findAllModule(Collections.DRAFTS, (d) => d.agent_id === req.user.id),
        findAll(
          'ai_call_usage',
          (row) => row.tenant_id === req.user.id && row.feature === 'whatsapp-listings',
        ),
      ])
      const quota = await entitlements.checkMonthlyQuota({ agentId: req.user.id })
      res.json(
        buildAgentAnalytics({
          drafts,
          usageRows,
          range: parsed.data.range,
          quota,
        }),
      )
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
