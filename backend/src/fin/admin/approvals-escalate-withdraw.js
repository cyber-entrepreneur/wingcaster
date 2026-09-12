/**
 * BE-BLOCKER-33 — PA-APR-005 escalate + PA-APR-006 withdraw.
 * Prefer brief field names; accept prompt aliases (targetUserId, rationale).
 */
import { getPool } from '../../persistence/postgres-adapter.js'
import { insertAudit, insertOutbox } from '../ledger/write.js'

export const MAX_ESCALATION_HOPS = 3

export const ESCALATION_REASON_VOCAB = Object.freeze([
  'out_of_scope_authority',
  'conflict_of_interest',
  'requires_domain_expertise',
  'contentious',
  'compliance_concern',
  'other',
])

export const OPEN_APPROVAL_STATUSES = Object.freeze(['REQUESTED', 'PENDING_APPROVAL'])
export const DECIDED_APPROVAL_STATUSES = Object.freeze([
  'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELED', 'EXPIRED',
])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class ApprovalActionError extends Error {
  constructor(error, httpStatus = 400, extra = {}) {
    super(error)
    this.name = 'ApprovalActionError'
    this.error = error
    this.httpStatus = httpStatus
    this.extra = extra
  }

  toJSON() {
    return { error: this.error, ...this.extra }
  }
}

function asUuid(value) {
  if (value == null || value === '') return null
  const s = String(value)
  return UUID_RE.test(s) ? s : null
}

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] != null && obj[key] !== '') return obj[key]
  }
  return undefined
}

function normalizeChannels(raw) {
  const list = Array.isArray(raw) ? raw.map((c) => String(c).toLowerCase()) : []
  const set = new Set(list.filter((c) => ['email', 'slack', 'teams'].includes(c)))
  set.add('email')
  return [...set]
}

function chainLength(row) {
  const chain = row?.escalation_chain
  if (Array.isArray(chain)) return chain.length
  if (typeof chain === 'string') {
    try {
      const parsed = JSON.parse(chain)
      return Array.isArray(parsed) ? parsed.length : 0
    } catch {
      return 0
    }
  }
  return 0
}

function parseChain(row) {
  const chain = row?.escalation_chain
  if (Array.isArray(chain)) return chain
  if (typeof chain === 'string') {
    try {
      const parsed = JSON.parse(chain)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Workflow-specific revert-to-DRAFT handlers.
 * Return `{ type, id, status }` or null when the entity row is missing.
 */
export const ENTITY_REVERT_HANDLERS = Object.freeze({
  product_package_versions: async (client, subjectId) => {
    const { rows } = await client.query(
      `UPDATE public.product_package_versions
          SET state = 'DRAFT',
              approval_request_id = NULL
        WHERE id = $1
        RETURNING id, state`,
      [subjectId],
    )
    if (!rows[0]) return null
    return { type: 'package_version', id: rows[0].id, status: 'DRAFT' }
  },
  package_version: async (client, subjectId) => ENTITY_REVERT_HANDLERS.product_package_versions(client, subjectId),
  product_package_version: async (client, subjectId) => ENTITY_REVERT_HANDLERS.product_package_versions(client, subjectId),
})

async function loadApproval(client, { id, environment, forUpdate = false }) {
  const { rows } = await client.query(
    `SELECT * FROM fin.approval_requests
      WHERE id = $1 AND environment = $2
      ${forUpdate ? 'FOR UPDATE' : ''}`,
    [id, environment],
  )
  return rows[0] || null
}

async function assertTargetEligible(client, {
  targetId, submitterId, actorId, requestType,
}) {
  if (!asUuid(targetId)) {
    throw new ApprovalActionError('TARGET_INELIGIBLE', 422, { reason: 'target_missing_capability' })
  }
  if (submitterId && String(targetId) === String(submitterId)) {
    throw new ApprovalActionError('TARGET_INELIGIBLE', 422, { reason: 'target_same_as_submitter' })
  }
  if (actorId && String(targetId) === String(actorId)) {
    throw new ApprovalActionError('TARGET_INELIGIBLE', 422, { reason: 'target_missing_capability' })
  }

  const { rows } = await client.query(
    `SELECT id, name, email, role, platform_role,
            COALESCE((data->>'out_of_office')::boolean, false) AS out_of_office
       FROM public.users
      WHERE id = $1`,
    [String(targetId)],
  )
  const user = rows[0]
  if (!user || user.platform_role !== 'platform_admin') {
    throw new ApprovalActionError('TARGET_INELIGIBLE', 422, { reason: 'target_missing_capability' })
  }
  if (user.out_of_office) {
    throw new ApprovalActionError('TARGET_INELIGIBLE', 422, { reason: 'target_out_of_office' })
  }

  // request_type is advisory for capability_match; platform_admin is always eligible.
  void requestType
  return user
}

function initialsFrom(name, email) {
  const source = String(name || email || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase() || '?'
}

export async function listEligibleEscalationTargets({
  approvalId,
  environment,
  actorId,
  requestType = null,
  q = null,
  limit = 20,
}) {
  const pool = getPool()
  const approval = await loadApproval(pool, { id: approvalId, environment })
  if (!approval) {
    throw new ApprovalActionError('NOT_FOUND', 404)
  }

  const hops = chainLength(approval)
  if (hops >= MAX_ESCALATION_HOPS) {
    throw new ApprovalActionError('MAX_HOPS_REACHED', 429, { hop: hops + 1 })
  }

  const submitterId = approval.created_by_actor_id
  const params = [String(submitterId || ''), String(actorId || '')]
  let filter = `
    platform_role = 'platform_admin'
    AND id::text <> $1
    AND id::text <> $2
  `
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim()}%`)
    filter += ` AND (COALESCE(name, '') ILIKE $3 OR COALESCE(email, '') ILIKE $3)`
  }
  params.push(Math.min(Math.max(Number(limit) || 20, 1), 20))

  const { rows } = await pool.query(
    `SELECT id, name, email, role, platform_role,
            COALESCE((data->>'out_of_office')::boolean, false) AS out_of_office
       FROM public.users
      WHERE ${filter}
        AND COALESCE((data->>'out_of_office')::boolean, false) = false
      ORDER BY name NULLS LAST, email
      LIMIT $${params.length}`,
    params,
  )

  const kind = requestType || approval.action_kind
  return {
    targets: rows.map((row) => ({
      id: row.id,
      display_name: row.name || row.email,
      initials: initialsFrom(row.name, row.email),
      role: row.role || row.platform_role || 'platform_admin',
      capability_match: true,
      out_of_office: Boolean(row.out_of_office),
      request_type: kind,
    })),
    hop: hops + 1,
    max_hops: MAX_ESCALATION_HOPS,
  }
}

export async function escalateApproval({
  approvalId,
  environment,
  actorId,
  actorEmail,
  actorType = 'USER',
  body = {},
  now = new Date().toISOString(),
  expectedVersion = null,
}) {
  const reasonVocab = pick(body, 'reason_vocab', 'reasonVocab', 'rationale_vocab')
  const targetApproverId = asUuid(pick(body, 'target_approver_id', 'targetApproverId', 'targetUserId', 'target_user_id'))
  const notes = String(pick(body, 'notes', 'rationale', 'reason') || '').trim()
  const notifyChannels = normalizeChannels(pick(body, 'notify_channels', 'notifyChannels'))

  if (!ESCALATION_REASON_VOCAB.includes(reasonVocab)) {
    throw new ApprovalActionError('VALIDATION', 400, {
      field: 'reason_vocab',
      allowed: ESCALATION_REASON_VOCAB,
    })
  }
  if (!targetApproverId) {
    throw new ApprovalActionError('VALIDATION', 400, { field: 'target_approver_id' })
  }
  const minNotes = reasonVocab === 'other' ? 30 : 10
  if (notes.length < minNotes || notes.length > 1000) {
    throw new ApprovalActionError('VALIDATION', 400, {
      field: 'notes',
      min: minNotes,
      max: 1000,
    })
  }

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const approval = await loadApproval(client, { id: approvalId, environment, forUpdate: true })
    if (!approval) {
      throw new ApprovalActionError('NOT_FOUND', 404)
    }

    if (expectedVersion != null && Number(approval.version) !== Number(expectedVersion)) {
      const err = new ApprovalActionError('PRECONDITION_FAILED', 412, {
        current_version: approval.version,
      })
      throw err
    }

    if (approval.status === 'WITHDRAWN') {
      throw new ApprovalActionError('ALREADY_WITHDRAWN', 409, {
        withdrawn_at: approval.withdrawn_at,
      })
    }
    if (DECIDED_APPROVAL_STATUSES.includes(approval.status)) {
      throw new ApprovalActionError('ALREADY_DECIDED', 409, {
        decided_by: approval.updated_by_actor_id || null,
        decided_at: approval.updated_at || null,
        decision: approval.status,
      })
    }
    if (!OPEN_APPROVAL_STATUSES.includes(approval.status)) {
      throw new ApprovalActionError('ALREADY_DECIDED', 409, {
        decided_by: approval.updated_by_actor_id || null,
        decided_at: approval.updated_at || null,
        decision: approval.status,
      })
    }

    const submitterId = approval.created_by_actor_id
    if (submitterId && actorId && String(submitterId) === String(actorId)) {
      throw new ApprovalActionError('SUBMITTER_CANNOT_ESCALATE', 403)
    }

    const hops = chainLength(approval)
    if (hops >= MAX_ESCALATION_HOPS) {
      throw new ApprovalActionError('MAX_HOPS_REACHED', 429, { hop: hops + 1 })
    }

    await assertTargetEligible(client, {
      targetId: targetApproverId,
      submitterId,
      actorId,
      requestType: approval.action_kind,
    })

    const hopEntry = {
      from: actorId,
      to: targetApproverId,
      at: now,
      reason: reasonVocab,
      notes,
      notify_channels: notifyChannels,
    }
    const nextChain = [...parseChain(approval), hopEntry]

    const { rows } = await client.query(
      `UPDATE fin.approval_requests
          SET escalated_from = $2,
              escalated_to = $3,
              escalated_to_user_id = $3,
              escalation_reason = $4,
              escalation_rationale = $4,
              escalation_notes = $5,
              escalation_chain = $6::jsonb,
              escalation_notify_channels = $7::jsonb,
              updated_at = $8::timestamptz,
              updated_by_actor_type = $9,
              updated_by_actor_id = $10
        WHERE id = $1
        RETURNING *`,
      [
        approvalId,
        actorId,
        targetApproverId,
        reasonVocab,
        notes,
        JSON.stringify(nextChain),
        JSON.stringify(notifyChannels),
        now,
        actorType,
        actorId,
      ],
    )
    const updated = rows[0]

    await insertAudit(client, {
      environment,
      actorType,
      actorId,
      actorEmail: actorEmail || 'admin@fin.local',
      action: 'approval.escalated',
      targetType: 'approval_request',
      targetId: approvalId,
      beforeState: {
        status: approval.status,
        escalated_to: approval.escalated_to,
        hop: hops,
      },
      afterState: {
        status: updated.status,
        escalated_from: updated.escalated_from,
        escalated_to: updated.escalated_to,
        escalation_reason: updated.escalation_reason,
        hop: nextChain.length,
        notify_channels: notifyChannels,
        notes,
        target: targetApproverId,
      },
      reasonCode: reasonVocab,
      approvalRequestId: approvalId,
      now,
    })

    await insertOutbox(client, {
      environment,
      topic: 'approval.escalated',
      dedupeKey: `approval.escalated:${approvalId}:${nextChain.length}`,
      payload: {
        approval_request_id: approvalId,
        from: actorId,
        to: targetApproverId,
        reason: reasonVocab,
        notify_channels: notifyChannels,
        hop: nextChain.length,
      },
      now,
    })

    await client.query('COMMIT')
    return {
      approval_request: {
        id: updated.id,
        status: updated.status === 'REQUESTED' ? 'PENDING_APPROVAL' : updated.status,
        escalated_from: updated.escalated_from,
        escalated_to: updated.escalated_to,
        escalation_reason: updated.escalation_reason,
        escalation_notes: updated.escalation_notes,
        escalation_chain: parseChain(updated),
        escalation_notify_channels: updated.escalation_notify_channels || notifyChannels,
        version: updated.version,
      },
      notifications_dispatched: notifyChannels,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export async function withdrawApproval({
  approvalId,
  environment,
  actorId,
  actorEmail,
  actorType = 'USER',
  body = {},
  now = new Date().toISOString(),
  expectedVersion = null,
}) {
  const reason = String(pick(body, 'reason', 'withdrawal_reason', 'withdrawalReason') || '').trim()
  if (reason.length < 10 || reason.length > 1000) {
    throw new ApprovalActionError('VALIDATION', 400, {
      field: 'reason',
      min: 10,
      max: 1000,
    })
  }

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const approval = await loadApproval(client, { id: approvalId, environment, forUpdate: true })
    if (!approval) {
      throw new ApprovalActionError('NOT_FOUND', 404)
    }

    if (expectedVersion != null && Number(approval.version) !== Number(expectedVersion)) {
      throw new ApprovalActionError('PRECONDITION_FAILED', 412, {
        current_version: approval.version,
      })
    }

    const submitterId = approval.created_by_actor_id
    if (!actorId || !submitterId || String(submitterId) !== String(actorId)) {
      throw new ApprovalActionError('SUBMITTER_ONLY', 403)
    }

    if (approval.status === 'WITHDRAWN') {
      throw new ApprovalActionError('ALREADY_WITHDRAWN', 409, {
        withdrawn_at: approval.withdrawn_at,
      })
    }
    if (DECIDED_APPROVAL_STATUSES.includes(approval.status)) {
      throw new ApprovalActionError('ALREADY_DECIDED', 409, {
        decided_by: approval.updated_by_actor_id || null,
        decided_at: approval.updated_at || null,
        decision: approval.status,
      })
    }
    if (!OPEN_APPROVAL_STATUSES.includes(approval.status)) {
      throw new ApprovalActionError('ALREADY_DECIDED', 409, {
        decided_by: approval.updated_by_actor_id || null,
        decided_at: approval.updated_at || null,
        decision: approval.status,
      })
    }

    let entity = null
    if (approval.subject_type && approval.subject_id) {
      const handler = ENTITY_REVERT_HANDLERS[approval.subject_type]
      if (handler) {
        entity = await handler(client, approval.subject_id)
        if (!entity) {
          throw new ApprovalActionError('ENTITY_NOT_RECOVERABLE', 409, {
            entity_type: approval.subject_type,
            entity_id: approval.subject_id,
          })
        }
      }
    }

    const { rows } = await client.query(
      `UPDATE fin.approval_requests
          SET status = 'WITHDRAWN',
              withdrawn_at = $2::timestamptz,
              withdrawn_by = $3,
              withdrawal_reason = $4,
              updated_at = $2::timestamptz,
              updated_by_actor_type = $5,
              updated_by_actor_id = $3
        WHERE id = $1
        RETURNING *`,
      [approvalId, now, actorId, reason, actorType],
    )
    const updated = rows[0]

    await insertAudit(client, {
      environment,
      actorType,
      actorId,
      actorEmail: actorEmail || 'admin@fin.local',
      action: 'approval.withdrawn',
      targetType: 'approval_request',
      targetId: approvalId,
      beforeState: { status: approval.status },
      afterState: {
        status: 'WITHDRAWN',
        withdrawn_by: actorId,
        withdrawal_reason: reason,
        entity_type: entity?.type || approval.subject_type || null,
        entity_id: entity?.id || approval.subject_id || null,
      },
      reasonCode: 'WITHDRAW',
      approvalRequestId: approvalId,
      now,
    })

    await insertOutbox(client, {
      environment,
      topic: 'approval.withdrawn',
      dedupeKey: `approval.withdrawn:${approvalId}`,
      payload: {
        approval_request_id: approvalId,
        actor: actorId,
        reason,
        entity_type: entity?.type || approval.subject_type || null,
        entity_id: entity?.id || approval.subject_id || null,
      },
      now,
    })

    await client.query('COMMIT')
    return {
      approval_request: {
        id: updated.id,
        status: updated.status,
        withdrawn_at: updated.withdrawn_at,
        withdrawn_by: updated.withdrawn_by,
        withdrawal_reason: updated.withdrawal_reason,
        version: updated.version,
      },
      entity,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
