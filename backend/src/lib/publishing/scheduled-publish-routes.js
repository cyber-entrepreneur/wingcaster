/**
 * AGT-PUB-007 — Schedule publish (later).
 *
 *   POST   /api/properties/:id/scheduled-publications   schedule a publish
 *   GET    /api/properties/:id/scheduled-publications   list for a listing
 *   DELETE /api/scheduled-publications/:schedId          cancel a pending one
 *
 * Auth: caller must own the listing (assertOwnsProperty, leak-safe 404).
 * Scheduling is a thin layer — the worker later runs the same
 * submitPortalPublishingJob() the immediate publish path uses.
 */
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { findAll, findOne, insert, update } from '../../db.js'
import { query } from '../../persistence/postgres-adapter.js'
import { assertOwnsProperty } from '../authz.js'

const portalSchema = z.union([
  z.string().min(1).max(64),
  z.object({ code: z.string().min(1).max(64), country_code: z.string().min(2).max(8).optional() }).strict(),
])

const createSchema = z
  .object({
    portals: z.array(portalSchema).min(1).max(24),
    message: z.string().max(2000).nullish(),
    scheduled_at: z.string().datetime({ offset: true }),
    timezone: z.string().max(64).nullish(),
    recurrence: z.enum(['none', 'weekly']).default('none'),
  })
  .strict()

function isNotFound(err) {
  return err?.status === 404 || err?.name === 'NotFoundError'
}

async function resolveAgencyId(userId) {
  try {
    const rows = await query(
      `SELECT agency_id FROM public.agency_members
        WHERE user_id = $1 AND status = 'active'
        ORDER BY created_at DESC NULLS LAST LIMIT 1`,
      [userId],
    )
    return rows[0]?.agency_id || null
  } catch {
    return null
  }
}

function serialize(row) {
  return {
    id: row.id,
    property_id: row.property_id,
    agent_id: row.agent_id,
    portals: Array.isArray(row.portals) ? row.portals : JSON.parse(row.portals || '[]'),
    message: row.message ?? null,
    scheduled_at: row.scheduled_at,
    timezone: row.timezone ?? null,
    recurrence: row.recurrence,
    status: row.status,
    job_id: row.job_id ?? null,
    last_error: row.last_error ?? null,
    last_fired_at: row.last_fired_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function registerRoutes(app, { authMiddleware }) {
  app.get('/api/properties/:id/scheduled-publications', authMiddleware, async (req, res) => {
    try {
      await assertOwnsProperty(req.user.id, req.params.id)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Listing not found' })
      throw err
    }
    const rows = await findAll('scheduled_publications', (r) => r.property_id === req.params.id)
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    res.json({ scheduled: rows.map(serialize) })
  })

  app.post('/api/properties/:id/scheduled-publications', authMiddleware, async (req, res) => {
    try {
      await assertOwnsProperty(req.user.id, req.params.id)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Listing not found' })
      throw err
    }
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid schedule', details: parsed.error.flatten() })
    }
    const body = parsed.data
    const when = new Date(body.scheduled_at)
    if (Number.isNaN(when.getTime())) {
      return res.status(400).json({ error: 'scheduled_at is not a valid time' })
    }
    if (when.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'scheduled_at must be in the future', code: 'PAST_TIME' })
    }

    const now = new Date().toISOString()
    const row = {
      id: uuidv4(),
      property_id: req.params.id,
      agent_id: req.user.id,
      agency_id: await resolveAgencyId(req.user.id),
      portals: body.portals,
      message: body.message ?? null,
      scheduled_at: when.toISOString(),
      timezone: body.timezone ?? null,
      recurrence: body.recurrence,
      status: 'pending',
      job_id: null,
      attempts: 0,
      last_error: null,
      last_fired_at: null,
      created_at: now,
      updated_at: now,
    }
    await insert('scheduled_publications', row)
    res.status(201).json(serialize(row))
  })

  app.delete('/api/scheduled-publications/:schedId', authMiddleware, async (req, res) => {
    const row = await findOne('scheduled_publications', (r) => r.id === req.params.schedId)
    if (!row) return res.status(404).json({ error: 'Scheduled publication not found' })
    try {
      await assertOwnsProperty(req.user.id, row.property_id)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Scheduled publication not found' })
      throw err
    }
    if (row.status !== 'pending') {
      return res.status(409).json({ error: `Cannot cancel a ${row.status} schedule`, code: 'NOT_PENDING' })
    }
    await update(
      'scheduled_publications',
      (r) => r.id === req.params.schedId,
      (r) => ({ ...r, status: 'cancelled', updated_at: new Date().toISOString() }),
    )
    res.json({ success: true })
  })
}
