/**
 * AGN-ROU-002 — agency lead routing rule editor API.
 */
import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { findOne } from '../../db.js'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import {
  CONDITION_FIELDS,
  CONDITION_OPS,
  ROUTING_STRATEGIES,
  ROUTING_TRIGGERS,
  createAgencyRoutingRule,
  deleteAgencyRoutingRule,
  getAgencyRoutingRule,
  listAgencyRoutingRules,
  updateAgencyRoutingRule,
} from './agency-routing-rules.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

const conditionSchema = z.object({
  field: z.enum(CONDITION_FIELDS),
  op: z.enum(CONDITION_OPS),
  value: z.string().min(1).max(200),
}).strict()

const filtersSchema = z.object({
  match: z.enum(['all', 'any']).optional(),
  conditions: z.array(conditionSchema).max(20).optional(),
}).strict()

const targetSchema = z.object({
  strategy: z.enum(ROUTING_STRATEGIES).optional(),
  assign_to_agent_id: z.string().optional().nullable(),
  round_robin_group_id: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
}).strict()

const writeSchema = z.object({
  name: z.string().min(1).max(120),
  priority: z.number().int().min(1).max(9999).optional(),
  trigger: z.enum(ROUTING_TRIGGERS).optional(),
  strategy: z.enum(ROUTING_STRATEGIES).optional(),
  relationship_priority: z.boolean().optional(),
  filters: filtersSchema.optional(),
  target: targetSchema.optional(),
  eligible_members: z.record(z.unknown()).optional(),
  strategy_config: z.record(z.unknown()).optional(),
  claim_timeout_seconds: z.number().int().positive().nullable().optional(),
  response_timeout_seconds: z.number().int().positive().nullable().optional(),
  max_attempts: z.number().int().min(1).max(20).optional(),
  cooldown_seconds: z.number().int().min(0).max(86400).optional(),
  escalation_membership_id: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
}).strict()

const updateSchema = writeSchema.partial().refine((body) => Object.keys(body).length > 0, {
  message: 'At least one field required',
})

async function requireAgencyAdmin(req, res, next) {
  const memberships = await listUserAgencyMemberships(req.user.id)
  const membership = memberships.find((row) => row.affiliation_mode === 'exclusive' && ADMIN_ROLES.has(row.role))
  if (!membership?.agency_id) {
    return res.status(403).json({ error: 'Agency admin access required' })
  }
  const agency = await findOne('agencies', (row) => row.id === membership.agency_id)
  if (!agency) return res.status(404).json({ error: 'Agency not found' })
  req.agencyId = membership.agency_id
  req.membership = membership
  next()
}

export function registerAgencyRoutingRuleRoutes(app, deps = {}) {
  const auth = deps.authMiddleware || authMiddleware

  app.get('/api/agency/routing/rules', auth, requireAgencyAdmin, async (req, res) => {
    res.json({ rules: await listAgencyRoutingRules(req.agencyId) })
  })

  app.get('/api/agency/routing/rules/:id', auth, requireAgencyAdmin, async (req, res) => {
    const rule = await getAgencyRoutingRule(req.agencyId, req.params.id)
    if (!rule) return res.status(404).json({ error: 'Rule not found' })
    res.json(rule)
  })

  app.post('/api/agency/routing/rules', auth, requireAgencyAdmin, async (req, res) => {
    const parsed = writeSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    }
    const payload = {
      ...parsed.data,
      strategy: parsed.data.target?.strategy || parsed.data.strategy || 'round_robin',
    }
    const rule = await createAgencyRoutingRule(req.agencyId, req.user.id, payload)
    res.status(201).json(rule)
  })

  app.put('/api/agency/routing/rules/:id', auth, requireAgencyAdmin, async (req, res) => {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    }
    const payload = {
      ...parsed.data,
      strategy: parsed.data.target?.strategy || parsed.data.strategy,
    }
    const rule = await updateAgencyRoutingRule(req.agencyId, req.params.id, payload)
    if (!rule) return res.status(404).json({ error: 'Rule not found' })
    res.json(rule)
  })

  app.delete('/api/agency/routing/rules/:id', auth, requireAgencyAdmin, async (req, res) => {
    const deleted = await deleteAgencyRoutingRule(req.agencyId, req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Rule not found' })
    res.json({ success: true })
  })
}

export { registerAgencyRoutingRuleRoutes as registerRoutes }
