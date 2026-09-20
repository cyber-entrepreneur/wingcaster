/**
 * PA-DUN-005 — submit dunning write-off for maker-checker approval (WF-14).
 */
import { randomUUID } from 'node:crypto'
import { transaction } from '../../db.js'
import { CATEGORY, finError } from '../errors.js'
import { requestFingerprint } from '../idempotency/fingerprint.js'
import { insertAudit } from '../ledger/write.js'
import { envelope, requireReason } from '../postpaid/helpers.js'
import { evaluateApprovalValueTier } from '../admin/approvals/value-tier.js'
import { getDunningCase } from '../admin/reads.js'

const WRITE_OFF_REASONS = new Set(['BAD_DEBT', 'FRAUD', 'REGULATORY', 'OTHER'])

export async function requestDunningWriteOff(input) {
  const env = envelope(input)
  requireReason(env.reasonCode)
  const caseId = input.caseId
  const amountMinor = input.amountMinor ?? input.amount_minor
  const reasonCategory = String(input.reasonCategory || input.reason_category || '').toUpperCase()
  const evidence = String(input.evidence || '').trim()
  if (!caseId || amountMinor == null) {
    throw finError('REASON_CODE_REQUIRED', {
      category: CATEGORY.VALIDATION,
      details: { fields: ['caseId', 'amountMinor'] },
    })
  }
  if (!WRITE_OFF_REASONS.has(reasonCategory)) {
    throw finError('REASON_CODE_REQUIRED', {
      category: CATEGORY.VALIDATION,
      details: { field: 'reasonCategory' },
    })
  }
  if (!evidence) {
    throw finError('REASON_CODE_REQUIRED', {
      category: CATEGORY.VALIDATION,
      details: { field: 'evidence' },
    })
  }

  const dunningCase = await getDunningCase({ environment: env.environment, id: caseId })
  if (!dunningCase) {
    throw finError('NOT_FOUND', { category: CATEGORY.PRECONDITION, httpStatus: 404 })
  }

  const payload = {
    workflow: 'WF-14',
    case_id: caseId,
    invoice_id: dunningCase.invoice_id,
    invoice_number: dunningCase.invoice_number,
    amount_minor: String(amountMinor),
    currency: 'USD',
    reason_category: reasonCategory,
    evidence,
    dunning_status: dunningCase.status,
  }
  const tier = evaluateApprovalValueTier({
    action_kind: 'WRITE_OFF',
    payload: { amount_minor: amountMinor },
  })

  return transaction(async (client) => {
    const approvalId = randomUUID()
    await client.query(
      `INSERT INTO fin.approval_requests (
         id, environment, tenant_id, action_kind, status, subject_type, subject_id,
         payload_hash, payload, min_distinct_approvers, workflow_code, value_tier,
         created_at, created_by_actor_type, created_by_actor_id, updated_at
       ) VALUES (
         $1, $2, $3, 'WRITE_OFF', 'REQUESTED', 'DUNNING_CASE', $4,
         $5, $6::jsonb, 2, 'WF-14', $7,
         $8, $9, $10, $8
       )`,
      [
        approvalId,
        env.environment,
        dunningCase.tenant_id,
        caseId,
        requestFingerprint(payload),
        JSON.stringify(payload),
        tier.tier,
        env.now,
        env.actorType,
        env.actorId,
      ],
    )
    await insertAudit(client, {
      environment: env.environment,
      actorType: env.actorType,
      actorId: env.actorId,
      actorEmail: env.actorEmail,
      action: 'WRITE_OFF_SUBMITTED',
      targetType: 'APPROVAL_REQUEST',
      targetId: approvalId,
      afterState: {
        case_id: caseId,
        amount_minor: String(amountMinor),
        reason_category: reasonCategory,
      },
      reasonCode: env.reasonCode,
      approvalRequestId: approvalId,
      now: env.now,
    })
    return {
      approvalRequestId: approvalId,
      caseId,
      status: 'REQUESTED',
      workflowCode: 'WF-14',
    }
  })
}
