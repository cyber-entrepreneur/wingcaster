/**
 * Wave 2B — Publishing control plane HTTP routes.
 *
 *   GET  /api/agency/publishing/calendar
 *   POST /api/agency/publishing/executions/:id/reschedule
 *   POST /api/agency/publishing/executions/:id/validate
 *   GET  /api/agency/publishing/executions/:id/preview
 *   POST /api/agency/publishing/executions/bulk-reschedule
 *   POST /api/agency/publishing/executions/bulk-cancel
 */
import { z } from 'zod'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import {
  bulkRescheduleExecutions,
  cancelDraftExecutions,
  queryCalendarExecutions,
  rescheduleCalendarExecution,
} from './calendar.js'
import { validateExecutionNetwork } from './network-validation.js'
import { previewExecution } from './preview.js'

async function resolveExclusiveMembership(userId) {
  const memberships = await listUserAgencyMemberships(userId)
  return memberships.find((row) => row.affiliation_mode === 'exclusive') || null
}

function mapError(res, err) {
  const code = err?.code || 'INTERNAL_ERROR'
  if (code === 'EXECUTION_NOT_FOUND') {
    return res.status(404).json({ error: err.message, code })
  }
  if (code === 'INVALID_EXECUTION_TRANSITION' || code === 'MISSING_SCHEDULED_AT') {
    return res.status(409).json({ error: err.message, code })
  }
  if (code === 'MISSING_AGENCY_ID' || code === 'MISSING_EXECUTION_IDS') {
    return res.status(400).json({ error: err.message, code })
  }
  return res.status(500).json({ error: err.message || 'Internal error', code })
}

export function registerPublishingCalendarRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) {
    throw new Error('publishing-calendar-routes requires authMiddleware')
  }

  app.get('/api/agency/publishing/calendar', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }

    const parsed = z
      .object({
        from: z.string().min(1).optional(),
        to: z.string().min(1).optional(),
        status: z.string().optional(),
        kind: z.string().optional(),
        campaign_id: z.string().optional(),
        property_id: z.string().optional(),
        agent_id: z.string().optional(),
        channel_connection_id: z.string().optional(),
        office: z.string().optional(),
        limit: z.coerce.number().int().positive().max(5000).optional(),
      })
      .strict()
      .safeParse(req.query)

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
    }

    try {
      const payload = await queryCalendarExecutions({
        agencyId: membership.agency_id,
        agentId: parsed.data.agent_id || null,
        from: parsed.data.from || null,
        to: parsed.data.to || null,
        status: parsed.data.status || null,
        kind: parsed.data.kind || null,
        campaignId: parsed.data.campaign_id || null,
        propertyId: parsed.data.property_id || null,
        channelConnectionId: parsed.data.channel_connection_id || null,
        office: parsed.data.office || null,
        limit: parsed.data.limit,
      })
      res.json(payload)
    } catch (err) {
      return mapError(res, err)
    }
  })

  app.post('/api/agency/publishing/executions/:id/reschedule', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const body = z
      .object({
        scheduled_at: z.string().min(1),
        recurrence: z.string().nullable().optional(),
      })
      .strict()
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }

    try {
      const execution = await rescheduleCalendarExecution(req.params.id, body.data.scheduled_at, {
        agencyId: membership.agency_id,
        recurrence: body.data.recurrence ?? null,
      })
      res.json({ execution })
    } catch (err) {
      return mapError(res, err)
    }
  })

  app.post('/api/agency/publishing/executions/:id/validate', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    try {
      const result = await validateExecutionNetwork(req.params.id, {
        agencyId: membership.agency_id,
      })
      if (result.execution.agency_id !== membership.agency_id) {
        return res.status(404).json({ error: 'execution not found', code: 'EXECUTION_NOT_FOUND' })
      }
      res.json({
        execution_id: result.execution.id,
        ok: result.ok,
        blockers: result.blockers,
        warnings: result.warnings,
      })
    } catch (err) {
      return mapError(res, err)
    }
  })

  app.get('/api/agency/publishing/executions/:id/preview', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    try {
      const preview = await previewExecution(req.params.id, {
        agencyId: membership.agency_id,
      })
      if (preview.execution.agency_id !== membership.agency_id) {
        return res.status(404).json({ error: 'execution not found', code: 'EXECUTION_NOT_FOUND' })
      }
      res.json(preview)
    } catch (err) {
      return mapError(res, err)
    }
  })

  app.post('/api/agency/publishing/executions/bulk-reschedule', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const body = z
      .object({
        execution_ids: z.array(z.string().min(1)).min(1).max(200),
        scheduled_at: z.string().min(1),
        recurrence: z.string().nullable().optional(),
      })
      .strict()
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }
    try {
      const payload = await bulkRescheduleExecutions(
        body.data.execution_ids,
        body.data.scheduled_at,
        {
          agencyId: membership.agency_id,
          recurrence: body.data.recurrence ?? null,
        },
      )
      res.json(payload)
    } catch (err) {
      return mapError(res, err)
    }
  })

  app.post('/api/agency/publishing/executions/bulk-cancel', authMiddleware, async (req, res) => {
    const membership = await resolveExclusiveMembership(req.user.id)
    if (!membership?.agency_id) {
      return res.status(403).json({ error: 'Active agency membership required' })
    }
    const body = z
      .object({
        execution_ids: z.array(z.string().min(1)).min(1).max(200),
      })
      .strict()
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid body', details: body.error.flatten() })
    }
    try {
      const payload = await cancelDraftExecutions(body.data.execution_ids, {
        agencyId: membership.agency_id,
      })
      res.json(payload)
    } catch (err) {
      return mapError(res, err)
    }
  })
}
