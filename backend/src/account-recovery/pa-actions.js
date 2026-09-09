/**
 * Account-recovery PA actions — BE-BLOCKER-21 / Agent 5.
 *
 * request-info, cancel-info-request, undo-approve.
 * withdraw-vote lives in cast-vote.js (two-person state).
 */

import { findOne, update, query } from '../db.js'

export const PA_ACTION_ERROR = Object.freeze({
  FORBIDDEN: 'FORBIDDEN',
  OWN_CASE: 'OWN_CASE',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_STATE: 'INVALID_STATE',
  TOKEN_CONSUMED: 'TOKEN_CONSUMED',
  HAS_FIRST_VOTE: 'HAS_FIRST_VOTE',
})

export const INFO_REQUEST_REASON_CODES = Object.freeze([
  'missing_government_id',
  'selfie_required',
  'tenancy_record_required',
  'agency_letterhead_required',
  'contact_unreachable',
  'other',
])

export const REQUESTED_EVIDENCE_TYPES = Object.freeze([
  'id_front',
  'id_back',
  'selfie_holding_id',
  'tenancy_record',
  'agency_letterhead',
  'utility_bill',
  'other',
])

export class PaActionError extends Error {
  constructor(code, message, { httpStatus = 400, extra = {} } = {}) {
    super(message)
    this.name = 'PaActionError'
    this.code = code
    this.httpStatus = httpStatus
    this.extra = extra
  }

  toJSON() {
    return { error: this.message, code: this.code, ...this.extra }
  }
}

async function loadCaseOrThrow(caseId) {
  const recoveryCase = await findOne('account_recovery_cases', (c) => c.id === caseId)
  if (!recoveryCase) {
    throw new PaActionError(PA_ACTION_ERROR.NOT_FOUND, 'Recovery case not found', { httpStatus: 404 })
  }
  return recoveryCase
}

function assertNotOwnCase(recoveryCase, actorId) {
  if (String(recoveryCase.user_id) === String(actorId)) {
    throw new PaActionError(
      PA_ACTION_ERROR.OWN_CASE,
      'Cannot act on your own recovery case',
      { httpStatus: 403 },
    )
  }
}

/**
 * Revoke issued recovery tokens for a specific case (undo-approve).
 */
export async function revokeOutstandingRecoveryTokensForCase(caseId, reason = 'undo_approve') {
  await update(
    'auth_recovery_tokens',
    (r) => r.case_id === caseId && r.status === 'issued',
    (r) => ({
      ...r,
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
    }),
  )
}

async function caseHasConsumedRecoveryToken(caseId) {
  const used = await findOne(
    'auth_recovery_tokens',
    (r) => r.case_id === caseId
      && r.type === 'account_recovery'
      && r.status === 'used',
  )
  if (used) return true
  // Fallback via SQL in case DAL filter misses status values stored only in DB.
  const rows = await query(
    `SELECT id FROM public.auth_recovery_tokens
      WHERE case_id = $1 AND type = 'account_recovery' AND status = 'used'
      LIMIT 1`,
    [caseId],
  )
  return Array.isArray(rows) ? rows.length > 0 : Boolean(rows?.rows?.length)
}

/**
 * POST .../request-info — transition pending_review → awaiting_info.
 */
export async function requestInfo({
  caseId,
  actorId,
  reasonCode,
  notes = '',
  requestedEvidence = [],
  notifyApplicant,
  logActivity,
} = {}) {
  const recoveryCase = await loadCaseOrThrow(caseId)
  assertNotOwnCase(recoveryCase, actorId)

  if (recoveryCase.status !== 'pending_review') {
    throw new PaActionError(
      PA_ACTION_ERROR.INVALID_STATE,
      'Recovery case is not pending review',
      { httpStatus: 400 },
    )
  }
  if (recoveryCase.first_vote_reviewer_id) {
    throw new PaActionError(
      PA_ACTION_ERROR.HAS_FIRST_VOTE,
      'Cannot request info after a first vote has been cast; withdraw the vote first',
      { httpStatus: 409 },
    )
  }
  if (recoveryCase.escalation_approval_request_id) {
    throw new PaActionError(
      PA_ACTION_ERROR.INVALID_STATE,
      'Recovery case is escalated and awaiting resolution',
      { httpStatus: 409 },
    )
  }

  const evidence = Array.isArray(requestedEvidence) ? requestedEvidence : []
  const now = new Date().toISOString()
  const notesText = notes || ''

  await update('account_recovery_cases', (c) => c.id === recoveryCase.id, (c) => ({
    ...c,
    status: 'awaiting_info',
    requested_evidence: evidence,
    info_requested_at: now,
    info_requested_by: actorId,
    info_request_reason_code: reasonCode,
    info_request_notes: notesText,
    info_request_canceled_at: null,
    info_request_canceled_by: null,
    updated_at: now,
  }))

  if (typeof logActivity === 'function') {
    await logActivity({
      type: 'account_recovery_info_requested',
      agent_id: recoveryCase.user_id,
      meta: {
        case_id: recoveryCase.id,
        reviewer_id: actorId,
        reason_code: reasonCode,
        requested_evidence: evidence,
      },
    })
  }

  let notification = null
  if (typeof notifyApplicant === 'function') {
    notification = await notifyApplicant({
      recoveryCase,
      reasonCode,
      notes: notesText,
      requestedEvidence: evidence,
      channel: recoveryCase.preferred_channel || 'email',
    })
  } else {
    console.info('[account-recovery] info requested', {
      case_id: recoveryCase.id,
      channel: recoveryCase.preferred_channel || 'email',
      reason_code: reasonCode,
      requested_evidence: evidence,
    })
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      case_id: recoveryCase.id,
      status: 'awaiting_info',
      reason_code: reasonCode,
      requested_evidence: evidence,
      notification_queued: Boolean(notification),
      message: 'Info requested. Applicant notified on preferred channel.',
    },
  }
}

/**
 * POST .../cancel-info-request — awaiting_info → pending_review.
 */
export async function cancelInfoRequest({
  caseId,
  actorId,
  notifyApplicant,
  logActivity,
} = {}) {
  const recoveryCase = await loadCaseOrThrow(caseId)
  assertNotOwnCase(recoveryCase, actorId)

  if (recoveryCase.status !== 'awaiting_info') {
    throw new PaActionError(
      PA_ACTION_ERROR.INVALID_STATE,
      'Recovery case is not awaiting info',
      { httpStatus: 400 },
    )
  }

  const now = new Date().toISOString()
  await update('account_recovery_cases', (c) => c.id === recoveryCase.id, (c) => ({
    ...c,
    status: 'pending_review',
    info_request_canceled_at: now,
    info_request_canceled_by: actorId,
    updated_at: now,
  }))

  if (typeof logActivity === 'function') {
    await logActivity({
      type: 'account_recovery_info_request_canceled',
      agent_id: recoveryCase.user_id,
      meta: { case_id: recoveryCase.id, reviewer_id: actorId },
    })
  }

  if (typeof notifyApplicant === 'function') {
    await notifyApplicant({
      recoveryCase,
      canceled: true,
      channel: recoveryCase.preferred_channel || 'email',
    })
  } else {
    console.info('[account-recovery] info request canceled', {
      case_id: recoveryCase.id,
      channel: recoveryCase.preferred_channel || 'email',
    })
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      case_id: recoveryCase.id,
      status: 'pending_review',
      message: 'Info request canceled. Case returned to pending review.',
    },
  }
}

/**
 * POST .../undo-approve — approved → pending_review if token not consumed.
 */
export async function undoApprove({
  caseId,
  actorId,
  revokeTokens = revokeOutstandingRecoveryTokensForCase,
  logActivity,
} = {}) {
  const recoveryCase = await loadCaseOrThrow(caseId)
  assertNotOwnCase(recoveryCase, actorId)

  if (recoveryCase.status !== 'approved') {
    throw new PaActionError(
      PA_ACTION_ERROR.INVALID_STATE,
      'Recovery case is not approved',
      { httpStatus: 400 },
    )
  }

  if (await caseHasConsumedRecoveryToken(recoveryCase.id)) {
    throw new PaActionError(
      PA_ACTION_ERROR.TOKEN_CONSUMED,
      'Cannot undo — recovery link has already been used',
      { httpStatus: 409 },
    )
  }

  const now = new Date().toISOString()
  await revokeTokens(recoveryCase.id, 'undo_approve')

  await update('account_recovery_cases', (c) => c.id === recoveryCase.id, (c) => ({
    ...c,
    status: 'pending_review',
    approved_at: null,
    approved_by: null,
    reviewed_at: null,
    reviewed_by: null,
    // Reset two-person vote state so the case can be reviewed again.
    first_vote_reviewer_id: null,
    first_vote: null,
    first_vote_at: null,
    first_vote_notes: null,
    second_vote_reviewer_id: null,
    second_vote: null,
    second_vote_at: null,
    second_vote_notes: null,
    approval_request_id: null,
    escalation_approval_request_id: null,
    updated_at: now,
  }))

  if (typeof logActivity === 'function') {
    await logActivity({
      type: 'account_recovery_undo_approve',
      agent_id: recoveryCase.user_id,
      meta: { case_id: recoveryCase.id, reviewer_id: actorId },
    })
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      case_id: recoveryCase.id,
      status: 'pending_review',
      message: 'Reverted. Recovery link revoked.',
    },
  }
}
