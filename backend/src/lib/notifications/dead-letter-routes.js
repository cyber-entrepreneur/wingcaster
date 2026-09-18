/**
 * PA-NDL-001 — Notifications dead-letter queue (admin).
 *
 * Consumer notification deliveries that exhaust their retries (or go stale)
 * land in `consumer_notification_retries` with status `dead_letter` / `failed`.
 * This surface lets a Platform Admin triage them: list (with channel + error
 * search filters), retry one back through the dispatcher, bulk-retry pending,
 * and mark an item ignored (a soft, non-destructive dismissal so it drops out
 * of the queue without deleting the audit row).
 *
 * Platform-admin only — gated by `isPlatformAdmin`, no per-tenant ownership.
 */
import { z } from 'zod'
import { findAll, findOne, update } from '../../db.js'
import { isPlatformAdmin } from '../auth-guards.js'
import { processPendingNotificationRetries } from './dispatch.js'

const CHANNELS = ['email', 'sms', 'whatsapp', 'in_app', 'push']
const DEAD_STATUSES = ['dead_letter', 'failed']

const listQuerySchema = z
  .object({
    channel: z.enum(CHANNELS).optional(),
    q: z.string().trim().max(200).optional(),
    include_ignored: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  })
  .strict()

const retrySchema = z.object({}).strict()
const bulkRetrySchema = z.object({ limit: z.coerce.number().int().positive().max(200).optional() }).strict()
const ignoreSchema = z.object({ reason: z.string().trim().max(500).optional() }).strict()

function serialize(row, notification) {
  return {
    id: row.id,
    notification_id: row.notification_id ?? null,
    channel: row.channel ?? null,
    status: row.status,
    attempts: Number(row.attempts || 0),
    last_error: row.last_error ?? null,
    next_retry_at: row.next_retry_at ?? null,
    created_at: row.created_at ?? null,
    event_type: notification?.type ?? null,
    title: notification?.title ?? null,
  }
}

async function enrich(rows) {
  const ids = [...new Set(rows.map((r) => r.notification_id).filter(Boolean))]
  const byId = {}
  await Promise.all(
    ids.map(async (nid) => {
      byId[nid] = await findOne('consumer_notifications', (n) => n.id === nid)
    }),
  )
  return rows.map((r) => serialize(r, r.notification_id ? byId[r.notification_id] : null))
}

async function requirePlatformAdmin(req, res) {
  if (!req.user?.id || !(await isPlatformAdmin(req.user.id))) {
    res.status(403).json({ error: 'Forbidden' })
    return false
  }
  return true
}

export function registerRoutes(app, { authMiddleware }) {
  app.get('/api/admin/notifications/dead-letter', authMiddleware, async (req, res) => {
    if (!(await requirePlatformAdmin(req, res))) return
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid query' })
    }
    const { channel, q, include_ignored, limit } = parsed.data
    const includeIgnored = include_ignored === 'true'
    const needle = q?.toLowerCase()

    let rows = await findAll('consumer_notification_retries', (r) => {
      if (DEAD_STATUSES.includes(r.status)) return true
      return includeIgnored && r.status === 'ignored'
    })
    if (channel) rows = rows.filter((r) => r.channel === channel)
    if (needle) rows = rows.filter((r) => String(r.last_error || '').toLowerCase().includes(needle))
    rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

    const total = rows.length
    if (limit) rows = rows.slice(0, limit)
    const items = await enrich(rows)
    res.json({ items, total })
  })

  app.post('/api/admin/notifications/dead-letter/:id/retry', authMiddleware, async (req, res) => {
    if (!(await requirePlatformAdmin(req, res))) return
    if (!retrySchema.safeParse(req.body ?? {}).success) {
      return res.status(400).json({ error: 'Invalid body' })
    }
    const row = await findOne('consumer_notification_retries', (r) => r.id === req.params.id)
    if (!row || !DEAD_STATUSES.includes(row.status)) {
      return res.status(404).json({ error: 'Dead-letter item not found' })
    }
    const now = new Date().toISOString()
    await update(
      'consumer_notification_retries',
      (r) => r.id === row.id,
      (r) => ({ ...r, status: 'pending', next_retry_at: now, updated_at: now }),
    )
    await processPendingNotificationRetries({ limit: 50 })
    const refreshed = await findOne('consumer_notification_retries', (r) => r.id === req.params.id)
    res.json({ item: serialize(refreshed || row, null) })
  })

  app.post('/api/admin/notifications/dead-letter/:id/ignore', authMiddleware, async (req, res) => {
    if (!(await requirePlatformAdmin(req, res))) return
    const parsed = ignoreSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid body' })
    }
    const row = await findOne('consumer_notification_retries', (r) => r.id === req.params.id)
    if (!row || !DEAD_STATUSES.includes(row.status)) {
      return res.status(404).json({ error: 'Dead-letter item not found' })
    }
    const now = new Date().toISOString()
    await update(
      'consumer_notification_retries',
      (r) => r.id === row.id,
      (r) => ({
        ...r,
        status: 'ignored',
        data: { ...(r.data || {}), ignored_reason: parsed.data.reason || null, ignored_at: now },
        updated_at: now,
      }),
    )
    const refreshed = await findOne('consumer_notification_retries', (r) => r.id === req.params.id)
    res.json({ item: serialize(refreshed || row, null) })
  })

  app.post('/api/admin/notifications/retry-pending', authMiddleware, async (req, res) => {
    if (!(await requirePlatformAdmin(req, res))) return
    const parsed = bulkRetrySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid body' })
    }
    const result = await processPendingNotificationRetries({ limit: parsed.data.limit || 20 })
    res.json(result)
  })
}
