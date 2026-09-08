/**
 * BE-ACR-09 — GET /api/admin/account-recovery/:caseId
 */

import { findOne } from '../db.js'
import {
  buildAgentPayload,
  buildCurrentReviewer,
  buildDecision,
  buildFirstVote,
  buildOnFileBlock,
  buildProvidedBlock,
  buildTimeline,
  caseCreatedAt,
  computeMismatches,
  loadEvidenceSummary,
  resolveCaseTier,
  resolveRequestEnv,
  slaHoursRemaining,
  SLA_HOURS_TOTAL,
} from './case-serializers.js'
import { deriveReasonCategory } from './mask.js'

export class AccountRecoveryCaseError extends Error {
  constructor(code, message, { httpStatus = 400 } = {}) {
    super(message)
    this.name = 'AccountRecoveryCaseError'
    this.code = code
    this.httpStatus = httpStatus
  }

  toJSON() {
    return { error: this.message, code: this.code }
  }
}

/**
 * @param {{ caseId: string, viewerId: string, req: import('express').Request }} args
 */
export async function getAccountRecoveryCase({ caseId, viewerId, req }) {
  const recoveryCase = await findOne('account_recovery_cases', (c) => c.id === caseId)
  if (!recoveryCase) {
    throw new AccountRecoveryCaseError('NOT_FOUND', 'Recovery case not found', { httpStatus: 404 })
  }

  const now = new Date()
  const env = resolveRequestEnv(req)
  const tiers = await resolveCaseTier(recoveryCase)
  const agent = await buildAgentPayload(recoveryCase.user_id)
  const evidence = await loadEvidenceSummary(recoveryCase.id)
  const provided = buildProvidedBlock(recoveryCase)
  const onFile = await buildOnFileBlock(recoveryCase.user_id, agent)
  const mismatches = computeMismatches({ recoveryCase, onFile })
  const timeline = await buildTimeline(recoveryCase)
  const firstVote = buildFirstVote(recoveryCase)
  const currentReviewer = buildCurrentReviewer(
    { ...recoveryCase, ...tiers },
    viewerId,
  )

  return {
    id: recoveryCase.id,
    created_at: caseCreatedAt(recoveryCase),
    sla_hours_remaining: slaHoursRemaining(recoveryCase, now),
    sla_hours_total: SLA_HOURS_TOTAL,
    status: recoveryCase.status,
    reason: recoveryCase.reason || '',
    reason_category: deriveReasonCategory(recoveryCase.reason, recoveryCase.reason_category),
    provided,
    on_file: onFile,
    mismatches,
    evidence,
    timeline,
    account_value_tier: tiers.account_value_tier,
    requires_two_person: tiers.requires_two_person,
    first_vote: firstVote,
    current_reviewer: currentReviewer,
    decision: buildDecision(recoveryCase),
    escalation_case_id: recoveryCase.escalation_approval_request_id || null,
    is_own: Boolean(viewerId && recoveryCase.user_id && String(recoveryCase.user_id) === String(viewerId)),
    env,
    // Convenience for UI that still expects agent summary on detail.
    agent,
  }
}
