/**
 * Pricing evidence upload helpers (Wave 5 / PR #127).
 * Patterns copied from account-recovery/evidence.js + evidence-storage.js.
 */

import { createHash, randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { findOne, insert, remove } from '../../../db.js'
import logger from '../../../lib/logger.js'
import { signPurposeToken, verifyPurposeToken } from '../../../lib/signed-token.js'
import { getPricingEvidenceStorage } from '../infrastructure/pricing-evidence-storage.js'

export const PRICING_EVIDENCE_ALLOWED_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

export const PRICING_EVIDENCE_MAX_BYTES = Math.max(
  1024,
  Number(process.env.PRICING_EVIDENCE_MAX_BYTES || 10 * 1024 * 1024),
)

export const PRICING_EVIDENCE_URL_TTL_SECONDS = 60 * 60

export const PRICING_EVIDENCE_RETENTION_DAYS = Math.max(
  1,
  Number(process.env.PRICING_EVIDENCE_RETENTION_DAYS || 90),
)

export const PRICING_EVIDENCE_ERROR = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  INVALID_TYPE: 'INVALID_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  NO_FILE: 'NO_FILE',
  STORAGE_FAILED: 'STORAGE_FAILED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
})

export class PricingEvidenceError extends Error {
  constructor(code, message, { httpStatus = 400, extra = {} } = {}) {
    super(message)
    this.name = 'PricingEvidenceError'
    this.code = code
    this.httpStatus = httpStatus
    this.extra = extra
  }

  toJSON() {
    return { error: this.message, code: this.code, ...this.extra }
  }
}

/** PII-safe filename sanitizer (same rules as account-recovery/evidence.js). */
export function sanitizeFilename(originalName) {
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
    'application/pdf': '.pdf',
  }
  return map[contentType] || '.bin'
}

export function normalizeContentType(mime) {
  const base = String(mime || '').split(';')[0].trim().toLowerCase()
  if (base === 'image/jpg') return 'image/jpeg'
  return base
}

function sha256Of(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Optional ClamAV hook. When absent, queue-and-warn (pending_scan).
 * @returns {Promise<'clean' | 'pending_scan' | 'quarantined'>}
 */
export async function scanEvidenceBuffer(buffer, { clamav } = {}) {
  const scanner = clamav || globalThis.__pricingClamav || null
  if (!scanner || typeof scanner.scanBuffer !== 'function') {
    logger.warn(
      { size_bytes: buffer?.length || 0 },
      'pricing evidence virus scan skipped — clamav absent; queued as pending_scan',
    )
    return 'pending_scan'
  }
  try {
    const result = await scanner.scanBuffer(buffer)
    if (result === 'infected' || result?.infected) return 'quarantined'
    return 'clean'
  } catch (err) {
    logger.warn({ err: err.message }, 'pricing evidence clamav scan failed; pending_scan')
    return 'pending_scan'
  }
}

export function buildSignedEvidenceUrl(evidenceId, { ttlSeconds = PRICING_EVIDENCE_URL_TTL_SECONDS } = {}) {
  const token = signPurposeToken({
    purpose: 'pricing_evidence_view',
    claims: { evidence_id: evidenceId },
    ttlSeconds,
  })
  return `/api/pricing/evidence-uploads/${encodeURIComponent(evidenceId)}?token=${encodeURIComponent(token)}`
}

export function verifyEvidenceViewToken(token, evidenceId) {
  const result = verifyPurposeToken(token, { purpose: 'pricing_evidence_view' })
  if (!result.ok) {
    return { ok: false, code: result.code || PRICING_EVIDENCE_ERROR.INVALID_TOKEN }
  }
  if (String(result.payload?.evidence_id || '') !== String(evidenceId)) {
    return { ok: false, code: PRICING_EVIDENCE_ERROR.INVALID_TOKEN }
  }
  return { ok: true, payload: result.payload }
}

/**
 * Store one multipart file for an authenticated agent.
 */
export async function uploadPricingEvidenceFile({
  agentId,
  file,
  storage = getPricingEvidenceStorage(),
  clamav,
}) {
  if (!agentId) {
    throw new PricingEvidenceError(PRICING_EVIDENCE_ERROR.FORBIDDEN, 'Authentication required', {
      httpStatus: 401,
    })
  }
  if (!file || (!file.buffer && !file.path)) {
    throw new PricingEvidenceError(PRICING_EVIDENCE_ERROR.NO_FILE, 'No file uploaded', {
      httpStatus: 400,
    })
  }

  const contentType = normalizeContentType(file.mimetype || file.content_type)
  if (!PRICING_EVIDENCE_ALLOWED_TYPES.includes(contentType)) {
    throw new PricingEvidenceError(
      PRICING_EVIDENCE_ERROR.INVALID_TYPE,
      'Unsupported content type. Allowed: JPEG, PNG, WebP, PDF.',
      { httpStatus: 415, extra: { content_type: contentType || null } },
    )
  }

  const buffer = file.buffer || null
  if (!buffer) {
    throw new PricingEvidenceError(PRICING_EVIDENCE_ERROR.NO_FILE, 'File buffer missing', {
      httpStatus: 400,
    })
  }

  const sizeBytes = Number(file.size ?? buffer.length ?? 0)
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new PricingEvidenceError(PRICING_EVIDENCE_ERROR.NO_FILE, 'Empty file rejected', {
      httpStatus: 400,
    })
  }
  if (sizeBytes > PRICING_EVIDENCE_MAX_BYTES) {
    throw new PricingEvidenceError(
      PRICING_EVIDENCE_ERROR.FILE_TOO_LARGE,
      `File exceeds maximum size of ${PRICING_EVIDENCE_MAX_BYTES} bytes`,
      { httpStatus: 413 },
    )
  }

  const id = randomUUID()
  const filename = sanitizeFilename(file.originalname || file.filename || 'evidence')
  const ext = extensionFor(contentType, filename)
  const storageKey = `${agentId}/${id}${ext}`
  const digest = sha256Of(buffer)
  const scanStatus = await scanEvidenceBuffer(buffer, { clamav })

  try {
    await storage.put(storageKey, buffer, { contentType })
  } catch (err) {
    logger.error({ err: err.message, agentId }, 'pricing evidence storage put failed')
    throw new PricingEvidenceError(
      PRICING_EVIDENCE_ERROR.STORAGE_FAILED,
      'Failed to store evidence',
      { httpStatus: 500 },
    )
  }

  const now = new Date()
  const retentionExpires = new Date(
    now.getTime() + PRICING_EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  )
  const row = {
    id,
    agent_id: agentId,
    storage_key: storageKey,
    filename,
    content_type: contentType,
    size_bytes: sizeBytes,
    sha256: digest,
    uploaded_at: now.toISOString(),
    retention_expires_at: retentionExpires.toISOString(),
    scan_status: scanStatus,
    data: { scan_status: scanStatus },
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }

  await insert('pricing_evidence_files', row)

  const url = buildSignedEvidenceUrl(id)
  return {
    id,
    url,
    sha256: digest,
    content_type: contentType,
    size_bytes: sizeBytes,
    scan_status: scanStatus,
    filename,
  }
}

export async function getPricingEvidenceRecord(evidenceId) {
  if (!evidenceId) return null
  return (await findOne('pricing_evidence_files', (r) => r.id === evidenceId)) || null
}

export async function openPricingEvidenceStream({
  evidenceId,
  agentId = null,
  requireOwner = false,
  storage = getPricingEvidenceStorage(),
}) {
  const record = await getPricingEvidenceRecord(evidenceId)
  if (!record) {
    throw new PricingEvidenceError(PRICING_EVIDENCE_ERROR.NOT_FOUND, 'Evidence not found', {
      httpStatus: 404,
    })
  }
  if (requireOwner && agentId && record.agent_id !== agentId) {
    throw new PricingEvidenceError(PRICING_EVIDENCE_ERROR.FORBIDDEN, 'Forbidden', {
      httpStatus: 403,
    })
  }
  if (record.scan_status === 'quarantined') {
    throw new PricingEvidenceError(PRICING_EVIDENCE_ERROR.FORBIDDEN, 'Evidence quarantined', {
      httpStatus: 403,
    })
  }

  let stream
  try {
    stream = await storage.getStream(record.storage_key)
  } catch (err) {
    if (err?.code === 'ENOENT') {
      throw new PricingEvidenceError(PRICING_EVIDENCE_ERROR.NOT_FOUND, 'Evidence blob missing', {
        httpStatus: 404,
      })
    }
    throw err
  }
  return { record, stream }
}

export async function deletePricingEvidenceFile({
  evidenceId,
  agentId,
  storage = getPricingEvidenceStorage(),
}) {
  const record = await getPricingEvidenceRecord(evidenceId)
  if (!record) {
    throw new PricingEvidenceError(PRICING_EVIDENCE_ERROR.NOT_FOUND, 'Evidence not found', {
      httpStatus: 404,
    })
  }
  if (record.agent_id !== agentId) {
    throw new PricingEvidenceError(PRICING_EVIDENCE_ERROR.FORBIDDEN, 'Forbidden', {
      httpStatus: 403,
    })
  }
  await storage.remove(record.storage_key)
  await remove('pricing_evidence_files', (r) => r.id === evidenceId)
  return { deleted: true, id: evidenceId }
}

/**
 * Validate that supporting_document_ids belong to the submitting agent.
 */
export async function assertOwnedEvidenceIds(agentId, ids) {
  const list = Array.isArray(ids) ? ids.map(String).filter(Boolean) : []
  const unique = [...new Set(list)]
  for (const id of unique) {
    const row = await getPricingEvidenceRecord(id)
    if (!row || row.agent_id !== agentId) {
      throw new PricingEvidenceError(
        PRICING_EVIDENCE_ERROR.FORBIDDEN,
        'supporting_document_ids must reference your uploaded evidence',
        { httpStatus: 400, extra: { evidence_id: id } },
      )
    }
  }
  return unique
}
