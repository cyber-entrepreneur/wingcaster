/**
 * SHR-ERR-005 — Maintenance / degraded status notices.
 *
 *   GET   /api/status                      public  — live notices + overall status
 *   GET   /api/admin/status-notices        admin   — every notice (incl. resolved)
 *   POST  /api/admin/status-notices        admin   — publish a notice
 *   PATCH /api/admin/status-notices/:id    admin   — edit / resolve a notice
 *
 * The public banner (web PlatformStatusBanner) polls GET /api/status every 60s.
 * Writes are platform-admin only (requirePlatformAdmin, DB-backed). `status`
 * doubles as severity: info < degraded < maintenance; the overall status is
 * the highest severity among the currently-live notices.
 */
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { findAll, findOne, insert, update } from '../db.js'

const SEVERITY_RANK = { info: 1, degraded: 2, maintenance: 3 }

const statusEnum = z.enum(['info', 'degraded', 'maintenance'])

const createSchema = z
  .object({
    status: statusEnum.default('info'),
    title: z.string().trim().min(1).max(200),
    body: z.string().max(2000).nullish(),
    learn_more_url: z.string().url().max(2048).nullish(),
    active: z.boolean().default(true),
    starts_at: z.string().datetime({ offset: true }).nullish(),
    ends_at: z.string().datetime({ offset: true }).nullish(),
  })
  .strict()

const updateSchema = z
  .object({
    status: statusEnum.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().max(2000).nullish(),
    learn_more_url: z.string().url().max(2048).nullish(),
    active: z.boolean().optional(),
    starts_at: z.string().datetime({ offset: true }).nullish(),
    ends_at: z.string().datetime({ offset: true }).nullish(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields to update' })

function toBool(value) {
  return value === true || value === 'true' || value === 't'
}

function serialize(row) {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    body: row.body ?? null,
    learn_more_url: row.learn_more_url ?? null,
    active: toBool(row.active),
    starts_at: row.starts_at ?? null,
    ends_at: row.ends_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function isWindowLive(notice, nowMs) {
  const startsOk = !notice.starts_at || new Date(notice.starts_at).getTime() <= nowMs
  const endsOk = !notice.ends_at || new Date(notice.ends_at).getTime() >= nowMs
  return startsOk && endsOk
}

function overallStatus(notices) {
  let rank = 0
  let status = 'ok'
  for (const notice of notices) {
    const noticeRank = SEVERITY_RANK[notice.status] || 0
    if (noticeRank > rank) {
      rank = noticeRank
      status = notice.status
    }
  }
  return status
}

function bySeverityThenNewest(a, b) {
  const severity = (SEVERITY_RANK[b.status] || 0) - (SEVERITY_RANK[a.status] || 0)
  if (severity !== 0) return severity
  return String(b.created_at).localeCompare(String(a.created_at))
}

function badWindow(startsAt, endsAt) {
  return Boolean(startsAt && endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime())
}

export function registerRoutes(app, { authMiddleware, requirePlatformAdmin } = {}) {
  if (!authMiddleware) throw new Error('platform-status-routes requires authMiddleware')
  if (!requirePlatformAdmin) throw new Error('platform-status-routes requires requirePlatformAdmin')

  const adminGuards = [authMiddleware, requirePlatformAdmin]

  // Public — consumed by the global status banner (SHR-ERR-005). No auth: an
  // anonymous visitor on the login screen must still learn we're in maintenance.
  app.get('/api/status', async (_req, res) => {
    const now = Date.now()
    const active = await findAll('platform_status_notices', (row) => toBool(row.active))
    const live = active
      .filter((row) => isWindowLive(row, now))
      .map(serialize)
      .sort(bySeverityThenNewest)
    res.json({ status: overallStatus(live), notices: live })
  })

  app.get('/api/admin/status-notices', adminGuards, async (_req, res) => {
    const rows = await findAll('platform_status_notices')
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    res.json({ notices: rows.map(serialize) })
  })

  app.post('/api/admin/status-notices', adminGuards, async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid status notice', details: parsed.error.flatten() })
    }
    const body = parsed.data
    if (badWindow(body.starts_at, body.ends_at)) {
      return res.status(400).json({ error: 'ends_at must be at or after starts_at', code: 'BAD_WINDOW' })
    }
    const now = new Date().toISOString()
    const row = {
      id: uuidv4(),
      status: body.status,
      title: body.title,
      body: body.body ?? null,
      learn_more_url: body.learn_more_url ?? null,
      active: body.active,
      starts_at: body.starts_at ?? null,
      ends_at: body.ends_at ?? null,
      created_by: req.user?.id ?? null,
      created_at: now,
      updated_at: now,
    }
    await insert('platform_status_notices', row)
    res.status(201).json(serialize(row))
  })

  app.patch('/api/admin/status-notices/:id', adminGuards, async (req, res) => {
    const existing = await findOne('platform_status_notices', (row) => row.id === req.params.id)
    if (!existing) return res.status(404).json({ error: 'Status notice not found' })

    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid status notice', details: parsed.error.flatten() })
    }
    const patch = parsed.data
    const nextStart = patch.starts_at !== undefined ? patch.starts_at : existing.starts_at
    const nextEnd = patch.ends_at !== undefined ? patch.ends_at : existing.ends_at
    if (badWindow(nextStart, nextEnd)) {
      return res.status(400).json({ error: 'ends_at must be at or after starts_at', code: 'BAD_WINDOW' })
    }

    await update(
      'platform_status_notices',
      (row) => row.id === req.params.id,
      (row) => ({ ...row, ...patch, updated_at: new Date().toISOString() }),
    )
    const updated = await findOne('platform_status_notices', (row) => row.id === req.params.id)
    res.json(serialize(updated))
  })
}
