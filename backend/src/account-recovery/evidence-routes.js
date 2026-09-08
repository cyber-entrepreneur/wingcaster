/**
 * HTTP routes for account-recovery evidence ([BE-ACR-03] + [BE-ACR-11]).
 *
 * - POST /api/auth/recovery/:caseId/evidence — public, throttled multipart
 * - GET  /api/admin/account-recovery/:caseId/evidence/:evidenceId — PA proxy
 */

import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from '../auth.js'
import { isPlatformAdmin } from '../lib/auth-guards.js'
import logger from '../lib/logger.js'
import {
  EVIDENCE_ALLOWED_CONTENT_TYPES,
  EVIDENCE_MAX_BYTES,
  EvidenceError,
  uploadEvidenceFile,
  openEvidenceStream,
  auditEvidenceAccess,
  contentDispositionFor,
  assertNoUrlLeakage,
} from './evidence.js'

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: EVIDENCE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').split(';')[0].trim().toLowerCase()
    const normalized = mime === 'image/jpg' ? 'image/jpeg' : mime
    if (EVIDENCE_ALLOWED_CONTENT_TYPES.includes(normalized)) cb(null, true)
    else cb(new Error('UNSUPPORTED_CONTENT_TYPE'))
  },
})

export const evidenceUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(1, Number(process.env.ACCOUNT_RECOVERY_EVIDENCE_RATE_MAX || 20)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.ip || 'anonymous'),
  validate: false,
  skip: () => Boolean(process.env.VITEST),
  handler: (req, res) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Evidence upload rate limit exceeded')
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

/**
 * @param {import('express').Express} app
 * @param {{ logActivity?: Function, auth?: Function }} [deps]
 */
export function registerAccountRecoveryEvidenceRoutes(app, {
  logActivity,
  auth = authMiddleware,
} = {}) {
  app.post(
    '/api/auth/recovery/:caseId/evidence',
    evidenceUploadLimiter,
    async (req, res, next) => {
      try {
        await multerSingle(req, res)
      } catch (err) {
        if (err?.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: `File exceeds maximum size of ${EVIDENCE_MAX_BYTES} bytes`,
            code: 'FILE_TOO_LARGE',
          })
        }
        if (err?.message === 'UNSUPPORTED_CONTENT_TYPE') {
          return res.status(415).json({
            error: 'Unsupported content type. Allowed: JPEG, PNG, WebP, HEIC, PDF.',
            code: 'INVALID_TYPE',
          })
        }
        return next(err)
      }

      try {
        const result = await uploadEvidenceFile({
          caseId: req.params.caseId,
          file: req.file,
          uploadedByKind: 'applicant',
          logActivity,
        })
        const body = {
          success: true,
          evidence: result.file,
        }
        assertNoUrlLeakage(body)
        return res.status(201).json(body)
      } catch (err) {
        if (err instanceof EvidenceError) {
          return res.status(err.httpStatus).json(err.toJSON())
        }
        return next(err)
      }
    },
  )

  app.get(
    '/api/admin/account-recovery/:caseId/evidence/:evidenceId',
    auth,
    async (req, res, next) => {
      try {
        if (!await isPlatformAdmin(req.user.id)) {
          return res.status(403).json({ error: 'Forbidden' })
        }

        const forceAttachment = String(req.query.download || '') === '1'
          || String(req.query.disposition || '') === 'attachment'

        const { record, stream } = await openEvidenceStream({
          caseId: req.params.caseId,
          evidenceId: req.params.evidenceId,
        })

        await auditEvidenceAccess({
          caseId: req.params.caseId,
          evidenceId: req.params.evidenceId,
          accessorId: req.user.id,
          ip: req.ip,
          userAgent: req.get('user-agent') || null,
          logActivity,
        })

        res.setHeader('Content-Type', record.content_type || 'application/octet-stream')
        res.setHeader(
          'Content-Disposition',
          contentDispositionFor(record.content_type, record.filename, { forceAttachment }),
        )
        res.setHeader('Cache-Control', 'private, no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        // Never advertise storage location.
        res.removeHeader('X-Accel-Redirect')

        stream.on('error', (err) => {
          logger.error({ err: err.message, evidenceId: record.id }, 'evidence stream error')
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to read evidence' })
          } else {
            res.destroy(err)
          }
        })
        stream.pipe(res)
      } catch (err) {
        if (err instanceof EvidenceError) {
          return res.status(err.httpStatus).json(err.toJSON())
        }
        return next(err)
      }
    },
  )
}
