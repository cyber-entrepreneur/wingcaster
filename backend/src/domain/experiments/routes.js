/**
 * Wave 2D — Experiment HTTP routes.
 *
 *   GET    /api/agency/experiments
 *   POST   /api/agency/experiments
 *   GET    /api/agency/experiments/:id
 *   PATCH  /api/agency/experiments/:id
 *   POST   /api/agency/experiments/:id/start
 *   POST   /api/agency/experiments/:id/assign
 *   GET    /api/agency/experiments/:id/assignments
 *   GET    /api/agency/experiments/:id/results
 *   POST   /api/agency/experiments/:id/conclude
 */
import { z } from 'zod'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import {
  EXPERIMENT_ALLOCATIONS,
  EXPERIMENT_DIMENSIONS,
  EXPERIMENT_STATUSES,
} from './constants.js'
import {
  assignContact,
  computeExperimentResults,
  concludeExperiment,
  createExperiment,
  getExperiment,
  listAssignments,
  listExperiments,
  startExperiment,
  updateExperiment,
} from './service.js'

const dimensionSchema = z.enum([...EXPERIMENT_DIMENSIONS])
const allocationSchema = z.enum([...EXPERIMENT_ALLOCATIONS])
const statusSchema = z.enum([...EXPERIMENT_STATUSES])

const variantSchema = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
  weight: z.number().optional(),
  next: z.string().nullable().optional(),
  creative_variant_id: z.string().nullable().optional(),
  journey_path: z.string().nullable().optional(),
  is_control: z.boolean().optional(),
  payload: z.record(z.unknown()).optional(),
}).strict()

async function resolveExclusiveMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((row) => row.affiliation_mode === 'exclusive') || null
}

function mapError(err, res) {
  const code = err?.code
  if (code === 'EXPERIMENT_NOT_FOUND') return res.status(404).json({ error: err.message, code })
  if (code === 'NOT_CONFIGURED') return res.status(501).json({ error: err.message, code })
  if (
    code === 'INVALID_DIMENSION'
    || code === 'INVALID_ALLOCATION'
    || code === 'INVALID_STATUS'
    || code === 'INVALID_VARIANTS'
    || code === 'INVALID_GOAL_EVENT'
    || code === 'INVALID_WINNER'
    || code === 'INVALID_CONTACT'
    || code === 'INVALID_EXPERIMENT'
    || code === 'EXPERIMENT_NOT_RUNNING'
    || code === 'EXPERIMENT_CONCLUDED'
  ) {
    return res.status(400).json({ error: err.message, code })
  }
  if (code === 'TENANT_SCOPE_REQUIRED') {
    return res.status(403).json({ error: err.message, code })
  }
  throw err
}

export function registerExperimentRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('experiment-routes requires authMiddleware')

  app.get('/api/agency/experiments', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const parsed = z
      .object({
        campaign_id: z.string().optional(),
        status: statusSchema.optional(),
        dimension: dimensionSchema.optional(),
      })
      .strict()
      .safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
    }
    const rows = await listExperiments({
      agencyId: membership.agency_id,
      campaignId: parsed.data.campaign_id || null,
      status: parsed.data.status || null,
      dimension: parsed.data.dimension || null,
    })
    res.json({ experiments: rows })
  })

  app.post('/api/agency/experiments', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const body = z
      .object({
        campaign_id: z.string().nullable().optional(),
        dimension: dimensionSchema,
        variants: z.array(variantSchema).min(1),
        allocation: allocationSchema.optional(),
        holdout_pct: z.number().min(0).max(100).optional(),
        goal_event: z.string().min(1),
        status: statusSchema.optional(),
        data: z.record(z.unknown()).optional(),
      })
      .strict()
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }
    try {
      const experiment = await createExperiment({
        agencyId: membership.agency_id,
        campaignId: body.data.campaign_id ?? null,
        dimension: body.data.dimension,
        variants: body.data.variants,
        allocation: body.data.allocation || 'even',
        holdoutPct: body.data.holdout_pct ?? 0,
        goalEvent: body.data.goal_event,
        status: body.data.status || 'draft',
        data: body.data.data || {},
      })
      res.status(201).json(experiment)
    } catch (err) {
      return mapError(err, res)
    }
  })

  app.get('/api/agency/experiments/:id', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const experiment = await getExperiment(req.params.id, { agencyId: membership.agency_id })
    if (!experiment) return res.status(404).json({ error: 'Experiment not found' })
    res.json(experiment)
  })

  app.patch('/api/agency/experiments/:id', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const body = z
      .object({
        campaign_id: z.string().nullable().optional(),
        dimension: dimensionSchema.optional(),
        variants: z.array(variantSchema).min(1).optional(),
        allocation: allocationSchema.optional(),
        holdout_pct: z.number().min(0).max(100).optional(),
        goal_event: z.string().min(1).optional(),
        status: statusSchema.optional(),
        data: z.record(z.unknown()).optional(),
      })
      .strict()
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }
    try {
      const patch = {}
      if (body.data.campaign_id !== undefined) patch.campaignId = body.data.campaign_id
      if (body.data.dimension !== undefined) patch.dimension = body.data.dimension
      if (body.data.variants !== undefined) patch.variants = body.data.variants
      if (body.data.allocation !== undefined) patch.allocation = body.data.allocation
      if (body.data.holdout_pct !== undefined) patch.holdoutPct = body.data.holdout_pct
      if (body.data.goal_event !== undefined) patch.goalEvent = body.data.goal_event
      if (body.data.status !== undefined) patch.status = body.data.status
      if (body.data.data !== undefined) patch.data = body.data.data
      const updated = await updateExperiment(req.params.id, patch, {
        agencyId: membership.agency_id,
      })
      if (!updated) return res.status(404).json({ error: 'Experiment not found' })
      res.json(updated)
    } catch (err) {
      return mapError(err, res)
    }
  })

  app.post('/api/agency/experiments/:id/start', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    try {
      const experiment = await startExperiment(req.params.id, {
        agencyId: membership.agency_id,
      })
      res.json(experiment)
    } catch (err) {
      return mapError(err, res)
    }
  })

  app.post('/api/agency/experiments/:id/assign', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const body = z
      .object({ contact_id: z.string().min(1) })
      .strict()
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }
    try {
      const result = await assignContact({
        experimentId: req.params.id,
        contactId: body.data.contact_id,
        agencyId: membership.agency_id,
      })
      res.json(result)
    } catch (err) {
      return mapError(err, res)
    }
  })

  app.get('/api/agency/experiments/:id/assignments', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const rows = await listAssignments({
      agencyId: membership.agency_id,
      experimentId: req.params.id,
    })
    res.json({ assignments: rows })
  })

  app.get('/api/agency/experiments/:id/results', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    try {
      const results = await computeExperimentResults({
        experimentId: req.params.id,
        agencyId: membership.agency_id,
        persist: req.query.persist === '1' || req.query.persist === 'true',
      })
      res.json(results)
    } catch (err) {
      return mapError(err, res)
    }
  })

  app.post('/api/agency/experiments/:id/conclude', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const body = z
      .object({
        winner_variant: z.string().nullable().optional(),
        require_significance: z.boolean().optional(),
      })
      .strict()
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }
    try {
      const result = await concludeExperiment({
        experimentId: req.params.id,
        agencyId: membership.agency_id,
        winnerVariant: body.data.winner_variant ?? null,
        requireSignificance: body.data.require_significance === true,
      })
      res.json(result)
    } catch (err) {
      return mapError(err, res)
    }
  })
}
