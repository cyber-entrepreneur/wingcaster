/**
 * Account-recovery evidence upload + list helpers ([BE-ACR-03]).
 *
 * Upload is public/throttled (applicant). Bytes never leave via unsigned URL —
 * PA retrieval goes through the authenticated proxy ([BE-ACR-11]).
 */

import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { findOne, findAll, insert } from '../db.js'
import logger from '../lib/logger.js'
import { getEvidenceStorage } from './evidence-storage.js'

export const EVIDENCE_UPLOAD_STATUSES = Object.freeze(['pending_review', 'awaiting_info'])

export const EVIDENCE_ALLOWED_CONTENT_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])

export const EVIDENCE_MAX_BYTES = Math.max(
  1024,
  Number(process.env.ACCOUNT_RECOVERY_EVIDENCE_MAX_BYTES || 10 * 1024 * 1024),
)

export const EVIDENCE_MAX_FILES_PER_CASE = Math.max(
  1,
  Number(process.env.ACCOUNT_RECOVERY_EVIDENCE_MAX_FILES || 15),
)

export const EVIDENCE_ERROR = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  CASE_CLOSED: 'CASE_CLOSED',
  INVALID_TYPE: 'INVALID_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  NO_FILE: 'NO_FILE',
  LIMIT_REACHED: 'LIMIT_REACHED',
  STORAGE_FAILED: 'STORAGE_FAILED',
})

const INLINE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])

export class EvidenceError extends Error {
  constructor(code, message, { httpStatus = 400, extra = {} } = {}) {
    super(message)
    this.name = 'EvidenceError'
    this.code = code
    this.httpStatus = httpStatus
    this.extra = extra
  }

  toJSON() {
    return { error: this.message, code: this.code, ...this.extra }
  }
}

function sanitizeFilename(originalName) {
  const raw = String(originalName || 'evidence').trim() || 'evidence'
  const base = raw.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').slice(0, 180)
  return base || 'evidence'
}

function extensionFor(contentType, filename) {
  const fromName = extname(filename || '').toLowerCase()
  if (fromName && fromName.length <= 8) return fromName
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'application/pdf': '.pdf',
  }
  return map[contentType] || '.bin'
}

function normalizeContentType(mime) {
  const base = String(mime || '').split(';')[0].trim().toLowerCase()
  if (base === 'image/jpg') return 'image/jpeg'
  return base
}

export function isInlineContentType(contentType) {
  return INLINE_CONTENT_TYPES.has(normalizeContentType(contentType))
}

export function contentDispositionFor(contentType, filename, { forceAttachment = false } = {}) {
  const safe = sanitizeFilename(filename).replace(/"/g, '')
  const disposition = !forceAttachment && isInlineContentType(contentType) ? 'inline' : 'attachment'
  return `${disposition}; filename="${safe}"`
}

/** Public-safe evidence metadata — never includes storage_key or URLs. */
export function toPublicEvidenceFile(row) {
  if (!row) return null
  return {
    id: row.id,
    filename: row.filename,
    content_type: row.content_type,
    size_bytes: Number(row.size_bytes) || 0,
    uploaded_at: row.uploaded_at,
    uploaded_by_kind: row.uploaded_by_kind || 'applicant',
  }
}

/**
 * Read helper for Agent 2 detail/list composition.
 * Returns public-safe file metadata only (no storage_key / URLs).
 */
export async function listEvidenceForCase(caseId) {
  if (!caseId) return []
  const rows = await findAll(
    'account_recovery_evidence_files',
    (r) => r.case_id === caseId,
  )
  rows.sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime())
  return rows.map(toPublicEvidenceFile)
}

export async function countEvidenceForCase(caseId) {
  const files = await listEvidenceForCase(caseId)
  return files.length
}

export async function getEvidenceRecord(caseId, evidenceId) {
  if (!caseId || !evidenceId) return null
  return (
    (await findOne(
      'account_recovery_evidence_files',
      (r) => r.id === evidenceId && r.case_id === caseId,
    )) || null
  )
}

/**
 * Store one multipart file against an open recovery case.
 */
export async function uploadEvidenceFile({
  caseId,
  file,
  uploadedByKind = 'applicant',
  storage = getEvidenceStorage(),
  logActivity,
}) {
  if (!file || (!file.buffer && !file.path)) {
    throw new EvidenceError(EVIDENCE_ERROR.NO_FILE, 'No file uploaded', { httpStatus: 400 })
  }

  const recoveryCase = await findOne('account_recovery_cases', (c) => c.id === caseId)
  if (!recoveryCase) {
    throw new EvidenceError(EVIDENCE_ERROR.NOT_FOUND, 'Recovery case not found', { httpStatus: 404 })
  }
  if (!EVIDENCE_UPLOAD_STATUSES.includes(recoveryCase.status)) {
    throw new EvidenceError(
      EVIDENCE_ERROR.CASE_CLOSED,
      'This recovery case is not accepting evidence uploads',
      { httpStatus: 409, extra: { status: recoveryCase.status } },
    )
  }

  const existing = await findAll(
    'account_recovery_evidence_files',
    (r) => r.case_id === caseId,
  )
  if (existing.length >= EVIDENCE_MAX_FILES_PER_CASE) {
    throw new EvidenceError(
      EVIDENCE_ERROR.LIMIT_REACHED,
      `Maximum of ${EVIDENCE_MAX_FILES_PER_CASE} evidence files per case`,
      { httpStatus: 409 },
    )
  }

  const contentType = normalizeContentType(file.mimetype || file.content_type)
  if (!EVIDENCE_ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new EvidenceError(
      EVIDENCE_ERROR.INVALID_TYPE,
      'Unsupported content type. Allowed: JPEG, PNG, WebP, HEIC, PDF.',
      { httpStatus: 415, extra: { content_type: contentType || null } },
    )
  }

  const sizeBytes = Number(file.size ?? file.buffer?.length ?? 0)
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new EvidenceError(EVIDENCE_ERROR.NO_FILE, 'Empty file rejected', { httpStatus: 400 })
  }
  if (sizeBytes > EVIDENCE_MAX_BYTES) {
    throw new EvidenceError(
      EVIDENCE_ERROR.FILE_TOO_LARGE,
      `File exceeds maximum size of ${EVIDENCE_MAX_BYTES} bytes`,
      { httpStatus: 413 },
    )
  }

  const id = randomUUID()
  const filename = sanitizeFilename(file.originalname || file.filename || 'evidence')
  const ext = extensionFor(contentType, filename)
  const storageKey = `${caseId}/${id}${ext}`

  const buffer = file.buffer || null
  if (!buffer) {
    throw new EvidenceError(EVIDENCE_ERROR.NO_FILE, 'File buffer missing', { httpStatus: 400 })
  }

  try {
    await storage.put(storageKey, buffer, { contentType })
  } catch (err) {
    logger.error({ err: err.message, caseId }, 'account-recovery evidence storage put failed')
    throw new EvidenceError(EVIDENCE_ERROR.STORAGE_FAILED, 'Failed to store evidence', {
      httpStatus: 500,
    })
  }

  const now = new Date().toISOString()
  const row = {
    id,
    case_id: caseId,
    filename,
    content_type: contentType,
    size_bytes: sizeBytes,
    storage_key: storageKey,
    uploaded_at: now,
    uploaded_by_kind: uploadedByKind,
    created_at: now,
    updated_at: now,
  }

  await insert('account_recovery_evidence_files', row)

  if (typeof logActivity === 'function') {
    await logActivity({
      type: 'account_recovery_evidence_uploaded',
      agent_id: recoveryCase.user_id || null,
      meta: {
        case_id: caseId,
        evidence_id: id,
        content_type: contentType,
        size_bytes: sizeBytes,
        uploaded_by_kind: uploadedByKind,
      },
    })
  }

  const publicFile = toPublicEvidenceFile(row)
  // Defense-in-depth: never leak storage paths or URLs.
  assertNoUrlLeakage(publicFile)
  return { file: publicFile, case: recoveryCase }
}

export function assertNoUrlLeakage(payload) {
  const serialized = JSON.stringify(payload)
  if (/storage_key|presigned|\/uploads\/|s3\.amazonaws|blob\.core/i.test(serialized)) {
    throw new Error('Evidence response leaked private storage reference')
  }
  if (/https?:\/\//i.test(serialized)) {
    throw new Error('Evidence response leaked URL')
  }
}

/**
 * Open a readable stream for an evidence blob after DB lookup.
 * Caller is responsible for auth + access audit.
 */
export async function openEvidenceStream({
  caseId,
  evidenceId,
  storage = getEvidenceStorage(),
}) {
  const record = await getEvidenceRecord(caseId, evidenceId)
  if (!record) {
    throw new EvidenceError(EVIDENCE_ERROR.NOT_FOUND, 'Evidence not found', { httpStatus: 404 })
  }
  const recoveryCase = await findOne('account_recovery_cases', (c) => c.id === caseId)
  if (!recoveryCase) {
    throw new EvidenceError(EVIDENCE_ERROR.NOT_FOUND, 'Recovery case not found', { httpStatus: 404 })
  }

  let stream
  try {
    stream = await storage.getStream(record.storage_key)
  } catch (err) {
    if (err?.code === 'ENOENT') {
      throw new EvidenceError(EVIDENCE_ERROR.NOT_FOUND, 'Evidence blob missing', { httpStatus: 404 })
    }
    throw err
  }

  return { record, recoveryCase, stream }
}

export async function auditEvidenceAccess({
  caseId,
  evidenceId,
  accessorId,
  ip = null,
  userAgent = null,
  logActivity,
}) {
  const entry = {
    type: 'account_recovery_evidence_accessed',
    agent_id: accessorId || null,
    meta: {
      case_id: caseId,
      evidence_id: evidenceId,
      accessor_id: accessorId || null,
      ip: ip || null,
      user_agent: userAgent || null,
    },
  }
  if (typeof logActivity === 'function') {
    await logActivity(entry)
  }
  logger.info(
    {
      case_id: caseId,
      evidence_id: evidenceId,
      accessor_id: accessorId || null,
    },
    'account-recovery evidence accessed',
  )
  return entry
}
