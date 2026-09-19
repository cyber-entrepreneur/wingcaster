/**
 * AGT-CMP-005 — saved searches (audience source + alert triggers).
 *
 *   GET    /api/saved-searches
 *   POST   /api/saved-searches
 *   PATCH  /api/saved-searches/:id
 *   DELETE /api/saved-searches/:id
 *   POST   /api/saved-searches/run-alerts
 */
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { findAll, findOne, insert, remove, update } from '../../db.js'

const createSchema = z.object({
  name: z.string().trim().min(2).max(160),
  filters: z.record(z.unknown()).optional().default({}),
  alert_enabled: z.boolean().optional().default(true),
  alert_channel: z.enum(['email', 'whatsapp', 'inapp']).optional().default('inapp'),
  alert_frequency: z.enum(['instant', 'daily', 'weekly']).optional().default('daily'),
}).strict()

const updateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  filters: z.record(z.unknown()).optional(),
  alert_enabled: z.boolean().optional(),
  alert_channel: z.enum(['email', 'whatsapp', 'inapp']).optional(),
  alert_frequency: z.enum(['instant', 'daily', 'weekly']).optional(),
}).strict()

function serializeSavedSearch(row) {
  return {
    id: row.id,
    user_id: row.user_id || row.agent_id || null,
    agent_id: row.agent_id || null,
    contact_id: row.contact_id || null,
    name: row.name,
    filters: row.filters || {},
    alert_enabled: row.alert_enabled ?? true,
    alert_channel: row.alert_channel || 'inapp',
    alert_frequency: row.alert_frequency || 'daily',
    last_alert_run_at: row.last_alert_run_at || null,
    last_match_count: Number(row.last_match_count) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function filterSummary(filters = {}) {
  const parts = []
  if (filters.city) parts.push(String(filters.city))
  if (filters.property_type || filters.propertyType) {
    parts.push(String(filters.property_type || filters.propertyType))
  }
  if (filters.minPrice || filters.maxPrice) {
    const min = filters.minPrice ? `$${filters.minPrice}` : 'any'
    const max = filters.maxPrice ? `$${filters.maxPrice}` : 'any'
    parts.push(`${min}–${max}`)
  }
  if (filters.bedrooms) parts.push(`${filters.bedrooms}+ beds`)
  if (filters.type) parts.push(String(filters.type))
  return parts.length ? parts.join(' · ') : 'All listings'
}

function serializeListItem(row) {
  const base = serializeSavedSearch(row)
  return {
    ...base,
    filter_summary: filterSummary(base.filters),
  }
}

export function registerRoutes(app, { authMiddleware, runSavedSearchAlertsForUser, logActivity } = {}) {
  if (!authMiddleware) throw new Error('registerRoutes requires authMiddleware')
  if (!runSavedSearchAlertsForUser) throw new Error('registerRoutes requires runSavedSearchAlertsForUser')

  app.get('/api/saved-searches', authMiddleware, async (req, res, next) => {
    try {
      const rows = await findAll('saved_searches', (row) => row.user_id === req.user.id)
      rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return res.json({ saved_searches: rows.map(serializeListItem) })
    } catch (error) {
      return next(error)
    }
  })

  app.post('/api/saved-searches', authMiddleware, async (req, res, next) => {
    try {
      const parsed = createSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid saved search', details: parsed.error.flatten() })
      }
      const body = parsed.data
      const now = new Date().toISOString()
      const row = {
        id: uuidv4(),
        user_id: req.user.id,
        agent_id: req.user.id,
        name: body.name,
        filters: body.filters,
        alert_enabled: body.alert_enabled,
        alert_channel: body.alert_channel,
        alert_frequency: body.alert_frequency,
        last_alert_run_at: null,
        last_match_count: 0,
        created_at: now,
        updated_at: now,
      }
      await insert('saved_searches', row)
      return res.status(201).json(serializeListItem(row))
    } catch (error) {
      return next(error)
    }
  })

  app.patch('/api/saved-searches/:id', authMiddleware, async (req, res, next) => {
    try {
      const parsed = updateSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid saved search update', details: parsed.error.flatten() })
      }
      const row = await findOne(
        'saved_searches',
        (search) => search.id === req.params.id && search.user_id === req.user.id,
      )
      if (!row) return res.status(404).json({ error: 'Saved search not found' })

      const patch = parsed.data
      const nextRow = {
        ...row,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      await update('saved_searches', (search) => search.id === row.id, () => nextRow)
      return res.json(serializeListItem(nextRow))
    } catch (error) {
      return next(error)
    }
  })

  app.delete('/api/saved-searches/:id', authMiddleware, async (req, res, next) => {
    try {
      const row = await findOne(
        'saved_searches',
        (search) => search.id === req.params.id && search.user_id === req.user.id,
      )
      if (!row) return res.status(404).json({ error: 'Saved search not found' })
      await remove('saved_searches', (search) => search.id === row.id)
      return res.json({ success: true })
    } catch (error) {
      return next(error)
    }
  })

  app.post('/api/saved-searches/run-alerts', authMiddleware, async (req, res, next) => {
    try {
      const result = await runSavedSearchAlertsForUser(req.user.id, { force: true })
      if (logActivity) {
        await logActivity({
          type: 'saved_search_alerts_run',
          agent_id: req.user.id,
          meta: {
            searches: result.searches_processed,
            total_matches: result.total_matches,
            source: 'manual',
          },
        })
      }
      return res.json({
        ran_at: new Date().toISOString(),
        searches_processed: result.searches_processed,
        total_matches: result.total_matches,
        results: result.results,
      })
    } catch (error) {
      return next(error)
    }
  })
}
