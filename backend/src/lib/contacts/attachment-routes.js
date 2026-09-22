/**
 * Contact attachment routes (full-form Pre-Approval Letter + future files).
 *
 * Private + tenant-gated: bytes live in a private store off /uploads, and every
 * upload/download/delete goes through assertOwnsContact. Cross-tenant access
 * returns 404 (assertOwnsContact throws NotFoundError). No storage_key or public
 * URL is ever returned to the client.
 *
 * Registered from server.js like merge-routes / relationships-routes; deps are
 * injectable so the routes can be unit-tested with a mock DAL + in-memory store.
 */

import { randomUUID, createHash } from 'node:crypto'
import multer from 'multer'
import { authMiddleware as defaultAuth } from '../../auth.js'
import { requireApiTokenScope as defaultRequireScope } from '../auth/api-token-scope.js'
import { assertOwnsContact as defaultAssertOwnsContact, NotFoundError } from '../authz.js'
import {
  findOne as defaultFindOne,
  findAll as defaultFindAll,
  insert as defaultInsert,
  update as defaultUpdate,
  remove as defaultRemove,
} from '../../db.js'
import { getContactAttachmentStorage } from './contact-attachment-storage.js'
import logger from '../logger.js'

export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024
export const ATTACHMENT_ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Voice notes.
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/aac',
]
export const ATTACHMENT_KINDS = ['pre_approval_letter', 'voice_note', 'other']

const EXT_BY_TYPE = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/aac': '.aac',
}

function normalizeMime(file) {
  const mime = String(file?.mimetype || '').split(';')[0].trim().toLowerCase()
  return mime === 'image/jpg' ? 'image/jpeg' : mime
}

function publicAttachment(row) {
  return {
    id: row.id,
    contact_id: row.contact_id,
    kind: row.kind,
    filename: row.filename,
    content_type: row.content_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
  }
}

export function registerRoutes(app, deps = {}) {
  const auth = deps.authMiddleware || defaultAuth
  const requireApiTokenScope = deps.requireApiTokenScope || defaultRequireScope
  const assertOwnsContact = deps.assertOwnsContact || defaultAssertOwnsContact
  const findOne = deps.findOne || defaultFindOne
  const findAll = deps.findAll || defaultFindAll
  const insert = deps.insert || defaultInsert
  const update = deps.update || defaultUpdate
  const remove = deps.remove || defaultRemove
  const storage = deps.storage || getContactAttachmentStorage()
  const logActivity = deps.logActivity || (async () => {})

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (ATTACHMENT_ALLOWED_CONTENT_TYPES.includes(normalizeMime(file))) cb(null, true)
      else cb(new Error('UNSUPPORTED_CONTENT_TYPE'))
    },
  })
  const multerSingle = (req, res) => new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => (err ? reject(err) : resolve()))
  })

  async function ownedContactOr404(req, res) {
    try {
      return { contact: await assertOwnsContact(req.user.id, req.params.id) }
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: 'Not found' })
        return { contact: null }
      }
      throw err
    }
  }

  app.post(
    '/api/contacts/:id/attachments',
    auth,
    requireApiTokenScope('contacts:write'),
    async (req, res, next) => {
      try {
        const { contact } = await ownedContactOr404(req, res)
        if (!contact) return undefined

        try {
          await multerSingle(req, res)
        } catch (err) {
          if (err?.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: `File exceeds ${ATTACHMENT_MAX_BYTES} bytes`, code: 'FILE_TOO_LARGE' })
          }
          if (err?.message === 'UNSUPPORTED_CONTENT_TYPE') {
            return res.status(415).json({ error: 'Unsupported content type. Allowed: PDF, JPEG, PNG, WebP, HEIC, DOC, DOCX.', code: 'INVALID_TYPE' })
          }
          return next(err)
        }
        if (!req.file) return res.status(400).json({ error: 'No file provided', code: 'NO_FILE' })

        const kind = ATTACHMENT_KINDS.includes(req.body?.kind) ? req.body.kind : 'other'
        const contentType = normalizeMime(req.file)
        const id = randomUUID()
        const storageKey = `${contact.id}/${id}${EXT_BY_TYPE[contentType] || ''}`
        const sha256 = createHash('sha256').update(req.file.buffer).digest('hex')
        await storage.put(storageKey, req.file.buffer)

        const now = new Date().toISOString()
        const row = {
          id,
          contact_id: contact.id,
          agency_id: contact.agency_id || null,
          assigned_agent_id: contact.assigned_agent_id || null,
          kind,
          storage_key: storageKey,
          filename: req.file.originalname || null,
          content_type: contentType,
          size_bytes: req.file.size ?? req.file.buffer.length,
          sha256,
          created_at: now,
          updated_at: now,
        }
        await insert('contact_attachments', row)

        // Link the reference onto the contact for known kinds so it round-trips
        // in the full form without a separate PATCH.
        if (kind === 'pre_approval_letter') {
          await update('contacts', (c) => c.id === contact.id, (c) => ({
            ...c,
            pre_approval_letter: {
              attachment_id: id,
              filename: row.filename,
              content_type: contentType,
              size_bytes: row.size_bytes,
              uploaded_at: now,
            },
            updated_at: now,
          }))
        }

        await logActivity({ type: 'contact_attachment_uploaded', agent_id: req.user.id, meta: { contact_id: contact.id, attachment_id: id, kind } })
        return res.status(201).json({ attachment: publicAttachment(row) })
      } catch (err) {
        return next(err)
      }
    },
  )

  app.get('/api/contacts/:id/attachments', auth, async (req, res, next) => {
    try {
      const { contact } = await ownedContactOr404(req, res)
      if (!contact) return undefined
      const kind = req.query?.kind ? String(req.query.kind) : null
      const rows = await findAll('contact_attachments', (a) =>
        a.contact_id === req.params.id && (!kind || a.kind === kind))
      const sorted = [...rows].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      )
      return res.json({ attachments: sorted.map(publicAttachment) })
    } catch (err) {
      return next(err)
    }
  })

  app.get('/api/contacts/:id/attachments/:attachmentId', auth, async (req, res, next) => {
    try {
      const { contact } = await ownedContactOr404(req, res)
      if (!contact) return undefined

      const row = await findOne('contact_attachments', (a) => a.id === req.params.attachmentId)
      if (!row || row.contact_id !== req.params.id) return res.status(404).json({ error: 'Not found' })

      let stream
      try {
        stream = await storage.getStream(row.storage_key)
      } catch (err) {
        if (err?.code === 'ENOENT') return res.status(404).json({ error: 'Attachment file missing' })
        return next(err)
      }

      await logActivity({ type: 'contact_attachment_downloaded', agent_id: req.user.id, meta: { contact_id: row.contact_id, attachment_id: row.id } })
      res.setHeader('Content-Type', row.content_type || 'application/octet-stream')
      const safeName = String(row.filename || `attachment-${row.id}`).replace(/[\r\n"]/g, '')
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      stream.on('error', (err) => {
        logger.error({ err: err.message, attachmentId: row.id }, 'contact attachment stream error')
        if (!res.headersSent) res.status(500).json({ error: 'Failed to read attachment' })
        else res.destroy(err)
      })
      return stream.pipe(res)
    } catch (err) {
      return next(err)
    }
  })

  app.delete(
    '/api/contacts/:id/attachments/:attachmentId',
    auth,
    requireApiTokenScope('contacts:write'),
    async (req, res, next) => {
      try {
        const { contact } = await ownedContactOr404(req, res)
        if (!contact) return undefined

        const row = await findOne('contact_attachments', (a) => a.id === req.params.attachmentId)
        if (!row || row.contact_id !== req.params.id) return res.status(404).json({ error: 'Not found' })

        await storage.remove(row.storage_key)
        await remove('contact_attachments', (a) => a.id === row.id)

        const now = new Date().toISOString()
        await update('contacts', (c) => c.id === row.contact_id, (c) => {
          if (c.pre_approval_letter?.attachment_id === row.id) {
            const next = { ...c, updated_at: now }
            delete next.pre_approval_letter
            return next
          }
          return c
        })

        await logActivity({ type: 'contact_attachment_deleted', agent_id: req.user.id, meta: { contact_id: row.contact_id, attachment_id: row.id } })
        return res.json({ deleted: true, id: row.id })
      } catch (err) {
        return next(err)
      }
    },
  )
}
