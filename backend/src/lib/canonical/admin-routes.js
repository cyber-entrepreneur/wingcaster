import { authMiddleware } from '../../auth.js'
import { requirePlatformAdmin } from '../auth-guards.js'
import {
  changeCanonicalPrimary,
  getCanonicalResolutionDetail,
  holdCanonicalResolution,
  listCanonicalResolutionQueue,
  mergeCanonicalProperties,
  splitCanonicalListing,
} from './admin-resolution.js'

function sendServiceError(res, err) {
  const status = Number(err.status || err.httpStatus || 500)
  if (status >= 500) throw err
  return res.status(status).json({
    error: err.code || err.message,
    message: err.message,
    code: err.code || undefined,
  })
}

export function registerCanonicalResolutionAdminRoutes(app) {
  const admin = [authMiddleware, requirePlatformAdmin]

  app.get('/api/admin/pricing/canonical', admin, async (_req, res, next) => {
    try {
      const items = await listCanonicalResolutionQueue()
      return res.json({ items })
    } catch (err) { next(err) }
  })

  app.get('/api/admin/pricing/canonical/:id', admin, async (req, res, next) => {
    try {
      const detail = await getCanonicalResolutionDetail(req.params.id)
      if (!detail) return res.status(404).json({ error: 'Canonical property not found' })
      return res.json({ canonical: detail })
    } catch (err) { next(err) }
  })

  app.post('/api/admin/pricing/canonical/:id/change-primary', admin, async (req, res, next) => {
    try {
      const result = await changeCanonicalPrimary({
        canonicalId: req.params.id,
        listingId: req.body?.listing_id || req.body?.listingId,
        reason: req.body?.reason || req.body?.reason_code || 'PA_OVERRIDE',
        actorId: req.user?.id || null,
      })
      return res.json(result)
    } catch (err) {
      try { return sendServiceError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/admin/pricing/canonical/:id/split', admin, async (req, res, next) => {
    try {
      const result = await splitCanonicalListing({
        canonicalId: req.params.id,
        listingId: req.body?.listing_id || req.body?.listingId,
        reason: req.body?.reason || req.body?.reason_code || 'PA_SPLIT',
        actorId: req.user?.id || null,
      })
      return res.json(result)
    } catch (err) {
      try { return sendServiceError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/admin/pricing/canonical/:id/merge', admin, async (req, res, next) => {
    try {
      const result = await mergeCanonicalProperties({
        canonicalId: req.params.id,
        targetCanonicalId: req.body?.target_canonical_id || req.body?.targetCanonicalId,
        reason: req.body?.reason || req.body?.reason_code || 'PA_MERGE',
        actorId: req.user?.id || null,
      })
      return res.json(result)
    } catch (err) {
      try { return sendServiceError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/admin/pricing/canonical/:id/hold', admin, async (req, res, next) => {
    try {
      const result = await holdCanonicalResolution({
        canonicalId: req.params.id,
        reason: req.body?.reason || req.body?.reason_code || 'Investigation pending',
        release: Boolean(req.body?.release),
        actorId: req.user?.id || null,
      })
      return res.json(result)
    } catch (err) {
      try { return sendServiceError(res, err) } catch (e) { next(e) }
    }
  })
}
