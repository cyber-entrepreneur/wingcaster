/**
 * AGT-CMP-005 — Saved searches (audience source + alert triggers).
 */
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { findAll, findOne, insert, remove, update } from '../../db.js'

const createSchema = z
  .object({
    name: z.string().min(2).max(160),
    filters: z.record(z.unknown()).optional().default({}),
    alert_enabled: z.boolean().optional().default(true),
    alert_channel: z.enum(['email', 'whatsapp', 'inapp']).optional().default('inapp'),
    alert_frequency: z.enum(['instant', 'daily', 'weekly']).optional().default('daily'),
  })
  .strict()

const patchSchema = z
  .object({
    name: z.string().min(2).max(160).optional(),
    filters: z.record(z.unknown()).optional(),
    alert_enabled: z.boolean().optional(),
    alert_channel: z.enum(['email', 'whatsapp', 'inapp']).optional(),
    alert_frequency: z.enum(['instant', 'daily', 'weekly']).optional(),
  })
  .strict()

async function assertOwnsSavedSearch(userId, id) {
  const row = await findOne('saved_searches', (s) => s.id === id && s.user_id === userId)
  if (!row) {
    const err = new Error('Not found')
    err.status = 404
    err.name = 'NotFoundError'
    throw err
  }
  return row
}

function isNotFound(err) {
  return err?.status === 404 || err?.name === 'NotFoundError'
}

export function registerRoutes(app, { authMiddleware, logActivity, runAlertsForUser }) {
  app.get('/api/saved-searches', authMiddleware, async (req, res) => {
    try {
      const rows = (await findAll('saved_searches', (s) => s.user_id === req.user.id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      res.json(rows)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/saved-searches', authMiddleware, async (req, res) => {
    try {
      const parsed = createSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      }
      const body = parsed.data
      const now = new Date().toISOString()
      const ss = {
        id: uuidv4(),
        user_id: req.user.id,
        name: body.name,
        filters: body.filters || {},
        alert_enabled: body.alert_enabled,
        alert_channel: body.alert_channel,
        alert_frequency: body.alert_frequency,
        last_alert_run_at: null,
        last_match_count: 0,
        created_at: now,
        updated_at: now,
      }
      await insert('saved_searches', ss)
      res.status(201).json(ss)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.patch('/api/saved-searches/:id', authMiddleware, async (req, res) => {
    try {
      const parsed = patchSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      }
      const row = await assertOwnsSavedSearch(req.user.id, req.params.id)
      const patch = parsed.data
      const next = {
        ...row,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      await update('saved_searches', (s) => s.id === row.id, () => next)
      res.json(next)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Saved search not found' })
      res.status(400).json({ error: err.message })
    }
  })

  app.delete('/api/saved-searches/:id', authMiddleware, async (req, res) => {
    try {
      await assertOwnsSavedSearch(req.user.id, req.params.id)
      await remove('saved_searches', (s) => s.id === req.params.id && s.user_id === req.user.id)
      res.json({ success: true })
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Saved search not found' })
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/saved-searches/run-alerts', authMiddleware, async (req, res) => {
    try {
      if (!runAlertsForUser) return res.status(503).json({ error: 'Alerts runner unavailable' })
      const result = await runAlertsForUser(req.user.id, { force: true })
      if (logActivity) {
        await logActivity({
          type: 'saved_search_alerts_run',
          agent_id: req.user.id,
          meta: {
            searches: result?.searches_processed ?? 0,
            total_matches: result?.total_matches ?? 0,
            source: 'manual',
          },
        })
      }
      res.json({
        ran_at: new Date().toISOString(),
        searches_processed: result?.searches_processed ?? 0,
        total_matches: result?.total_matches ?? 0,
        results: result?.results ?? [],
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
