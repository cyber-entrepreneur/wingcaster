/**
 * BE-ACR-06 — POST /api/admin/account-recovery/:caseId/reveal-audit
 * Rate limit: 20 reveals / hour / PA.
 */

import { randomUUID } from 'node:crypto'
import { findOne, insert, query } from '../db.js'

export const REVEAL_RATE_LIMIT_PER_HOUR = 20

export const REVEAL_FIELDS = Object.freeze([
  'email',
  'phone',
  'username',
  'ip',
  'row',
  'name',
  'contact',
  'user_agent',
])

export class RevealAuditError extends Error {
  constructor(code, message, { httpStatus = 400, extra = {} } = {}) {
    super(message)
    this.name = 'RevealAuditError'
    this.code = code
    this.httpStatus = httpStatus
    this.extra = extra
  }

  toJSON() {
    return { error: this.message, code: this.code, ...this.extra }
  }
}

async function countRevealsInLastHour(reviewerId, now = new Date()) {
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const rowsRaw = await query(
    `SELECT COUNT(*)::int AS n
       FROM public.account_recovery_reveal_audit
      WHERE reviewer_id = $1
        AND created_at >= $2::timestamptz`,
    [String(reviewerId), since],
  )
  const rows = Array.isArray(rowsRaw) ? rowsRaw : (rowsRaw?.rows || [])
  return Number(rows[0]?.n || 0)
}

/**
 * @param {{
 *   caseId: string,
 *   reviewerId: string,
 *   field: string,
 *   ip?: string|null,
 *   userAgent?: string|null,
 * }} args
 */
export async function recordRevealAudit({
  caseId,
  reviewerId,
  field,
  ip = null,
  userAgent = null,
}) {
  const normalizedField = String(field || '').trim().toLowerCase()
  if (!REVEAL_FIELDS.includes(normalizedField)) {
    throw new RevealAuditError(
      'INVALID_FIELD',
      `field must be one of: ${REVEAL_FIELDS.join(', ')}`,
      { httpStatus: 400 },
    )
  }

  const recoveryCase = await findOne('account_recovery_cases', (c) => c.id === caseId)
  if (!recoveryCase) {
    throw new RevealAuditError('NOT_FOUND', 'Recovery case not found', { httpStatus: 404 })
  }

  const used = await countRevealsInLastHour(reviewerId)
  if (used >= REVEAL_RATE_LIMIT_PER_HOUR) {
    throw new RevealAuditError(
      'RATE_LIMITED',
      'Reveal rate limit reached — try again in an hour.',
      {
        httpStatus: 429,
        extra: {
          limit: REVEAL_RATE_LIMIT_PER_HOUR,
          used,
          retry_after_seconds: 3600,
        },
      },
    )
  }

  const nowIso = new Date().toISOString()
  const id = randomUUID()
  await insert('account_recovery_reveal_audit', {
    id,
    case_id: caseId,
    reviewer_id: reviewerId,
    field: normalizedField,
    ip: ip || null,
    user_agent: userAgent || null,
    created_at: nowIso,
    type: 'pa_pii_viewed',
    action: 'reveal',
    entity_type: 'account_recovery_case',
    entity_id: caseId,
    metadata: {
      field: normalizedField,
      case_id: caseId,
      reviewer_id: reviewerId,
    },
  })

  // Also mirror into generic audit_log when available (PA-AUD-001 alignment).
  try {
    await insert('audit_log', {
      id: randomUUID(),
      agent_id: reviewerId,
      type: 'pa_pii_viewed',
      action: 'reveal',
      entity_type: 'account_recovery_case',
      entity_id: caseId,
      ip: ip || null,
      user_agent: userAgent || null,
      metadata: {
        field: normalizedField,
        case_id: caseId,
        source: 'account_recovery_reveal_audit',
        reveal_audit_id: id,
      },
      created_at: nowIso,
    })
  } catch {
    // Dedicated reveal table is the source of truth for rate limiting.
  }

  return {
    success: true,
    field: normalizedField,
    case_id: caseId,
    remaining: Math.max(0, REVEAL_RATE_LIMIT_PER_HOUR - used - 1),
    limit: REVEAL_RATE_LIMIT_PER_HOUR,
  }
}
