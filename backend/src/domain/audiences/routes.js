/**
 * Wave 1D — Audience REST routes.
 */

import { z } from 'zod'
import {
  createAudience,
  deleteAudience,
  getAudience,
  listAudiences,
  updateAudience,
} from './repository.js'
import { resolveAudience } from './resolve.js'

const audienceRuleSchema = z.object({
  field: z.enum(['status', 'source', 'tags', 'territory']),
  operator: z.enum(['is', 'is_not', 'contains']),
  value: z.string(),
})

const rulesSchema = z.object({
  tags_filter: z.array(z.string()).optional(),
  audience_rules: z.array(audienceRuleSchema).optional(),
  static_contact_ids: z.array(z.string()).optional(),
}).passthrough()

const createSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['static', 'dynamic']).optional(),
  rules: rulesSchema.optional(),
  member_source: z.enum(['crm', 'followers', 'lookalike', 'uploaded']).optional(),
  estimated_size: z.number().int().nullable().optional(),
  data: z.record(z.unknown()).optional(),
}).strict()

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.enum(['static', 'dynamic']).optional(),
  rules: rulesSchema.optional(),
  member_source: z.enum(['crm', 'followers', 'lookalike', 'uploaded']).optional(),
  estimated_size: z.number().int().nullable().optional(),
  data: z.record(z.unknown()).optional(),
}).strict()

const resolveSchema = z.object({
  channel: z.enum(['email', 'sms', 'whatsapp']).optional(),
  purpose: z.enum(['marketing', 'transactional', 'nurture']).optional(),
}).strict()

function tenantFromRequest(req) {
  return {
    agencyId: req.agencyId || req.body?.agency_id || req.query?.agency_id || null,
    agentId: req.user?.id || null,
  }
}

export function registerAudienceRoutes(app, { authMiddleware, logActivity }) {
  app.get('/api/audiences', authMiddleware, async (req, res) => {
    try {
      const tenant = tenantFromRequest(req)
      const audiences = await listAudiences({
        agencyId: tenant.agencyId,
        agentId: tenant.agentId,
        type: req.query.type || null,
      })
      res.json(audiences)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  app.post('/api/audiences', authMiddleware, async (req, res) => {
    try {
      const body = createSchema.parse(req.body)
      const tenant = tenantFromRequest(req)
      const audience = await createAudience({
        name: body.name,
        type: body.type,
        rules: body.rules,
        memberSource: body.member_source,
        estimatedSize: body.estimated_size,
        agencyId: tenant.agencyId,
        agentId: tenant.agentId,
        data: body.data,
      })
      await logActivity?.({
        type: 'audience_created',
        agent_id: tenant.agentId,
        meta: { audience_id: audience.id },
      })
      res.status(201).json(audience)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  app.get('/api/audiences/:id', authMiddleware, async (req, res) => {
    try {
      const tenant = tenantFromRequest(req)
      const audience = await getAudience(req.params.id, tenant)
      if (!audience) return res.status(404).json({ error: 'Audience not found' })
      res.json(audience)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  app.patch('/api/audiences/:id', authMiddleware, async (req, res) => {
    try {
      const body = updateSchema.parse(req.body)
      const tenant = tenantFromRequest(req)
      const updated = await updateAudience(req.params.id, body, tenant)
      if (!updated) return res.status(404).json({ error: 'Audience not found' })
      await logActivity?.({
        type: 'audience_updated',
        agent_id: tenant.agentId,
        meta: { audience_id: req.params.id },
      })
      res.json(updated)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  app.delete('/api/audiences/:id', authMiddleware, async (req, res) => {
    try {
      const tenant = tenantFromRequest(req)
      const deleted = await deleteAudience(req.params.id, tenant)
      if (!deleted) return res.status(404).json({ error: 'Audience not found' })
      await logActivity?.({
        type: 'audience_deleted',
        agent_id: tenant.agentId,
        meta: { audience_id: req.params.id },
      })
      res.json({ success: true })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  app.post('/api/audiences/:id/resolve', authMiddleware, async (req, res) => {
    try {
      const body = resolveSchema.parse(req.body || {})
      const tenant = tenantFromRequest(req)
      const result = await resolveAudience(req.params.id, {
        channel: body.channel || 'email',
        purpose: body.purpose || 'marketing',
        agencyId: tenant.agencyId,
        agentId: tenant.agentId,
      })
      res.json(result)
    } catch (error) {
      const status = error.code === 'AUDIENCE_NOT_FOUND' ? 404 : 400
      res.status(status).json({ error: error.message })
    }
  })
}
