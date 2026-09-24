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
 *
 * Reads are owner-scoped in SQL (not findAll + filter) because this module
 * uses the legacy app-role DAL rather than growth_os_app_role / withTenant.
 */
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { findOne, insert, query } from '../db.js'

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

function requireUserId(req) {
  const id = req.user?.id
  if (!id) throw new Error('Authenticated user id is required')
  return id
}

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

async function findRequestsByRequester(requesterId) {
  return query(
    `SELECT *
       FROM public.access_requests
      WHERE requester_id = $1
      ORDER BY created_at DESC`,
    [requesterId],
  )
}

async function findOpenRequestForTarget(requesterId, { scope, agencyId, resourceId }) {
  const rows = await query(
    `SELECT *
       FROM public.access_requests
      WHERE requester_id = $1
        AND status = 'open'
        AND scope = $2
        AND agency_id IS NOT DISTINCT FROM $3
        AND resource_id IS NOT DISTINCT FROM $4
      LIMIT 1`,
    [requesterId, scope, agencyId, resourceId],
  )
  return rows[0]
}

async function findRequestByIdForOwner(id, requesterId) {
  const rows = await query(
    `SELECT *
       FROM public.access_requests
      WHERE id = $1
        AND requester_id = $2
      LIMIT 1`,
    [id, requesterId],
  )
  return rows[0]
}

async function findPlatformAdminIds() {
  const rows = await query(
    `SELECT id
       FROM public.users
      WHERE platform_role = $1`,
    ['platform_admin'],
  )
  return rows.map((r) => r.id).filter(Boolean)
}

async function resolveRecipientIds({ scope, agencyId }) {
  if (scope === 'platform') {
    return findPlatformAdminIds()
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
    const requesterId = requireUserId(req)

    // Idempotent: re-filing the same open request returns the existing one so
    // the UI can show "already requested" instead of stacking duplicates.
    const existing = await findOpenRequestForTarget(requesterId, {
      scope: body.scope,
      agencyId: body.agency_id ?? null,
      resourceId: body.resource_id ?? null,
    })
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
    const rows = await findRequestsByRequester(requireUserId(req))
    res.json({ requests: rows.map(serialize) })
  })

  app.get('/api/access-requests/:id', authMiddleware, async (req, res) => {
    const row = await findRequestByIdForOwner(req.params.id, requireUserId(req))
    if (!row) {
      return res.status(404).json({ error: 'Access request not found' })
    }
    res.json({ request: serialize(row) })
  })
}
