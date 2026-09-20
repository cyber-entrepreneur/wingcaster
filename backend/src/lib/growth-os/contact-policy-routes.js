/**
 * Wave 2E — ContactPolicy REST routes.
 */

import { z } from 'zod'
import { findOne } from '../../persistence/index.js'
import {
  getContactPolicy,
  listContactPolicies,
  upsertContactPolicy,
} from '../../lib/growth-os/contact-policy.js'

const frequencyCapSchema = z.object({
  channel: z.enum(['email', 'sms', 'whatsapp']),
  purpose: z.enum(['marketing', 'transactional', 'nurture']).optional(),
  max_sends: z.number().int().min(0),
  window_hours: z.number().positive(),
})

const quietWindowSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).optional(),
  start: z.string(),
  end: z.string(),
})

const doNotContactSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  channels: z.array(z.string()).optional(),
  reason: z.string().optional(),
})

const rulesSchema = z.object({
  frequency_caps: z.array(frequencyCapSchema).optional(),
  quiet_hours: z.object({
    timezone: z.string().optional(),
    windows: z.array(quietWindowSchema),
  }).nullable().optional(),
  do_not_contact_windows: z.array(doNotContactSchema).optional(),
  campaign_priority: z.array(z.record(z.unknown())).optional(),
  negotiation_suppression: z.boolean().optional(),
}).passthrough()

const upsertSchema = z.object({
  id: z.string().optional(),
  scope: z.enum(['agency', 'agent']).optional(),
  name: z.string().trim().min(1).optional(),
  rules: rulesSchema,
  data: z.record(z.unknown()).optional(),
}).strict()

async function tenantFromRequest(req) {
  const agent = await findOne('agents', (a) => a.id === req.user?.id)
  return {
    agencyId: req.agencyId || agent?.agency_id || null,
    agentId: req.user?.id || null,
  }
}

export function registerContactPolicyRoutes(app, { authMiddleware, logActivity }) {
  app.get('/api/contact-policies', authMiddleware, async (req, res) => {
    try {
      const tenant = await tenantFromRequest(req)
      const policies = await listContactPolicies({
        agencyId: tenant.agencyId,
        agentId: tenant.agentId,
        scope: req.query.scope || null,
      })
      res.json(policies)
    } catch (error) {
      res.status(400).json({ error: error.message, code: error.code })
    }
  })

  app.get('/api/contact-policies/:id', authMiddleware, async (req, res) => {
    try {
      const tenant = await tenantFromRequest(req)
      const policy = await getContactPolicy(req.params.id, tenant)
      if (!policy) return res.status(404).json({ error: 'Contact policy not found' })
      res.json(policy)
    } catch (error) {
      res.status(400).json({ error: error.message, code: error.code })
    }
  })

  app.put('/api/contact-policies', authMiddleware, async (req, res) => {
    try {
      const body = upsertSchema.parse(req.body)
      const tenant = await tenantFromRequest(req)
      const scope = body.scope || 'agency'
      if (scope === 'agency' && !tenant.agencyId) {
        return res.status(400).json({ error: 'Agency membership required', code: 'MISSING_AGENCY_ID' })
      }
      const policy = await upsertContactPolicy({
        id: body.id || null,
        scope,
        name: body.name,
        rules: body.rules || {},
        agencyId: tenant.agencyId,
        agentId: tenant.agentId,
        data: body.data || {},
      })
      await logActivity?.({
        type: 'contact_policy_upserted',
        agent_id: tenant.agentId,
        meta: { contact_policy_id: policy.id, scope: policy.scope },
      })
      res.json(policy)
    } catch (error) {
      const status = error?.name === 'ZodError' ? 400 : 400
      res.status(status).json({ error: error.message, code: error.code })
    }
  })
}
