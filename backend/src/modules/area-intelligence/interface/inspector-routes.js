import { randomUUID } from 'node:crypto'
import { authMiddleware } from '../../../auth.js'
import { findOne } from '../../../db.js'
import { findUserById } from '../../../identity.js'
import { creditContextFromRequest } from '../../../lib/credits/tenant-context.js'
import { creditErrorHttpStatus } from '../../../lib/credits/errors.js'
import { rateProperty } from '../../../lib/credits/ai-stubs.js'
import { authorizeInspectorPropertyRate } from '../application/property-area-match.js'

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
    try {
      const body = req.body
      const assignment = body.assignment_id
        ? await inspectorService.getAssignmentById(body.assignment_id)
        : null
      if (assignment && assignment.agent_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: assignment not owned by you' })
      }
      const submission = await inspectorService.createSubmission({
        ...body,
        agent_id: req.user.id,
      })
      if (assignment) {
        await inspectorService.updateAssignmentStatus(assignment.id, 'completed')
      }
      res.status(201).json(submission)
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
