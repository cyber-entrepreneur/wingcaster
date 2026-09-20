/**
 * Wave 2C — attribution HTTP routes.
 *
 *   POST /api/agency/attribution/materialise
 *   POST /api/agency/attribution/recompute
 *   GET  /api/agency/analytics/attribution-performance
 *   GET  /api/agency/analytics/attribution-chain/:conversionId
 */
import { z } from 'zod'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import { LAUNCH_ATTRIBUTION_MODELS, ATTRIBUTION_MODELS } from './constants.js'
import { materialiseConversionsForTenant, listConversions, getConversion } from './conversions.js'
import { attributeConversions, recomputeAttributionCredits } from './attribution-engine.js'
import { getAttributionPerformance, getConversionAttributionChain } from './rollups.js'

const modelSchema = z.enum([...ATTRIBUTION_MODELS])

async function resolveExclusiveMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((row) => row.affiliation_mode === 'exclusive') || null
}

export function registerAttributionRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('attribution-routes requires authMiddleware')

  app.post('/api/agency/attribution/materialise', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const body = z
      .object({
        contact_id: z.string().optional(),
        correlation_id: z.string().optional(),
        attribute: z.boolean().optional(),
        models: z.array(modelSchema).optional(),
      })
      .strict()
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }

    const results = await materialiseConversionsForTenant({
      agencyId: membership.agency_id,
      contactId: body.data.contact_id,
      correlationId: body.data.correlation_id,
    })
    let attribution = null
    if (body.data.attribute !== false) {
      attribution = await attributeConversions({
        agencyId: membership.agency_id,
        models: body.data.models || LAUNCH_ATTRIBUTION_MODELS,
      })
    }
    res.json({
      materialised: results.filter((r) => r.inserted).length,
      total_considered: results.length,
      attribution_runs: attribution?.length ?? 0,
    })
  })

  app.post('/api/agency/attribution/recompute', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const body = z
      .object({
        conversion_id: z.string().optional(),
        model: modelSchema,
      })
      .strict()
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }

    if (body.data.conversion_id) {
      const result = await recomputeAttributionCredits({
        conversionId: body.data.conversion_id,
        model: body.data.model,
        agencyId: membership.agency_id,
      })
      return res.json(result)
    }

    const results = await attributeConversions({
      agencyId: membership.agency_id,
      models: [body.data.model],
    })
    res.json({ runs: results.length, results })
  })

  app.get('/api/agency/analytics/attribution-performance', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const parsed = z
      .object({
        model: modelSchema.optional(),
        campaign_id: z.string().optional(),
        execution_id: z.string().optional(),
        agent_id: z.string().optional(),
      })
      .strict()
      .safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
    }

    const payload = await getAttributionPerformance({
      agencyId: membership.agency_id,
      agentId: parsed.data.agent_id || null,
      model: parsed.data.model || 'last',
      campaignId: parsed.data.campaign_id || null,
      executionId: parsed.data.execution_id || null,
    })
    res.json(payload)
  })

  app.get(
    '/api/agency/analytics/attribution-chain/:conversionId',
    authMiddleware,
    async (req, res) => {
      const membership = await resolveExclusiveMembership(req.user.id)
      if (!membership?.agency_id) {
        return res.status(403).json({ error: 'Active agency membership required' })
      }
      const parsed = z
        .object({ model: modelSchema.optional() })
        .strict()
        .safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
      }

      try {
        const chain = await getConversionAttributionChain({
          conversionId: req.params.conversionId,
          agencyId: membership.agency_id,
          model: parsed.data.model || 'last',
        })
        res.json(chain)
      } catch (err) {
        if (err?.code === 'CONVERSION_NOT_FOUND') {
          return res.status(404).json({ error: 'Conversion not found' })
        }
        throw err
      }
    },
  )

  app.get('/api/agency/attribution/conversions', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const rows = await listConversions({ agencyId: membership.agency_id })
    res.json({ conversions: rows })
  })

  app.get('/api/agency/attribution/conversions/:id', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const row = await getConversion(req.params.id, { agencyId: membership.agency_id })
    if (!row) return res.status(404).json({ error: 'Conversion not found' })
    res.json(row)
  })
}

export { registerAttributionRoutes as registerRoutes }
