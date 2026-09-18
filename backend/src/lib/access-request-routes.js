/**
 * SHR-ERR-002 — 403 / Permission denied → "Request access".
 *
 *   POST /api/access-requests          file a request for access (idempotent)
 *   GET  /api/access-requests/mine     the caller's own requests
 *   GET  /api/access-requests/:id      one request, owner-scoped (leak-safe 404)
 *
 * Filing a request records the intent and best-effort notifies the party who
 * can grant it: the agency owner for agency scope, every platform admin for
 * platform scope. Notification failure never fails the request, and the
 * receipt never reveals whether the target resource actually exists.
 */
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { findAll, findOne, insert } from '../db.js'

const scopeEnum = z.enum(['platform', 'agency', 'resource'])

const createSchema = z
  .object({
    scope: scopeEnum.default('platform'),
    agency_id: z.string().min(1).max(128).nullish(),
    resource_type: z.string().min(1).max(64).nullish(),
    resource_id: z.string().min(1).max(128).nullish(),
    area_label: z.string().trim().min(1).max(160).nullish(),
    reason: z.string().trim().max(1000).nullish(),
  })
  .strict()

function serialize(row) {
  return {
    id: row.id,
    requester_id: row.requester_id,
    requester_name: row.requester_name ?? null,
    scope: row.scope,
    agency_id: row.agency_id ?? null,
    resource_type: row.resource_type ?? null,
    resource_id: row.resource_id ?? null,
    area_label: row.area_label ?? null,
    reason: row.reason ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** Two open requests collide when they target the same thing for the same user. */
function sameTarget(row, { scope, agencyId, resourceId }) {
  return (
    row.status === 'open' &&
    row.scope === scope &&
    (row.agency_id ?? null) === (agencyId ?? null) &&
    (row.resource_id ?? null) === (resourceId ?? null)
  )
}

async function resolveRecipientIds({ scope, agencyId }) {
  if (scope === 'platform') {
    const admins = await findAll('users', (u) => u.platform_role === 'platform_admin')
    return admins.map((u) => u.id).filter(Boolean)
  }
  if (agencyId) {
    const agency = await findOne('agencies', (a) => a.id === agencyId)
    return agency?.owner_id ? [agency.owner_id] : []
  }
  return []
}

async function notifyRecipients(recipientIds, request) {
  const now = new Date().toISOString()
  const who = request.requester_name || 'A user'
  const where = request.area_label || (request.scope === 'platform' ? 'a platform admin area' : 'a restricted area')
  for (const userId of recipientIds) {
    if (userId === request.requester_id) continue
    try {
      await insert('notifications', {
        id: uuidv4(),
        user_id: userId,
        type: 'system',
        title: 'Access requested',
        body: `${who} requested access to ${where}.`,
        metadata: {
          kind: 'access_request',
          access_request_id: request.id,
          scope: request.scope,
          agency_id: request.agency_id ?? null,
          resource_type: request.resource_type ?? null,
          resource_id: request.resource_id ?? null,
        },
        read: false,
        created_at: now,
        updated_at: now,
      })
    } catch {
      // Best-effort: a notification failure must not fail the access request.
    }
  }
}

export function registerRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('access-request-routes requires authMiddleware')

  app.post('/api/access-requests', authMiddleware, async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid access request', details: parsed.error.flatten() })
    }
    const body = parsed.data
    const requesterId = req.user.id

    // Idempotent: re-filing the same open request returns the existing one so
    // the UI can show "already requested" instead of stacking duplicates.
    const mine = await findAll('access_requests', (r) => r.requester_id === requesterId)
    const existing = mine.find((r) =>
      sameTarget(r, { scope: body.scope, agencyId: body.agency_id ?? null, resourceId: body.resource_id ?? null }),
    )
    if (existing) {
      return res.status(200).json({ request: serialize(existing), already_requested: true })
    }

    const now = new Date().toISOString()
    const row = {
      id: uuidv4(),
      requester_id: requesterId,
      requester_name: req.user.name ?? null,
      scope: body.scope,
      agency_id: body.agency_id ?? null,
      resource_type: body.resource_type ?? null,
      resource_id: body.resource_id ?? null,
      area_label: body.area_label ?? null,
      reason: body.reason ?? null,
      status: 'open',
      created_at: now,
      updated_at: now,
    }
    await insert('access_requests', row)

    const recipientIds = await resolveRecipientIds({ scope: body.scope, agencyId: body.agency_id ?? null })
    await notifyRecipients(recipientIds, row)

    res.status(201).json({ request: serialize(row), already_requested: false })
  })

  app.get('/api/access-requests/mine', authMiddleware, async (req, res) => {
    const rows = await findAll('access_requests', (r) => r.requester_id === req.user.id)
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    res.json({ requests: rows.map(serialize) })
  })

  app.get('/api/access-requests/:id', authMiddleware, async (req, res) => {
    const row = await findOne('access_requests', (r) => r.id === req.params.id)
    // Leak-safe: a request the caller does not own is indistinguishable from
    // one that does not exist.
    if (!row || row.requester_id !== req.user.id) {
      return res.status(404).json({ error: 'Access request not found' })
    }
    res.json({ request: serialize(row) })
  })
}
