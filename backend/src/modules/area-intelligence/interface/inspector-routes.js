import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authMiddleware } from '../../../auth.js'
import { findOne } from '../../../db.js'
import { findUserById } from '../../../identity.js'
import { creditContextFromRequest } from '../../../lib/credits/tenant-context.js'
import { creditErrorHttpStatus } from '../../../lib/credits/errors.js'
import { rateProperty } from '../../../lib/credits/ai-stubs.js'
import { authorizeInspectorPropertyRate } from '../application/property-area-match.js'

const submissionSchema = z
  .object({
    assignment_id: z.string().trim().min(1).max(80),
    area_id: z.string().trim().min(1).max(80),
    gps_latitude: z.number().finite().gte(-90).lte(90),
    gps_longitude: z.number().finite().gte(-180).lte(180),
    dimension_scores: z.record(z.string(), z.number().finite()).default({}),
    photo_urls: z.array(z.string().trim().min(1).max(2000)).max(50).optional(),
    notes: z.string().max(4000).nullish(),
    signature: z.string().max(500000).nullish(),
  })
  .strict()

function serializeSubmission(row) {
  if (!row) return row
  const parseJson = (value, fallback) => {
    if (value == null) return fallback
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return {
    id: row.id,
    assignment_id: row.assignment_id,
    agent_id: row.agent_id,
    area_id: row.area_id,
    gps_latitude: row.gps_latitude == null ? null : Number(row.gps_latitude),
    gps_longitude: row.gps_longitude == null ? null : Number(row.gps_longitude),
    photo_urls: parseJson(row.photo_urls, []),
    dimension_scores: parseJson(row.dimension_scores, {}),
    notes: row.notes ?? null,
    signature: row.signature ?? null,
    status: row.status,
    reviewed_by: row.reviewed_by ?? null,
    reviewed_at: row.reviewed_at ?? null,
    review_notes: row.review_notes ?? null,
    submitted_at: row.submitted_at,
  }
}

async function callerIsPlatformAdmin(userId) {
  if (!userId) return false
  const user = await findUserById(userId)
  return user?.platform_role === 'platform_admin' || user?.platform_role === 'admin'
}

async function requireAgent(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    if (req.user.role !== 'agent') {
      return res.status(403).json({ error: 'Forbidden: inspector required' })
    }
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function requireInspectorOrPa(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    if (req.user.role === 'agent') return next()
    if (await callerIsPlatformAdmin(req.user.id)) return next()
    return res.status(403).json({ error: 'Forbidden: inspector required' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export function registerInspectorRoutes(
  app,
  { inspectorService, areaService, dimensionService, config, logger }
) {
  app.get('/api/inspector/assignments', authMiddleware, requireAgent, async (req, res) => {
    try {
      const items = await inspectorService.listAssignments({
        agentId: req.user.id,
        status: req.query.status,
      })
      res.json({ items })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to list inspector assignments')
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/inspector/assignments/:id', authMiddleware, requireAgent, async (req, res) => {
    try {
      const assignment = await inspectorService.getAssignmentById(req.params.id)
      if (!assignment || assignment.agent_id !== req.user.id) {
        return res.status(404).json({ error: 'Assignment not found' })
      }
      const area = await areaService.getById(assignment.area_id)
      const dimensions = await dimensionService.list({ isActive: true })
      res.json({ assignment, area, dimensions })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to get inspector assignment')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/inspector/assignments/:id/start', authMiddleware, requireAgent, async (req, res) => {
    try {
      const assignment = await inspectorService.getAssignmentById(req.params.id)
      if (!assignment || assignment.agent_id !== req.user.id) {
        return res.status(404).json({ error: 'Assignment not found' })
      }
      const updated = await inspectorService.updateAssignmentStatus(req.params.id, 'in_progress')
      res.json(updated)
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to start assignment')
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/inspector/submissions', authMiddleware, requireAgent, async (req, res) => {
    try {
      const items = await inspectorService.listSubmissions({
        agentId: req.user.id,
        areaId: req.query.areaId,
        status: req.query.status,
      })
      res.json({ items })
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to list submissions')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/inspector/submissions', authMiddleware, requireAgent, async (req, res) => {
    const parsed = submissionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid submission' })
    }
    const body = parsed.data
    try {
      // Leak-safe: an assignment that does not exist OR is not owned by the
      // caller returns the same 404 — never reveal another inspector's work.
      const assignment = await inspectorService.getAssignmentById(body.assignment_id)
      if (!assignment || assignment.agent_id !== req.user.id) {
        return res.status(404).json({ error: 'Assignment not found' })
      }
      if (body.area_id !== assignment.area_id) {
        return res.status(400).json({ error: 'area_id does not match the assignment' })
      }
      const submission = await inspectorService.createSubmission({
        ...body,
        agent_id: req.user.id,
      })
      await inspectorService.updateAssignmentStatus(assignment.id, 'completed')
      res.status(201).json(serializeSubmission(submission))
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to create submission')
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/inspector/properties/:propertyId/rate', authMiddleware, requireInspectorOrPa, async (req, res) => {
    try {
      const property = await findOne('properties', (p) => p.id === req.params.propertyId)
      if (!property) return res.status(404).json({ error: 'Property not found' })

      const isPlatformAdmin = await callerIsPlatformAdmin(req.user.id)
      const assignmentId = req.body?.assignment_id || req.body?.assignmentId || null
      const gate = await authorizeInspectorPropertyRate({
        user: req.user,
        assignmentId,
        property,
        inspectorService,
        areaService,
        isPlatformAdmin,
      })
      if (!gate.ok) {
        return res.status(gate.status).json({ error: gate.error })
      }

      const areaContext = {
        ...(req.body?.area_context || req.body?.areaContext || {}),
        assignment_id: gate.assignment?.id || assignmentId || null,
        area: gate.area || null,
      }

      const credit = creditContextFromRequest(req, {
        requestId: `inspector-rate:${req.params.propertyId}:${randomUUID()}`,
        callType: 'rateProperty',
        relatedEntityType: 'property',
        relatedEntityId: property.id,
      })
      const rated = await rateProperty({
        propertyPayload: property,
        areaContext,
        creditContext: credit,
      })
      res.json(rated)
    } catch (err) {
      logger.error({ err: err.message, code: err.code }, 'Failed to rate property')
      if (err?.code) {
        return res.status(creditErrorHttpStatus(err)).json({
          error: err.message,
          code: err.code,
        })
      }
      res.status(500).json({ error: err.message })
    }
  })
}
