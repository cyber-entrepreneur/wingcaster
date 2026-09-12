/** BE-APR-EXEC-01/03/04 — unified approval execute (single DB transaction). */

import { randomUUID } from 'node:crypto'
import { transaction } from '../../../db.js'
import { CATEGORY, finError } from '../../errors.js'
import { requestFingerprint } from '../../idempotency/fingerprint.js'
import { claimIdempotency, completeIdempotency } from '../../idempotency/claim.js'
import { insertAudit } from '../../ledger/write.js'
import { consumeConfirmationPhrase, phrasesMatch } from './confirmation-phrase.js'
import { actionSummary, dispatchWorkflowExecute, outcomeUrlFor } from './dispatcher.js'
import { loadApprovalForEnv, selfApprovalForbiddenError } from './execute-preview.js'
import { assertLedgerBalanced, buildLedgerImpact } from './ledger-impact.js'
import { evaluateApprovalValueTier } from './value-tier.js'
import { VALUE_TIERS, resolveWorkflowCode } from './workflow-map.js'

function executeHttpError(code, httpStatus, message, extra = {}) {
  return finError(code, {
    category: httpStatus === 403 ? CATEGORY.CONTROL
      : httpStatus === 409 ? CATEGORY.CONFLICT
        : httpStatus === 503 ? CATEGORY.CONSERVATION
          : CATEGORY.VALIDATION,
    httpStatus,
    details: { error: code, message, ...extra },
  })
}

async function writeFailureAudit(client, {
  environment, actor, approvalId, action, afterState, now,
}) {
  await insertAudit(client, {
    environment,
    actorType: actor.actorType || 'USER',
    actorId: actor.actorId,
    actorEmail: actor.actorEmail || 'admin@fin.local',
    action,
    targetType: 'APPROVAL_REQUEST',
    targetId: approvalId,
    afterState,
    reasonCode: action,
    approvalRequestId: approvalId,
    now,
  })
}

export function detectVoteMismatch(actions) {
  const decisions = new Set(actions.map((a) => a.decision))
  return decisions.has('APPROVED') && decisions.has('REJECTED')
}

async function executeApprovalTx(client, input) {
  const {
    approvalId, environment, callerId, workflowCode: requestedWorkflow,
    confirmationPhrase, expectedVersion, idempotencyKey, now,
    actorType = 'USER', actorEmail = 'admin@fin.local', reasonCode = 'ADMIN_EXECUTE',
  } = input

  if (!idempotencyKey) {
    throw executeHttpError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key header is required for execute.')
  }
  if (expectedVersion == null) {
    throw executeHttpError('PRECONDITION_REQUIRED', 428, 'If-Match header with the approval version is required.')
  }

  const actor = { actorType, actorId: callerId, actorEmail, reasonCode }
  const fingerprint = requestFingerprint({
    cmd: 'ApprovalExecute', approvalId,
    workflowCode: requestedWorkflow || null,
    confirmationPhrase: confirmationPhrase || null,
    expectedVersion,
  })

  const claimed = await claimIdempotency(client, {
    environment, tenantId: null,
    key: `APPROVAL_EXECUTE:${idempotencyKey}`,
    fingerprint, now, actorType, actorId: callerId,
  })
  if (claimed.kind === 'replay') return claimed.row.response_body

  try {
    const approval = await loadApprovalForEnv(client, { id: approvalId, environment })
    if (!approval) {
      throw finError('NOT_FOUND', { category: CATEGORY.PRECONDITION, httpStatus: 404 })
    }

    const locked = (await client.query(
      `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
      [approvalId],
    )).rows[0]

    if (Number(locked.version) !== Number(expectedVersion)) {
      await writeFailureAudit(client, {
        environment, actor, approvalId, now,
        action: 'APPROVAL_EXECUTE_STALE',
        afterState: { expected: expectedVersion, current: locked.version },
      })
      throw executeHttpError(
        'PRECONDITION_FAILED', 409,
        'The approval request has changed since you opened this confirmation.',
        { current_version: Number(locked.version) },
      )
    }

    if (callerId && locked.created_by_actor_id
      && String(callerId) === String(locked.created_by_actor_id)) {
      await writeFailureAudit(client, {
        environment, actor, approvalId, now,
        action: 'APPROVAL_SELF_APPROVAL_REJECTED',
        afterState: { stage: 'execute' },
      })
      throw selfApprovalForbiddenError()
    }

    const resolvedWorkflow = resolveWorkflowCode(locked)
    if (requestedWorkflow && String(requestedWorkflow).toUpperCase() !== resolvedWorkflow) {
      throw executeHttpError(
        'WORKFLOW_CODE_MISMATCH', 400,
        'workflow_code does not match this approval request.',
        { expected: resolvedWorkflow },
      )
    }
    const workflowCode = resolvedWorkflow

    const { rows: actions } = await client.query(
      `SELECT actor_id, decision, created_at
         FROM fin.approval_actions WHERE request_id = $1 ORDER BY created_at ASC`,
      [approvalId],
    )

    if (detectVoteMismatch(actions)) {
      const escalationCaseId = locked.escalation_case_id || randomUUID()
      await client.query(
        `UPDATE fin.approval_requests
            SET escalation_case_id = $2, vote_mismatch_at = $3, updated_at = $3
          WHERE id = $1`,
        [approvalId, escalationCaseId, now],
      )
      await writeFailureAudit(client, {
        environment, actor, approvalId, now,
        action: 'APPROVAL_VOTE_MISMATCH',
        afterState: { escalation_case_id: escalationCaseId },
      })
      throw executeHttpError(
        'VOTE_MISMATCH', 409,
        'Votes do not match — case escalated to PA-APR-005.',
        { escalation_case_id: escalationCaseId },
      )
    }

    const tierInfo = evaluateApprovalValueTier(locked)
    if (tierInfo.tier === VALUE_TIERS.HIGH_VALUE) {
      if (!phrasesMatch(locked.confirmation_phrase, confirmationPhrase)) {
        await writeFailureAudit(client, {
          environment, actor, approvalId, now,
          action: 'APPROVAL_PHRASE_MISMATCH',
          afterState: { attempt: locked.execute_attempt },
        })
        throw executeHttpError(
          'CONFIRMATION_PHRASE_MISMATCH', 400,
          'The confirmation phrase does not match the current request-attempt seed.',
        )
      }
    }

    const approvedCount = new Set(
      actions.filter((a) => a.decision === 'APPROVED').map((a) => String(a.actor_id)),
    ).size
    const minApprovers = Number(locked.min_distinct_approvers || 1)

    if (!['APPROVED', 'REQUESTED'].includes(locked.status)) {
      throw executeHttpError(
        'APPROVAL_NOT_EXECUTABLE', 409,
        `Approval status ${locked.status} cannot be executed.`,
      )
    }

    let working = locked
    if (working.status === 'REQUESTED') {
      const alreadyVoted = actions.some(
        (a) => String(a.actor_id) === String(callerId) && a.decision === 'APPROVED',
      )
      if (!alreadyVoted && callerId) {
        await client.query(
          `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
           VALUES ($1, $2, $3, 'APPROVED', $4)`,
          [randomUUID(), approvalId, callerId, now],
        )
      }
      const recount = await client.query(
        `SELECT COUNT(DISTINCT actor_id)::int AS n
           FROM fin.approval_actions WHERE request_id = $1 AND decision = 'APPROVED'`,
        [approvalId],
      )
      if ((recount.rows[0]?.n || 0) < minApprovers) {
        throw executeHttpError(
          'APPROVAL_INCOMPLETE', 409,
          `Need ${minApprovers} distinct APPROVED actors before execute.`,
        )
      }
      await client.query(
        `UPDATE fin.approval_requests SET status = 'APPROVED', updated_at = $2
          WHERE id = $1 AND version = $3`,
        [approvalId, now, working.version],
      )
      working = (await client.query(
        `SELECT * FROM fin.approval_requests WHERE id = $1`, [approvalId],
      )).rows[0]
    } else if (approvedCount < minApprovers) {
      throw executeHttpError(
        'APPROVAL_INCOMPLETE', 409,
        `Need ${minApprovers} distinct APPROVED actors before execute.`,
      )
    }

    const ledgerImpact = await buildLedgerImpact(client, {
      workflowCode,
      amountMinor: tierInfo.amount_minor,
      currency: working.payload?.currency || working.payload?.payload?.currency || 'AED',
    })
    try {
      assertLedgerBalanced(ledgerImpact)
    } catch (err) {
      if (err.code === 'LEDGER_PREVIEW_UNBALANCED') {
        await writeFailureAudit(client, {
          environment, actor, approvalId, now,
          action: 'APPROVAL_LEDGER_UNBALANCED',
          afterState: { delta: err.delta },
        })
        throw executeHttpError(
          'LEDGER_PREVIEW_UNBALANCED', 503,
          'Ledger preview does not balance; execution refused.',
          { delta: err.delta },
        )
      }
      throw err
    }

    if (tierInfo.tier === VALUE_TIERS.HIGH_VALUE && confirmationPhrase) {
      await consumeConfirmationPhrase(client, {
        requestId: approvalId, phrase: confirmationPhrase, now,
      })
      working = (await client.query(
        `SELECT * FROM fin.approval_requests WHERE id = $1`, [approvalId],
      )).rows[0]
    }

    const dispatched = await dispatchWorkflowExecute(client, {
      approval: working, workflowCode, actor, now, environment,
      idempotencyKeyId: claimed.row.id,
    })

    await client.query(
      `UPDATE fin.approval_requests
          SET status = 'EXECUTED',
              executed_at = $2,
              executed_by_actor_id = $3,
              updated_at = $2
        WHERE id = $1 AND status <> 'EXECUTED'`,
      [approvalId, now, callerId],
    )
    await client.query(
      `UPDATE fin.approval_requests
          SET executed_at = COALESCE(executed_at, $2),
              executed_by_actor_id = COALESCE(executed_by_actor_id, $3),
              updated_at = $2
        WHERE id = $1`,
      [approvalId, now, callerId],
    )

    const body = {
      ok: true,
      request_id: approvalId,
      executed_at: now,
      outcome_url: dispatched.outcome_url || outcomeUrlFor(workflowCode, working),
      ledger_journal_id: dispatched.ledger_journal_id || null,
      short_action_summary: dispatched.short_action_summary
        || actionSummary(working, workflowCode),
    }

    await insertAudit(client, {
      environment, actorType, actorId: callerId, actorEmail,
      action: 'APPROVAL_EXECUTED', targetType: 'APPROVAL_REQUEST',
      targetId: approvalId, afterState: body, reasonCode,
      approvalRequestId: approvalId, now,
    })

    await completeIdempotency(client, {
      id: claimed.row.id, now, status: 200, body,
    })
    return body
  } catch (error) {
    try {
      await client.query(
        `UPDATE fin.idempotency_keys SET status = 'FAILED', updated_at = $2
          WHERE id = $1 AND status = 'IN_FLIGHT'`,
        [claimed.row.id, now],
      )
    } catch { /* ignore */ }
    throw error
  }
}

export async function executeApproval(input) {
  return transaction((client) => executeApprovalTx(client, input))
}

export async function rejectApproval(input) {
  return transaction(async (client) => {
    const {
      approvalId, environment, callerId, expectedVersion, now,
      actorType = 'USER', actorEmail = 'admin@fin.local', reasonCode = 'ADMIN_REJECT',
    } = input

    const locked = (await client.query(
      `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
      [approvalId],
    )).rows[0]
    if (!locked || locked.environment !== environment) {
      throw finError('NOT_FOUND', { category: CATEGORY.PRECONDITION, httpStatus: 404 })
    }
    if (expectedVersion != null && Number(locked.version) !== Number(expectedVersion)) {
      throw executeHttpError(
        'PRECONDITION_FAILED', 409,
        'The approval request has changed since you opened this confirmation.',
        { current_version: Number(locked.version) },
      )
    }
    if (!['REQUESTED', 'APPROVED'].includes(locked.status)) {
      throw executeHttpError(
        'APPROVAL_NOT_REJECTABLE', 409,
        `Approval status ${locked.status} cannot be rejected.`,
      )
    }

    if (callerId) {
      await client.query(
        `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
         VALUES ($1, $2, $3, 'REJECTED', $4)`,
        [randomUUID(), approvalId, callerId, now],
      )
    }

    await client.query(
      `UPDATE fin.approval_requests SET status = 'REJECTED', updated_at = $2 WHERE id = $1`,
      [approvalId, now],
    )

    await insertAudit(client, {
      environment, actorType, actorId: callerId, actorEmail,
      action: 'APPROVAL_REJECTED', targetType: 'APPROVAL_REQUEST',
      targetId: approvalId, reasonCode, approvalRequestId: approvalId, now,
    })

    return { ok: true, request_id: approvalId, status: 'REJECTED' }
  })
}
