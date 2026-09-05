/**
 * Vendor ops admin surface (PA-VEN-001..005).
 * Reads: auth + platform_admin + resolveAdminContext + CSP.
 * Writes: existing writeGuards (elevated + If-Match + limiter).
 */
import { transaction } from '../../../db.js'
import { FinError } from '../../errors.js'
import { sendPreconditionFailed, setETag } from '../../middleware/if-match.js'
import { actorFrom, pick, sessionEnvironment } from '../context.js'
import {
  getVendorAdmin,
  getVendorMarginAdmin,
  getVendorStatementAdmin,
  listVendorRatesAdmin,
  listVendorStatementsAdmin,
  listVendorsAdmin,
} from './reads.js'
import {
  applyVendorRate,
  deprecateVendorRate,
  reconcileVendorStatement,
} from './writes.js'

function sendFinError(res, error) {
  if (error instanceof FinError && error.httpStatus === 412) {
    return sendPreconditionFailed(res, error.details || {})
  }
  if (error instanceof FinError) {
    return res.status(error.httpStatus).json(error.toJSON())
  }
  throw error
}

function wrap(handler) {
  return async (req, res, next) => {
    try {
      return await handler(req, res)
    } catch (error) {
      try { return sendFinError(res, error) } catch (err) { next(err) }
    }
  }
}

function envNow(req) {
  return {
    environment: sessionEnvironment(req),
    now: req.fin?.now || actorFrom(req).now,
  }
}

export function registerFinVendorAdminRoutes(app, { readGuards, writeGuards } = {}) {
  if (!readGuards) throw new Error('registerFinVendorAdminRoutes requires readGuards')
  if (!writeGuards) throw new Error('registerFinVendorAdminRoutes requires writeGuards')

  app.get('/api/admin/fin/vendors', readGuards, wrap(async (req, res) => {
    const payload = await transaction((client) => listVendorsAdmin(client, {
      ...envNow(req),
      query: req.query,
    }))
    return res.status(200).json(payload)
  }))

  app.get('/api/admin/fin/vendors/:id', readGuards, wrap(async (req, res) => {
    const row = await transaction((client) => getVendorAdmin(client, {
      ...envNow(req),
      id: req.params.id,
    }))
    if (!row) return res.status(404).json({ code: 'NOT_FOUND' })
    return res.status(200).json(row)
  }))

  app.get('/api/admin/fin/vendors/:id/rates', readGuards, wrap(async (req, res) => {
    const payload = await transaction((client) => listVendorRatesAdmin(client, {
      ...envNow(req),
      vendorId: req.params.id,
      query: req.query,
    }))
    if (!payload) return res.status(404).json({ code: 'NOT_FOUND' })
    return res.status(200).json(payload)
  }))

  app.get('/api/admin/fin/vendors/:id/statements', readGuards, wrap(async (req, res) => {
    const payload = await transaction((client) => listVendorStatementsAdmin(client, {
      ...envNow(req),
      vendorId: req.params.id,
      query: req.query,
    }))
    if (!payload) return res.status(404).json({ code: 'NOT_FOUND' })
    return res.status(200).json(payload)
  }))

  app.get('/api/admin/fin/vendors/:id/statements/:month', readGuards, wrap(async (req, res) => {
    const payload = await transaction((client) => getVendorStatementAdmin(client, {
      ...envNow(req),
      vendorId: req.params.id,
      month: req.params.month,
    }))
    if (!payload) return res.status(404).json({ code: 'NOT_FOUND' })
    return res.status(200).json(payload)
  }))

  app.get('/api/admin/fin/vendors/:id/margin', readGuards, wrap(async (req, res) => {
    const payload = await transaction((client) => getVendorMarginAdmin(client, {
      ...envNow(req),
      vendorId: req.params.id,
      month: req.query.month || req.query.period,
    }))
    if (!payload) return res.status(404).json({ code: 'NOT_FOUND' })
    return res.status(200).json(payload)
  }))

  app.post('/api/admin/fin/vendors/:id/rates', writeGuards, wrap(async (req, res) => {
    const env = actorFrom(req)
    const result = await transaction((client) => applyVendorRate(client, env, {
      vendorId: req.params.id,
      body: req.body || {},
    }))
    if (result.version != null) setETag(res, result.version)
    const status = result.status === 'PENDING_APPROVAL' ? 202 : 200
    return res.status(status).json(result)
  }))

  app.post('/api/admin/fin/vendors/:id/rates/:versionId/deprecate', writeGuards, wrap(async (req, res) => {
    const env = actorFrom(req)
    const result = await transaction((client) => deprecateVendorRate(client, env, {
      vendorId: req.params.id,
      versionId: req.params.versionId,
    }))
    if (result.version != null) setETag(res, result.version)
    const status = result.status === 'PENDING_APPROVAL' ? 202 : 200
    return res.status(status).json(result)
  }))

  app.post('/api/admin/fin/vendors/:id/statements/:month/reconcile', writeGuards, wrap(async (req, res) => {
    const env = actorFrom(req)
    const result = await transaction((client) => reconcileVendorStatement(client, env, {
      vendorId: req.params.id,
      month: req.params.month,
      evidence: pick(req.body || {}, 'evidence', 'signed_evidence', 'signedEvidence'),
    }))
    if (result.version != null) setETag(res, result.version)
    return res.status(200).json(result)
  }))
}

export const __testables = { wrap, sendFinError }
