/** BE-APR-EXEC-02 — GET execute-preview composer. */

import { transaction } from '../../../db.js'
import { fromAnyEnv } from '../../../lib/session-env.js'
import { CATEGORY, finError } from '../../errors.js'
import { insertAudit } from '../../ledger/write.js'
import { issueConfirmationPhrase } from './confirmation-phrase.js'
import { buildDiff, actionSummary, outcomeUrlFor } from './dispatcher.js'
import { buildLedgerImpact } from './ledger-impact.js'
import { aggregateRiskSignals } from './risk-signals.js'
import { evaluateApprovalValueTier } from './value-tier.js'
import {
  VALUE_TIERS, initialsFromName, last6, resolveWorkflowCode, workflowLabel,
} from './workflow-map.js'

function actorLabel(id) {
  if (!id) return { id: null, display_name: 'Unknown', avatar_url: null, initials: '??' }
  const short = String(id).replace(/-/g, '').slice(0, 4).toUpperCase()
  return {
    id: String(id),
    display_name: `User ${short}`,
    avatar_url: null,
    initials: short.slice(0, 2),
  }
}

export function selfApprovalForbiddenError() {
  return finError('SELF_APPROVAL_FORBIDDEN', {
    category: CATEGORY.CONTROL,
    httpStatus: 403,
    details: {
      error: 'SELF_APPROVAL_FORBIDDEN',
      message: 'You submitted this request; a different Platform Admin must be the second approver.',
    },
  })
}

export async function loadApprovalForEnv(client, { id, environment }) {
  const { rows } = await client.query(
    `SELECT * FROM fin.approval_requests WHERE id = $1`,
    [id],
  )
  const row = rows[0]
  if (!row) return null
  if (row.environment !== environment) {
    throw finError('ENV_MISMATCH', {
      category: CATEGORY.VALIDATION,
      httpStatus: 403,
      details: {
        error: 'ENV_MISMATCH',
        message: 'Approval request environment does not match session environment.',
      },
    })
  }
  return row
}

async function buildExecutePreviewTx(client, {
  approvalId, environment, callerId, callerDisplayName, now,
  actorType = 'USER', actorEmail = 'admin@fin.local',
}) {
  const approval = await loadApprovalForEnv(client, { id: approvalId, environment })
  if (!approval) {
    throw finError('NOT_FOUND', { category: CATEGORY.PRECONDITION, httpStatus: 404 })
  }

  const selfApproval = Boolean(
    callerId && approval.created_by_actor_id
    && String(callerId) === String(approval.created_by_actor_id),
  )
  if (selfApproval) {
    await insertAudit(client, {
      environment, actorType, actorId: callerId, actorEmail,
      action: 'APPROVAL_SELF_APPROVAL_REJECTED', targetType: 'APPROVAL_REQUEST',
      targetId: approval.id, afterState: { stage: 'execute-preview' },
      reasonCode: 'SELF_APPROVAL_FORBIDDEN', approvalRequestId: approval.id, now,
    })
    throw selfApprovalForbiddenError()
  }

  const workflowCode = resolveWorkflowCode(approval)
  const tierInfo = evaluateApprovalValueTier(approval)
  const valueTier = tierInfo.tier

  if (!approval.workflow_code || !approval.value_tier) {
    await client.query(
      `UPDATE fin.approval_requests
          SET workflow_code = COALESCE(workflow_code, $2),
              value_tier = COALESCE(value_tier, $3),
              updated_at = $4
        WHERE id = $1`,
      [approval.id, workflowCode, valueTier, now],
    )
    approval.workflow_code = approval.workflow_code || workflowCode
    approval.value_tier = approval.value_tier || valueTier
  }

  let confirmationPhrase = null
  if (valueTier === VALUE_TIERS.HIGH_VALUE) {
    await issueConfirmationPhrase(client, {
      requestId: approval.id, now, currentAttempt: approval.execute_attempt || 0,
    })
    const refreshed = await client.query(
      `SELECT version, execute_attempt, confirmation_phrase
         FROM fin.approval_requests WHERE id = $1`,
      [approval.id],
    )
    approval.version = refreshed.rows[0].version
    approval.execute_attempt = refreshed.rows[0].execute_attempt
    confirmationPhrase = refreshed.rows[0].confirmation_phrase
  }

  const { rows: actions } = await client.query(
    `SELECT actor_id, decision, created_at
       FROM fin.approval_actions WHERE request_id = $1 ORDER BY created_at ASC`,
    [approval.id],
  )
  const firstApproverAction = actions.find((a) => a.decision === 'APPROVED') || actions[0] || null
  const submitter = actorLabel(approval.created_by_actor_id)
  const firstApprover = firstApproverAction
    ? { ...actorLabel(firstApproverAction.actor_id), signed_off_at: firstApproverAction.created_at }
    : null
  const candidate = {
    candidate_id: callerId || null,
    initials: initialsFromName(callerDisplayName)
      || (callerId ? String(callerId).replace(/-/g, '').slice(0, 2).toUpperCase() : '??'),
  }

  const riskSignals = await aggregateRiskSignals(client, {
    approval, valueTier, amountMinor: tierInfo.amount_minor, environment,
  })
  const currency = approval.payload?.currency || approval.payload?.payload?.currency || 'AED'
  const ledgerImpact = await buildLedgerImpact(client, {
    workflowCode, amountMinor: tierInfo.amount_minor, currency,
  })

  return {
    request: {
      id: approval.id,
      last6: last6(approval.id),
      version: Number(approval.version),
      workflow_code: workflowCode,
      workflow_label: workflowLabel(workflowCode),
      submitted_at: approval.created_at,
      submitted_by: submitter,
      value_tier: valueTier,
      status: approval.status,
      action_kind: approval.action_kind,
    },
    action_summary: actionSummary(approval, workflowCode),
    two_person: {
      requires_two_person: tierInfo.requires_two_person
        || Number(approval.min_distinct_approvers || 1) >= 2,
      first_approver: firstApprover,
      second_approver_slot: candidate,
    },
    diff: buildDiff(approval, workflowCode),
    risk_signals: riskSignals,
    ledger_impact: ledgerImpact,
    confirmation_phrase: confirmationPhrase,
    self_approval: false,
    step_up_required: false,
    outcome_url_template: outcomeUrlFor(workflowCode, approval),
    env: fromAnyEnv(environment),
  }
}

export async function buildExecutePreview(input) {
  return transaction((client) => buildExecutePreviewTx(client, input))
}
