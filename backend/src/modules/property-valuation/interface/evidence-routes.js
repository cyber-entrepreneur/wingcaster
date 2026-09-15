/**
 * HTTP routes for pricing evidence uploads (Wave 5 / PR #127).
 *
 * POST   /api/pricing/evidence-uploads
 * GET    /api/pricing/evidence-uploads/:id?token=…  (60-min signed PA view)
 * DELETE /api/pricing/evidence-uploads/:id
 */

import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from '../../../auth.js'
import { isPlatformAdmin } from '../../../lib/auth-guards.js'
import logger from '../../../lib/logger.js'
import {
  PRICING_EVIDENCE_ALLOWED_TYPES,
  PRICING_EVIDENCE_MAX_BYTES,
  PricingEvidenceError,
  uploadPricingEvidenceFile,
  openPricingEvidenceStream,
  deletePricingEvidenceFile,
  verifyEvidenceViewToken,
  sanitizeFilename,
} from '../application/pricing-evidence.js'

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PRICING_EVIDENCE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').split(';')[0].trim().toLowerCase()
    const normalized = mime === 'image/jpg' ? 'image/jpeg' : mime
    if (PRICING_EVIDENCE_ALLOWED_TYPES.includes(normalized)) cb(null, true)
    else cb(new Error('UNSUPPORTED_CONTENT_TYPE'))
  },
})

export const pricingEvidenceUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(1, Number(process.env.PRICING_EVIDENCE_RATE_MAX || 40)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || req.ip || 'anonymous'),
  validate: false,
  skip: () => Boolean(process.env.VITEST),
  handler: (req, res) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Pricing evidence upload rate limit exceeded')
    res.status(429).json({
      error: 'Too many evidence uploads, please try again later.',
      code: 'RATE_LIMITED',
    })
  },
})

function multerSingle(req, res) {
  return new Promise((resolve, reject) => {
    evidenceUpload.single('file')(req, res, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function contentDispositionFor(contentType, filename) {
  const safe = sanitizeFilename(filename).replace(/"/g, '')
  const inline = String(contentType || '').startsWith('image/') || contentType === 'application/pdf'
  return `${inline ? 'inline' : 'attachment'}; filename="${safe}"`
}

/**
 * @param {import('express').Express} app
 * @param {{ auth?: Function }} [deps]
 */
export function registerPricingEvidenceRoutes(app, { auth = authMiddleware } = {}) {
  app.post(
    '/api/pricing/evidence-uploads',
    auth,
    pricingEvidenceUploadLimiter,
    async (req, res, next) => {
      try {
        await multerSingle(req, res)
      } catch (err) {
        if (err?.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: `File exceeds maximum size of ${PRICING_EVIDENCE_MAX_BYTES} bytes`,
            code: 'FILE_TOO_LARGE',
          })
        }
        if (err?.message === 'UNSUPPORTED_CONTENT_TYPE') {
          return res.status(415).json({
            error: 'Unsupported content type. Allowed: JPEG, PNG, WebP, PDF.',
            code: 'INVALID_TYPE',
          })
        }
        return next(err)
      }

      try {
        const result = await uploadPricingEvidenceFile({
          agentId: req.user.id,
          file: req.file,
        })
        return res.status(201).json(result)
      } catch (err) {
        if (err instanceof PricingEvidenceError) {
          return res.status(err.httpStatus).json(err.toJSON())
        }
        return next(err)
      }
    },
  )

  app.get('/api/pricing/evidence-uploads/:id', async (req, res, next) => {
    try {
      const token = String(req.query.token || '')
      const evidenceId = req.params.id
      const verified = verifyEvidenceViewToken(token, evidenceId)
      if (!verified.ok) {
        // Authenticated owner or PA may still fetch without token.
        if (!req.headers.authorization) {
          return res.status(401).json({ error: 'Signed token required', code: 'INVALID_TOKEN' })
        }
        // Fall through to auth middleware path below via manual check.
        return auth(req, res, async () => {
          try {
            const isAdmin = await isPlatformAdmin(req.user.id)
            const { record, stream } = await openPricingEvidenceStream({
              evidenceId,
              agentId: req.user.id,
              requireOwner: !isAdmin,
            })
            res.setHeader('Content-Type', record.content_type || 'application/octet-stream')
            res.setHeader('Content-Disposition', contentDispositionFor(record.content_type, record.filename))
            res.setHeader('Cache-Control', 'private, no-store')
            res.setHeader('X-Content-Type-Options', 'nosniff')
            stream.on('error', (err) => {
              logger.error({ err: err.message, evidenceId }, 'pricing evidence stream error')
              if (!res.headersSent) res.status(500).json({ error: 'Failed to read evidence' })
              else res.destroy(err)
            })
            stream.pipe(res)
          } catch (err) {
            if (err instanceof PricingEvidenceError) {
              return res.status(err.httpStatus).json(err.toJSON())
            }
            return next(err)
          }
        })
      }

      const { record, stream } = await openPricingEvidenceStream({ evidenceId })
      res.setHeader('Content-Type', record.content_type || 'application/octet-stream')
      res.setHeader('Content-Disposition', contentDispositionFor(record.content_type, record.filename))
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      stream.on('error', (err) => {
        logger.error({ err: err.message, evidenceId }, 'pricing evidence stream error')
        if (!res.headersSent) res.status(500).json({ error: 'Failed to read evidence' })
        else res.destroy(err)
      })
      stream.pipe(res)
    } catch (err) {
      if (err instanceof PricingEvidenceError) {
        return res.status(err.httpStatus).json(err.toJSON())
      }
      return next(err)
    }
  })

  app.delete('/api/pricing/evidence-uploads/:id', auth, async (req, res, next) => {
    try {
      const result = await deletePricingEvidenceFile({
        evidenceId: req.params.id,
        agentId: req.user.id,
      })
      return res.json(result)
    } catch (err) {
      if (err instanceof PricingEvidenceError) {
        return res.status(err.httpStatus).json(err.toJSON())
      }
      return next(err)
    }
  })
}
