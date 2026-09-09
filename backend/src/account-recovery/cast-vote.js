/**
 * Account-recovery cast-vote — BE-BLOCKER-22 / [BE-ACR-10].
 *
 * Replaces single-admin POST .../approve and .../reject with a two-person-aware
 * cast-vote flow. Downstream agents (2–6) should import from this module.
 */

import { randomUUID } from 'node:crypto'
import { findOne, update, transaction } from '../db.js'
import {
  deriveAccountValueTier,
  requiresTwoPersonForTier,
} from './account-value-tier.js'
import { caseMatchesEnvironment, normalizeWingcasterEnv, WINGCASTER_ENVS } from './env.js'

export const CAST_VOTE_ERROR = Object.freeze({
  FORBIDDEN: 'FORBIDDEN',
  OWN_CASE: 'OWN_CASE',
  NOT_FOUND: 'NOT_FOUND',
  NOT_PENDING: 'NOT_PENDING',
  INVALID_VOTE: 'INVALID_VOTE',
  SAME_REVIEWER: 'SAME_REVIEWER',
  VOTE_DISAGREEMENT: 'VOTE_DISAGREEMENT',
  ALREADY_ESCALATED: 'ALREADY_ESCALATED',
  NOT_FIRST_VOTER: 'NOT_FIRST_VOTER',
  SECOND_VOTE_CAST: 'SECOND_VOTE_CAST',
  NO_FIRST_VOTE: 'NO_FIRST_VOTE',
  CASE_FINALIZED: 'CASE_FINALIZED',
})

const MIGRATE_TO = 'POST /api/admin/account-recovery/:caseId/cast-vote'

export function goneApproveRejectBody(legacyAction = 'approve') {
  return {
    error: `POST /api/admin/account-recovery/:caseId/${legacyAction} is gone. Use cast-vote.`,
    code: 'GONE',
    migrate_to: MIGRATE_TO,
  }
}

function asUuidOrNull(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))
    ? String(id)
    : null
}

function decisionFromVote(vote) {
  if (vote === 'approve') return 'APPROVED'
  if (vote === 'reject') return 'REJECTED'
  return null
}

export class CastVoteError extends Error {
  constructor(code, message, { httpStatus = 400, extra = {} } = {}) {
    super(message)
    this.name = 'CastVoteError'
    this.code = code
    this.httpStatus = httpStatus
    this.extra = extra
  }

  toJSON() {
    return { error: this.message, code: this.code, ...this.extra }
  }
}

/**
 * Mark case approved and issue a recovery token (existing issueRecoveryToken flow).
 */
export async function executeApproveSideEffects({
  recoveryCase,
  reviewerId,
  notes = '',
  ip = null,
  userAgent = null,
  issueRecoveryToken,
  logActivity,
}) {
  if (typeof issueRecoveryToken !== 'function') {
    throw new Error('executeApproveSideEffects requires issueRecoveryToken')
  }
  const { token } = await issueRecoveryToken({
    userId: recoveryCase.user_id,
    email: recoveryCase.email,
    type: 'account_recovery',
    caseId: recoveryCase.id,
    ttlMinutes: 30,
    ip,
    userAgent,
  })

  await update('account_recovery_cases', (c) => c.id === recoveryCase.id, (c) => ({
    ...c,
    status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewerId,
    review_notes: notes || '',
  }))

  if (typeof logActivity === 'function') {
    await logActivity({
      type: 'account_recovery_approved',
      agent_id: recoveryCase.user_id,
      meta: { case_id: recoveryCase.id, reviewer_id: reviewerId },
    })
  }

  return { token }
}

/**
 * Mark case rejected + activity log.
 */
export async function executeRejectSideEffects({
  recoveryCase,
  reviewerId,
  notes = '',
  logActivity,
}) {
  await update('account_recovery_cases', (c) => c.id === recoveryCase.id, (c) => ({
    ...c,
    status: 'rejected',
    rejected_at: new Date().toISOString(),
    rejected_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewerId,
    review_notes: notes || '',
  }))

  if (typeof logActivity === 'function') {
    await logActivity({
      type: 'account_recovery_rejected',
      agent_id: recoveryCase.user_id,
      meta: { case_id: recoveryCase.id, reviewer_id: reviewerId },
    })
  }
}

async function ensureApprovalRequest(client, {
  recoveryCase,
  voterId,
  vote,
  notes,
  tier,
  now,
}) {
  if (recoveryCase.approval_request_id) {
    const locked = await client.query(
      `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
      [recoveryCase.approval_request_id],
    )
    if (locked.rows[0]) return locked.rows[0]
  }

  const approvalId = randomUUID()
  const subjectId = asUuidOrNull(recoveryCase.id)
  const createdBy = asUuidOrNull(recoveryCase.user_id)
  const payload = {
    kind: 'account_recovery_cast_vote',
    case_id: recoveryCase.id,
    applicant_user_id: recoveryCase.user_id,
    account_value_tier: tier,
    initiating_voter_id: voterId,
    initiating_vote: vote,
    notes: notes || '',
  }
  const payloadHash = `account_recovery:${recoveryCase.id}:${approvalId}`

  await client.query(
    `INSERT INTO fin.approval_requests (
       id, environment, tenant_id, action_kind, status, subject_type, subject_id,
       payload_hash, payload, min_distinct_approvers,
       created_at, created_by_actor_type, created_by_actor_id, updated_at
     ) VALUES (
       $1, 'LIVE', NULL, 'PLATFORM_ADMIN_RECOVERY', 'REQUESTED',
       'account_recovery_case', $2,
       $3, $4::jsonb, 2,
       $5::timestamptz, 'USER', $6, $5::timestamptz
     )`,
    [approvalId, subjectId, payloadHash, JSON.stringify(payload), now, createdBy],
  )

  await client.query(
    `UPDATE public.account_recovery_cases
        SET approval_request_id = $2,
            updated_at = $3::timestamptz
      WHERE id = $1`,
    [recoveryCase.id, approvalId, now],
  )

  const created = await client.query(
    `SELECT * FROM fin.approval_requests WHERE id = $1`,
    [approvalId],
  )
  return created.rows[0]
}

async function insertApprovalAction(client, { requestId, actorId, decision, now }) {
  const actorUuid = asUuidOrNull(actorId)
  if (!actorUuid) {
    throw new CastVoteError(
      CAST_VOTE_ERROR.FORBIDDEN,
      'Voter id must be a UUID for approval_actions',
      { httpStatus: 400 },
    )
  }
  try {
    await client.query(
      `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz)`,
      [randomUUID(), requestId, actorUuid, decision, now],
    )
  } catch (error) {
    if (String(error.message || '').includes('self-approval') || error.code === '23514') {
      throw new CastVoteError(
        CAST_VOTE_ERROR.OWN_CASE,
        'Self-approval rejected for this recovery approval request',
        { httpStatus: 403 },
      )
    }
    throw error
  }
}

async function createEscalationRequest(client, {
  recoveryCase,
  parentRequestId,
  firstVote,
  secondVote,
  firstReviewerId,
  secondReviewerId,
  now,
}) {
  const escalationId = randomUUID()
  const subjectId = asUuidOrNull(recoveryCase.id)
  const createdBy = asUuidOrNull(recoveryCase.user_id)
  const payload = {
    kind: 'account_recovery_vote_disagreement',
    case_id: recoveryCase.id,
    parent_approval_request_id: parentRequestId,
    first_vote: firstVote,
    first_vote_reviewer_id: firstReviewerId,
    second_vote: secondVote,
    second_vote_reviewer_id: secondReviewerId,
    workflow: 'WF-07/08-escalation',
  }
  await client.query(
    `INSERT INTO fin.approval_requests (
       id, environment, tenant_id, action_kind, status, subject_type, subject_id,
       payload_hash, payload, min_distinct_approvers,
       created_at, created_by_actor_type, created_by_actor_id, updated_at
     ) VALUES (
       $1, 'LIVE', NULL, 'PLATFORM_ADMIN_RECOVERY', 'REQUESTED',
       'account_recovery_escalation', $2,
       $3, $4::jsonb, 2,
       $5::timestamptz, 'USER', $6, $5::timestamptz
     )`,
    [
      escalationId,
      subjectId,
      `account_recovery_escalation:${recoveryCase.id}:${escalationId}`,
      JSON.stringify(payload),
      now,
      createdBy,
    ],
  )
  await client.query(
    `UPDATE fin.approval_requests
        SET status = 'CANCELED', updated_at = $2::timestamptz
      WHERE id = $1 AND status = 'REQUESTED'`,
    [parentRequestId, now],
  )
  await client.query(
    `UPDATE public.account_recovery_cases
        SET escalation_approval_request_id = $2,
            updated_at = $3::timestamptz
      WHERE id = $1`,
    [recoveryCase.id, escalationId, now],
  )
  return escalationId
}

async function finalizeApprovalRequest(client, { requestId, vote, actorId, now }) {
  if (vote === 'approve') {
    await client.query(
      `UPDATE fin.approval_requests
          SET status = 'APPROVED',
              updated_at = $2::timestamptz,
              updated_by_actor_id = $3
        WHERE id = $1`,
      [requestId, now, asUuidOrNull(actorId)],
    )
    await client.query(
      `UPDATE fin.approval_requests
          SET status = 'EXECUTED', updated_at = $2::timestamptz
        WHERE id = $1`,
      [requestId, now],
    )
  } else {
    await client.query(
      `UPDATE fin.approval_requests
          SET status = 'REJECTED',
              updated_at = $2::timestamptz,
              updated_by_actor_id = $3
        WHERE id = $1`,
      [requestId, now, asUuidOrNull(actorId)],
    )
  }
}

/**
 * Core cast-vote logic. Callers must enforce platform-admin auth before invoking.
 *
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
export async function castVote({
  caseId,
  voterId,
  vote,
  notes = '',
  ip = null,
  userAgent = null,
  isProduction = true,
  environment = null,
  issueRecoveryToken,
  logActivity,
  deriveTier = deriveAccountValueTier,
} = {}) {
  const normalizedVote = String(vote || '').trim().toLowerCase()
  if (normalizedVote !== 'approve' && normalizedVote !== 'reject') {
    throw new CastVoteError(
      CAST_VOTE_ERROR.INVALID_VOTE,
      'vote must be "approve" or "reject"',
      { httpStatus: 400 },
    )
  }

  const recoveryCase = await findOne('account_recovery_cases', (c) => c.id === caseId)
  // Cross-env access returns the same 404 as missing — no existence leak.
  const scopedEnv = normalizeWingcasterEnv(environment) || WINGCASTER_ENVS.LIVE
  if (!recoveryCase || !caseMatchesEnvironment(recoveryCase, scopedEnv)) {
    throw new CastVoteError(CAST_VOTE_ERROR.NOT_FOUND, 'Recovery case not found', { httpStatus: 404 })
  }
  if (recoveryCase.status !== 'pending_review') {
    throw new CastVoteError(
      CAST_VOTE_ERROR.NOT_PENDING,
      'Recovery case is not pending review',
      { httpStatus: 400 },
    )
  }
  if (recoveryCase.escalation_approval_request_id) {
    throw new CastVoteError(
      CAST_VOTE_ERROR.ALREADY_ESCALATED,
      'Recovery case is escalated and awaiting resolution',
      {
        httpStatus: 409,
        extra: { escalation_case_id: recoveryCase.escalation_approval_request_id },
      },
    )
  }

  // Submitter (case user_id) cannot vote on their own case.
  if (String(recoveryCase.user_id) === String(voterId)) {
    throw new CastVoteError(
      CAST_VOTE_ERROR.OWN_CASE,
      'Cannot vote on your own recovery case',
      { httpStatus: 403 },
    )
  }

  const tierInfo = recoveryCase.account_value_tier && recoveryCase.requires_two_person != null
    ? {
      tier: recoveryCase.account_value_tier,
      requires_two_person: Boolean(recoveryCase.requires_two_person),
    }
    : await deriveTier(recoveryCase.user_id)

  const requiresTwoPerson = tierInfo.requires_two_person ?? requiresTwoPersonForTier(tierInfo.tier)
  const now = new Date().toISOString()
  const notesText = notes || ''

  // Cache tier on the case for Agent 4 / list responses.
  if (recoveryCase.account_value_tier !== tierInfo.tier
    || recoveryCase.requires_two_person !== requiresTwoPerson) {
    await update('account_recovery_cases', (c) => c.id === recoveryCase.id, (c) => ({
      ...c,
      account_value_tier: tierInfo.tier,
      requires_two_person: requiresTwoPerson,
    }))
  }

  // Single-admin path.
  if (!requiresTwoPerson) {
    if (normalizedVote === 'approve') {
      const { token } = await executeApproveSideEffects({
        recoveryCase,
        reviewerId: voterId,
        notes: notesText,
        ip,
        userAgent,
        issueRecoveryToken,
        logActivity,
      })
      return {
        httpStatus: 200,
        body: {
          success: true,
          case_id: recoveryCase.id,
          status: 'approved',
          requires_two_person: false,
          account_value_tier: tierInfo.tier,
          message: 'Recovery case approved and token issued.',
          ...(!isProduction ? {
            _dev_recovery_token: token,
            _dev_recovery_reset_payload: { case_id: recoveryCase.id, token },
          } : {}),
        },
      }
    }

    await executeRejectSideEffects({
      recoveryCase,
      reviewerId: voterId,
      notes: notesText,
      logActivity,
    })
    return {
      httpStatus: 200,
      body: {
        success: true,
        case_id: recoveryCase.id,
        status: 'rejected',
        requires_two_person: false,
        account_value_tier: tierInfo.tier,
      },
    }
  }

  // Two-person path.
  if (recoveryCase.first_vote_reviewer_id
    && String(recoveryCase.first_vote_reviewer_id) === String(voterId)) {
    throw new CastVoteError(
      CAST_VOTE_ERROR.SAME_REVIEWER,
      'Same reviewer cannot cast the second vote',
      { httpStatus: 409 },
    )
  }

  const decision = decisionFromVote(normalizedVote)

  // First vote — record only.
  if (!recoveryCase.first_vote_reviewer_id) {
    const approval = await transaction(async (client) => {
      const req = await ensureApprovalRequest(client, {
        recoveryCase: {
          ...recoveryCase,
          account_value_tier: tierInfo.tier,
          requires_two_person: true,
        },
        voterId,
        vote: normalizedVote,
        notes: notesText,
        tier: tierInfo.tier,
        now,
      })
      await insertApprovalAction(client, {
        requestId: req.id,
        actorId: voterId,
        decision,
        now,
      })
      await client.query(
        `UPDATE public.account_recovery_cases
            SET first_vote_reviewer_id = $2,
                first_vote = $3,
                first_vote_at = $4::timestamptz,
                first_vote_notes = $5,
                account_value_tier = $6,
                requires_two_person = true,
                approval_request_id = COALESCE(approval_request_id, $7),
                updated_at = $4::timestamptz
          WHERE id = $1`,
        [
          recoveryCase.id,
          voterId,
          normalizedVote,
          now,
          notesText,
          tierInfo.tier,
          req.id,
        ],
      )
      return req
    })

    if (typeof logActivity === 'function') {
      await logActivity({
        type: 'account_recovery_vote_cast',
        agent_id: recoveryCase.user_id,
        meta: {
          case_id: recoveryCase.id,
          reviewer_id: voterId,
          vote: normalizedVote,
          vote_ordinal: 1,
          approval_request_id: approval.id,
        },
      })
    }

    return {
      httpStatus: 200,
      body: {
        success: true,
        case_id: recoveryCase.id,
        status: 'pending_review',
        requires_two_person: true,
        account_value_tier: tierInfo.tier,
        vote_recorded: normalizedVote,
        awaiting_second_vote: true,
        approval_request_id: approval.id,
        message: 'First vote recorded. Awaiting a second distinct reviewer.',
      },
    }
  }

  // Second distinct vote.
  const firstVote = recoveryCase.first_vote
  const agree = firstVote === normalizedVote

  if (!agree) {
    const escalationId = await transaction(async (client) => {
      const approvalId = recoveryCase.approval_request_id
      if (!approvalId) {
        throw new CastVoteError(
          CAST_VOTE_ERROR.NOT_PENDING,
          'Missing approval request for two-person recovery case',
          { httpStatus: 409 },
        )
      }
      await client.query(
        `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
        [approvalId],
      )
      await insertApprovalAction(client, {
        requestId: approvalId,
        actorId: voterId,
        decision,
        now,
      })
      await client.query(
        `UPDATE public.account_recovery_cases
            SET second_vote_reviewer_id = $2,
                second_vote = $3,
                second_vote_at = $4::timestamptz,
                second_vote_notes = $5,
                updated_at = $4::timestamptz
          WHERE id = $1`,
        [recoveryCase.id, voterId, normalizedVote, now, notesText],
      )
      return createEscalationRequest(client, {
        recoveryCase,
        parentRequestId: approvalId,
        firstVote,
        secondVote: normalizedVote,
        firstReviewerId: recoveryCase.first_vote_reviewer_id,
        secondReviewerId: voterId,
        now,
      })
    })

    if (typeof logActivity === 'function') {
      await logActivity({
        type: 'account_recovery_vote_disagreement',
        agent_id: recoveryCase.user_id,
        meta: {
          case_id: recoveryCase.id,
          first_vote: firstVote,
          second_vote: normalizedVote,
          escalation_case_id: escalationId,
        },
      })
    }

    throw new CastVoteError(
      CAST_VOTE_ERROR.VOTE_DISAGREEMENT,
      'Reviewer votes disagree; recovery escalated',
      {
        httpStatus: 409,
        extra: {
          escalation_case_id: escalationId,
          case_id: recoveryCase.id,
          first_vote: firstVote,
          second_vote: normalizedVote,
        },
      },
    )
  }

  // Votes agree — execute.
  const approvalRequestId = await transaction(async (client) => {
    const approvalId = recoveryCase.approval_request_id
    if (!approvalId) {
      throw new CastVoteError(
        CAST_VOTE_ERROR.NOT_PENDING,
        'Missing approval request for two-person recovery case',
        { httpStatus: 409 },
      )
    }
    await client.query(
      `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
      [approvalId],
    )
    await insertApprovalAction(client, {
      requestId: approvalId,
      actorId: voterId,
      decision,
      now,
    })
    await client.query(
      `UPDATE public.account_recovery_cases
          SET second_vote_reviewer_id = $2,
              second_vote = $3,
              second_vote_at = $4::timestamptz,
              second_vote_notes = $5,
              updated_at = $4::timestamptz
        WHERE id = $1`,
      [recoveryCase.id, voterId, normalizedVote, now, notesText],
    )
    await finalizeApprovalRequest(client, {
      requestId: approvalId,
      vote: normalizedVote,
      actorId: voterId,
      now,
    })
    return approvalId
  })

  // Side-effects after approval row is committed (token issuance uses DAL).
  const freshCase = await findOne('account_recovery_cases', (c) => c.id === caseId)
  if (normalizedVote === 'approve') {
    const { token } = await executeApproveSideEffects({
      recoveryCase: freshCase,
      reviewerId: voterId,
      notes: notesText || recoveryCase.first_vote_notes || '',
      ip,
      userAgent,
      issueRecoveryToken,
      logActivity,
    })
    return {
      httpStatus: 200,
      body: {
        success: true,
        case_id: recoveryCase.id,
        status: 'approved',
        requires_two_person: true,
        account_value_tier: tierInfo.tier,
        approval_request_id: approvalRequestId,
        message: 'Second matching approve recorded; recovery token issued.',
        ...(!isProduction ? {
          _dev_recovery_token: token,
          _dev_recovery_reset_payload: { case_id: recoveryCase.id, token },
        } : {}),
      },
    }
  }

  await executeRejectSideEffects({
    recoveryCase: freshCase,
    reviewerId: voterId,
    notes: notesText || recoveryCase.first_vote_notes || '',
    logActivity,
  })
  return {
    httpStatus: 200,
    body: {
      success: true,
      case_id: recoveryCase.id,
      status: 'rejected',
      requires_two_person: true,
      account_value_tier: tierInfo.tier,
      approval_request_id: approvalRequestId,
      message: 'Second matching reject recorded; recovery case rejected.',
    },
  }
}

/**
 * First reviewer withdraws their vote before a second vote is cast.
 * Clears first_vote fields and cancels the related fin.approval_request.
 *
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
export async function withdrawVote({
  caseId,
  actorId,
  logActivity,
} = {}) {
  const recoveryCase = await findOne('account_recovery_cases', (c) => c.id === caseId)
  if (!recoveryCase) {
    throw new CastVoteError(CAST_VOTE_ERROR.NOT_FOUND, 'Recovery case not found', { httpStatus: 404 })
  }

  if (String(recoveryCase.user_id) === String(actorId)) {
    throw new CastVoteError(
      CAST_VOTE_ERROR.OWN_CASE,
      'Cannot withdraw a vote on your own recovery case',
      { httpStatus: 403 },
    )
  }

  const finalized = ['approved', 'rejected', 'completed', 'expired'].includes(recoveryCase.status)
  if (finalized) {
    throw new CastVoteError(
      CAST_VOTE_ERROR.CASE_FINALIZED,
      'Cannot withdraw vote on a finalized recovery case',
      { httpStatus: 409 },
    )
  }

  if (recoveryCase.escalation_approval_request_id) {
    throw new CastVoteError(
      CAST_VOTE_ERROR.ALREADY_ESCALATED,
      'Recovery case is escalated; vote cannot be withdrawn',
      { httpStatus: 409 },
    )
  }

  if (!recoveryCase.first_vote_reviewer_id) {
    throw new CastVoteError(
      CAST_VOTE_ERROR.NO_FIRST_VOTE,
      'No first vote to withdraw',
      { httpStatus: 400 },
    )
  }

  if (String(recoveryCase.first_vote_reviewer_id) !== String(actorId)) {
    throw new CastVoteError(
      CAST_VOTE_ERROR.NOT_FIRST_VOTER,
      'Only the first reviewer can withdraw their vote',
      { httpStatus: 403 },
    )
  }

  if (recoveryCase.second_vote_reviewer_id || recoveryCase.second_vote) {
    throw new CastVoteError(
      CAST_VOTE_ERROR.SECOND_VOTE_CAST,
      'Cannot withdraw — second vote has already been cast',
      { httpStatus: 409 },
    )
  }

  if (recoveryCase.status !== 'pending_review') {
    throw new CastVoteError(
      CAST_VOTE_ERROR.NOT_PENDING,
      'Recovery case is not pending review',
      { httpStatus: 400 },
    )
  }

  const now = new Date().toISOString()
  const approvalId = recoveryCase.approval_request_id

  await transaction(async (client) => {
    if (approvalId) {
      await client.query(
        `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
        [approvalId],
      )
      // Cancel the open request; leave approval_actions for audit.
      await client.query(
        `UPDATE fin.approval_requests
            SET status = 'CANCELED',
                updated_at = $2::timestamptz,
                updated_by_actor_id = $3
          WHERE id = $1 AND status = 'REQUESTED'`,
        [approvalId, now, asUuidOrNull(actorId)],
      )
    }

    await client.query(
      `UPDATE public.account_recovery_cases
          SET first_vote_reviewer_id = NULL,
              first_vote = NULL,
              first_vote_at = NULL,
              first_vote_notes = NULL,
              second_vote_reviewer_id = NULL,
              second_vote = NULL,
              second_vote_at = NULL,
              second_vote_notes = NULL,
              approval_request_id = NULL,
              updated_at = $2::timestamptz
        WHERE id = $1`,
      [recoveryCase.id, now],
    )
  })

  if (typeof logActivity === 'function') {
    await logActivity({
      type: 'account_recovery_vote_withdrawn',
      agent_id: recoveryCase.user_id,
      meta: {
        case_id: recoveryCase.id,
        reviewer_id: actorId,
        previous_vote: recoveryCase.first_vote,
        previous_approval_request_id: approvalId,
      },
    })
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      case_id: recoveryCase.id,
      status: 'pending_review',
      message: 'Vote withdrawn. Case returned to pending review with no first vote recorded.',
    },
  }
}
