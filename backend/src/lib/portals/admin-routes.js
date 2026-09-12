/**
 * PA-POR admin HTTP surface (BE-BLOCKER-35).
 * Mirrors packages admin registration style.
 */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { authMiddleware as defaultAuthMiddleware, requireElevated } from '../../auth.js'
import { requirePlatformAdmin } from '../auth-guards.js'
import { adminMutationLimiter } from '../admin-limiter.js'
import {
  applyPortalActivationDecision,
  createPortal,
  deprecatePortal,
  getPendingActivation,
  getPortalByCode,
  getPortalVersion,
  listPortalActivationHistoryPage,
  listPortalsAdmin,
  requestPortalActivation,
  serializePortalAdmin,
  updatePortal,
  withdrawPortalActivation,
} from './store.js'
import {
  deriveAdapterStatus,
  resolveAdapterFilePath,
} from './activation-gates.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ERROR_STATUS = {
  NOT_FOUND: 404,
  OWN_SUBMISSION: 403,
  FORBIDDEN: 403,
  PORTAL_CODE_TAKEN: 409,
  PENDING_EXISTS: 409,
  INVALID_STATE: 409,
  ADAPTER_MISSING: 400,
  VALIDATOR_MISSING: 400,
  SECRET_IN_JSONB: 400,
  INVALID_CODE_FORMAT: 400,
  CODE_IMMUTABLE: 400,
  STILL_ACTIVE: 400,
  INVALID_INPUT: 400,
}

function wrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res)
    } catch (error) {
      if (error?.httpStatus || error?.code) {
        const status = error.httpStatus || ERROR_STATUS[error.code] || 400
        return res.status(status).json({
          error: error.message,
          code: error.code || 'PORTAL_ERROR',
        })
      }
      next(error)
    }
  }
}

function actorId(req) {
  return req.user?.id || null
}

function envName(req) {
  return String(req.get?.('x-wingcaster-env') || req.headers?.['x-wingcaster-env'] || 'live')
    .toLowerCase()
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function portalsToCsv(portals) {
  const header = [
    'code', 'display_name', 'country_codes', 'adapter_class_name', 'adapter_status',
    'is_active', 'sla_hours', 'connected_agents_env', 'connected_agents_env_name',
    'last_change_at', 'last_change_by',
  ]
  const lines = [header.join(',')]
  for (const p of portals) {
    lines.push([
      p.code,
      p.display_name,
      (p.country_codes || []).join('|'),
      p.adapter_class_name,
      p.adapter_status,
      p.is_active,
      p.sla_hours ?? '',
      p.connected_agents_env ?? 0,
      p.connected_agents_env_name ?? '',
      p.last_change_at ?? '',
      p.last_change_by?.id ?? '',
    ].map(csvEscape).join(','))
  }
  return `${lines.join('\n')}\n`
}

function historyToCsv(events) {
  const header = [
    'event_type', 'event_at', 'submitter_id', 'approver_id', 'notes',
    'before_json', 'after_json',
  ]
  const lines = [header.join(',')]
  for (const e of events) {
    lines.push([
      e.event_type,
      e.created_at,
      e.submitter_user_id,
      e.approver_user_id,
      e.notes,
      JSON.stringify(e.before_json),
      JSON.stringify(e.after_json),
    ].map(csvEscape).join(','))
  }
  return `${lines.join('\n')}\n`
}

async function loadPortalDetail(code, { version = null, envName: env = 'live' } = {}) {
  if (version != null && version !== '' && !Number.isNaN(Number(version))) {
    const snap = await getPortalVersion(code, Number(version))
    if (!snap) {
      const err = new Error('portal version not found')
      err.code = 'NOT_FOUND'
      err.httpStatus = 404
      throw err
    }
    return serializePortalAdmin({
      ...snap.snapshot,
      adapter_status: deriveAdapterStatus(snap.snapshot),
      current_version: snap.version,
    }, { envName: env })
  }
  const portal = await getPortalByCode(code)
  if (!portal) {
    const err = new Error('portal not found')
    err.code = 'NOT_FOUND'
    err.httpStatus = 404
    throw err
  }
  const pending = await getPendingActivation(code)
  return serializePortalAdmin({
    ...portal,
    adapter_status: deriveAdapterStatus(portal),
    pending_activation: pending,
  }, { envName: env })
}

export function registerPortalAdminRoutes(app, {
  authMiddleware = defaultAuthMiddleware,
  requirePlatformAdmin: requireAdmin = requirePlatformAdmin,
} = {}) {
  if (!authMiddleware) throw new Error('registerPortalAdminRoutes requires authMiddleware')
  if (!requireAdmin) throw new Error('registerPortalAdminRoutes requires requirePlatformAdmin')

  const readGuards = [authMiddleware, requireAdmin]
  const writeGuards = [authMiddleware, requireAdmin, requireElevated(), adminMutationLimiter]

  app.get('/api/admin/portals', readGuards, wrap(async (req, res) => {
    const result = await listPortalsAdmin({
      status: req.query.status || 'all',
      active: req.query.active == null ? 'true' : String(req.query.active),
      country: req.query.country || null,
      q: req.query.q || null,
      page: req.query.page,
      pageSize: req.query.pageSize || req.query.page_size,
      sort: req.query.sort || 'last_change:desc',
      envName: envName(req),
    })
    return res.status(200).json({
      portals: result.portals.map((p) => serializePortalAdmin(p, { envName: envName(req) })),
      pagination: result.pagination,
      counts: result.counts,
    })
  }))

  app.get('/api/admin/portals.csv', readGuards, wrap(async (req, res) => {
    const result = await listPortalsAdmin({
      status: req.query.status || 'all',
      active: req.query.active == null ? 'all' : String(req.query.active),
      country: req.query.country || null,
      q: req.query.q || null,
      page: 1,
      pageSize: 100,
      sort: req.query.sort || 'code:asc',
      envName: envName(req),
    })
    const csv = portalsToCsv(result.portals.map((p) => serializePortalAdmin(p)))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="portals.csv"')
    return res.status(200).send(csv)
  }))

  app.post('/api/admin/portals', writeGuards, wrap(async (req, res) => {
    const created = await createPortal(req.body || {}, { actorId: actorId(req) })
    return res.status(201).json(serializePortalAdmin({
      ...created,
      adapter_status: deriveAdapterStatus(created),
    }))
  }))

  app.post('/api/admin/portals/logo-upload', writeGuards, wrap(async (_req, res) => {
    // Ephemeral container FS cannot retain logos; wait for object storage / CDN.
    return res.status(501).json({
      error: 'Logo upload is not available until object storage ships',
      code: 'LOGO_STORAGE_NOT_READY',
    })
  }))

  app.get('/api/admin/portals/adapters/:className/schema', readGuards, wrap(async (req, res) => {
    const className = decodeURIComponent(req.params.className)
    const path = resolveAdapterFilePath(
      className.includes('/') ? className : `portals/${className}`,
      null,
    )
    if (!path || !existsSync(path)) {
      return res.status(404).json({ error: 'adapter not found', code: 'ADAPTER_MISSING' })
    }
    try {
      const mod = await import(pathToFileURL(path).href)
      const schema = mod.configSchema || mod.publisherConfigSchema || null
      if (!schema) {
        return res.status(200).json({
          publisher_config: { type: 'object', additionalProperties: true },
          inbound_config: { type: 'object', additionalProperties: true },
          schema_available: false,
        })
      }
      return res.status(200).json({ ...schema, schema_available: true })
    } catch {
      return res.status(404).json({ error: 'adapter not loadable', code: 'ADAPTER_MISSING' })
    }
  }))

  app.get('/api/admin/portals/:code/history.csv', readGuards, wrap(async (req, res) => {
    const eventsParam = req.query.events
      ? String(req.query.events).split(',').map((s) => s.trim()).filter(Boolean)
      : null
    const { rows } = await listPortalActivationHistoryPage(req.params.code, {
      events: eventsParam,
      actor: req.query.actor || null,
      from: req.query.from || null,
      to: req.query.to || null,
      page: 1,
      pageSize: 100,
    })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.code}-history.csv"`)
    return res.status(200).send(historyToCsv(rows))
  }))

  app.get('/api/admin/portals/:code/history', readGuards, wrap(async (req, res) => {
    const portal = await getPortalByCode(req.params.code)
    if (!portal) {
      return res.status(404).json({ error: 'portal not found', code: 'NOT_FOUND' })
    }
    const eventsParam = req.query.events
      ? String(req.query.events).split(',').map((s) => s.trim()).filter(Boolean)
      : null
    const { rows, total, page, pageSize } = await listPortalActivationHistoryPage(req.params.code, {
      events: eventsParam,
      actor: req.query.actor || null,
      from: req.query.from || null,
      to: req.query.to || null,
      page: req.query.page,
      pageSize: req.query.pageSize || req.query.page_size,
    })

    const counts = { total }
    for (const r of rows) {
      counts[r.event_type] = (counts[r.event_type] || 0) + 1
    }

    return res.status(200).json({
      events: rows.map((e) => ({
        id: e.id,
        portal_code: e.portal_code,
        event_type: e.event_type,
        event_at: e.created_at,
        submitter: e.submitter_user_id
          ? { id: e.submitter_user_id, display_name: e.submitter_user_id }
          : null,
        approver: e.approver_user_id
          ? { id: e.approver_user_id, display_name: e.approver_user_id }
          : null,
        submitter_notes: e.notes,
        approver_notes: null,
        diff: { before: e.before_json, after: e.after_json },
        version_created: e.after_json?.current_version ?? null,
      })),
      pagination: {
        page,
        page_size: pageSize,
        total,
        has_next: page * pageSize < total,
      },
      counts,
    })
  }))

  app.post('/api/admin/portals/:code/activate', writeGuards, wrap(async (req, res) => {
    const pending = await requestPortalActivation({
      portalCode: req.params.code,
      requestedBy: actorId(req),
      reason: req.body?.submitter_notes || req.body?.reason || null,
      proposedIsActive: true,
      proposedEffectiveFrom: req.body?.effective_from || null,
    })
    return res.status(202).json({
      code: 'PENDING_APPROVAL',
      pending_activation_id: pending.id,
      pending,
    })
  }))

  app.post('/api/admin/portals/:code/activate/approve', writeGuards, wrap(async (req, res) => {
    const pending = await getPendingActivation(req.params.code)
    if (!pending || pending.action !== 'activate') {
      return res.status(404).json({ error: 'no pending activation', code: 'NOT_FOUND' })
    }
    const result = await applyPortalActivationDecision({
      pendingId: pending.id,
      reviewerId: actorId(req),
      approve: true,
      reviewNote: req.body?.approver_notes || req.body?.notes || null,
    })
    return res.status(200).json({
      portal: serializePortalAdmin({
        ...result.portal,
        adapter_status: deriveAdapterStatus(result.portal),
      }),
      pending: result.pending,
    })
  }))

  app.post('/api/admin/portals/:code/activate/reject', writeGuards, wrap(async (req, res) => {
    const pending = await getPendingActivation(req.params.code)
    if (!pending || pending.action !== 'activate') {
      return res.status(404).json({ error: 'no pending activation', code: 'NOT_FOUND' })
    }
    const result = await applyPortalActivationDecision({
      pendingId: pending.id,
      reviewerId: actorId(req),
      approve: false,
      reviewNote: req.body?.rejection_reason || req.body?.notes || null,
    })
    return res.status(200).json({ pending: result.pending, portal: serializePortalAdmin(result.portal) })
  }))

  app.post('/api/admin/portals/:code/activate/withdraw', writeGuards, wrap(async (req, res) => {
    const pending = await withdrawPortalActivation({
      portalCode: req.params.code,
      actorId: actorId(req),
    })
    return res.status(200).json({ pending })
  }))

  app.post('/api/admin/portals/:code/deactivate', writeGuards, wrap(async (req, res) => {
    const pending = await requestPortalActivation({
      portalCode: req.params.code,
      requestedBy: actorId(req),
      reason: req.body?.submitter_notes || req.body?.reason || null,
      proposedIsActive: false,
      proposedEffectiveFrom: req.body?.effective_from || null,
    })
    return res.status(202).json({
      code: 'PENDING_APPROVAL',
      pending_activation_id: pending.id,
      pending,
    })
  }))

  app.post('/api/admin/portals/:code/deactivate/approve', writeGuards, wrap(async (req, res) => {
    const pending = await getPendingActivation(req.params.code)
    if (!pending || pending.action !== 'deactivate') {
      return res.status(404).json({ error: 'no pending deactivation', code: 'NOT_FOUND' })
    }
    const result = await applyPortalActivationDecision({
      pendingId: pending.id,
      reviewerId: actorId(req),
      approve: true,
      reviewNote: req.body?.approver_notes || req.body?.notes || null,
    })
    return res.status(200).json({
      portal: serializePortalAdmin(result.portal),
      pending: result.pending,
    })
  }))

  app.post('/api/admin/portals/:code/deactivate/reject', writeGuards, wrap(async (req, res) => {
    const pending = await getPendingActivation(req.params.code)
    if (!pending || pending.action !== 'deactivate') {
      return res.status(404).json({ error: 'no pending deactivation', code: 'NOT_FOUND' })
    }
    const result = await applyPortalActivationDecision({
      pendingId: pending.id,
      reviewerId: actorId(req),
      approve: false,
      reviewNote: req.body?.rejection_reason || req.body?.notes || null,
    })
    return res.status(200).json({ pending: result.pending, portal: serializePortalAdmin(result.portal) })
  }))

  app.post('/api/admin/portals/:code/deactivate/withdraw', writeGuards, wrap(async (req, res) => {
    const pending = await withdrawPortalActivation({
      portalCode: req.params.code,
      actorId: actorId(req),
    })
    return res.status(200).json({ pending })
  }))

  app.post('/api/admin/portals/:code/deprecate', writeGuards, wrap(async (req, res) => {
    const updated = await deprecatePortal(req.params.code, {
      actorId: actorId(req),
      notes: req.body?.notes || null,
    })
    return res.status(200).json(serializePortalAdmin({
      ...updated,
      adapter_status: deriveAdapterStatus(updated),
    }))
  }))

  app.get('/api/admin/portals/:code', readGuards, wrap(async (req, res) => {
    const detail = await loadPortalDetail(req.params.code, {
      version: req.query.version,
      envName: envName(req),
    })
    return res.status(200).json(detail)
  }))

  app.patch('/api/admin/portals/:code', writeGuards, wrap(async (req, res) => {
    const updated = await updatePortal(req.params.code, req.body || {}, { actorId: actorId(req) })
    return res.status(200).json(serializePortalAdmin({
      ...updated,
      adapter_status: deriveAdapterStatus(updated),
    }))
  }))
}
