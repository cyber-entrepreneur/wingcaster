/**
 * Growth-OS Wave 0 — executions access layer (canonical writes).
 */

import { randomUUID } from 'node:crypto'
import { findAll, findOne, insert, update } from '../../persistence/index.js'
import { withTenant } from './with-tenant.js'

const EXECUTION_KINDS = new Set([
  'message', 'social_post', 'paid_ad', 'portal_submit', 'seo_page',
])
const EXECUTION_STATUSES = new Set([
  'draft', 'scheduled', 'in_review', 'queued', 'processing',
  'published', 'failed', 'cancelled',
])

/** Allowed status transitions (expand-safe; unpublished graph is permissive). */
const TRANSITIONS = {
  draft: new Set(['scheduled', 'in_review', 'queued', 'cancelled']),
  scheduled: new Set(['queued', 'processing', 'cancelled', 'failed']),
  in_review: new Set(['queued', 'processing', 'cancelled', 'failed', 'draft']),
  queued: new Set(['processing', 'published', 'failed', 'cancelled']),
  processing: new Set(['published', 'failed', 'cancelled', 'queued']),
  published: new Set(['failed', 'cancelled']),
  failed: new Set(['queued', 'cancelled', 'draft']),
  cancelled: new Set(['draft', 'queued']),
}

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

function assertKind(kind) {
  if (!EXECUTION_KINDS.has(kind)) {
    throw Object.assign(new Error(`Invalid execution.kind: ${kind}`), {
      code: 'INVALID_EXECUTION_KIND',
    })
  }
}

function assertStatus(status) {
  if (!EXECUTION_STATUSES.has(status)) {
    throw Object.assign(new Error(`Invalid execution.status: ${status}`), {
      code: 'INVALID_EXECUTION_STATUS',
    })
  }
}

function tenantContext(row, { agencyId = null, agentId = null } = {}) {
  return {
    agencyId: agencyId ?? row?.agency_id ?? null,
    agentId: agentId ?? row?.agent_id ?? null,
  }
}

export async function createExecution({
  kind,
  status = 'draft',
  agencyId = null,
  agentId = null,
  channelConnectionId = null,
  campaignId = null,
  journeyNodeRunId = null,
  creativeId = null,
  audienceId = null,
  subjectType = null,
  subjectId = null,
  scheduledAt = null,
  recurrence = null,
  providerRef = null,
  id = null,
  data = {},
} = {}) {
  assertKind(kind)
  assertStatus(status)

  return withTenant(agencyId, agentId, () =>
    insert('executions', {
      id: id || prefixedId('exec_'),
      kind,
      status,
      agency_id: agencyId,
      agent_id: agentId,
      channel_connection_id: channelConnectionId,
      campaign_id: campaignId,
      journey_node_run_id: journeyNodeRunId,
      creative_id: creativeId,
      audience_id: audienceId,
      subject_type: subjectType,
      subject_id: subjectId,
      scheduled_at: scheduledAt,
      recurrence,
      provider_ref: providerRef,
      data,
    }),
  )
}

export async function scheduleExecution(
  id,
  scheduledAt,
  { recurrence = null, agencyId = null, agentId = null } = {},
) {
  if (!scheduledAt) {
    throw Object.assign(new Error('scheduledAt is required'), { code: 'MISSING_SCHEDULED_AT' })
  }
  const existing = await getExecution(id, { agencyId, agentId })
  if (!existing) {
    throw Object.assign(new Error(`execution not found: ${id}`), { code: 'EXECUTION_NOT_FOUND' })
  }
  const tenant = tenantContext(existing, { agencyId, agentId })
  assertStatus(existing.status)
  const next = 'scheduled'
  if (existing.status !== 'scheduled' && !TRANSITIONS[existing.status]?.has(next)) {
    throw Object.assign(
      new Error(`Cannot schedule execution from status ${existing.status}`),
      { code: 'INVALID_EXECUTION_TRANSITION' },
    )
  }
  return withTenant(tenant.agencyId, tenant.agentId, async () => {
    const changed = await update(
      'executions',
      (row) => row.id === id,
      (row) => ({
        ...row,
        status: next,
        scheduled_at: scheduledAt,
        recurrence: recurrence ?? row.recurrence ?? null,
      }),
    )
    if (!changed) {
      throw Object.assign(new Error(`execution not found: ${id}`), { code: 'EXECUTION_NOT_FOUND' })
    }
    return findOne('executions', (row) => row.id === id)
  })
}

export async function transitionExecution(
  id,
  nextStatus,
  { providerRef = undefined, publishedAt = undefined, agencyId = null, agentId = null } = {},
) {
  assertStatus(nextStatus)
  const existing = await getExecution(id, { agencyId, agentId })
  if (!existing) {
    throw Object.assign(new Error(`execution not found: ${id}`), { code: 'EXECUTION_NOT_FOUND' })
  }
  const tenant = tenantContext(existing, { agencyId, agentId })
  const allowed = TRANSITIONS[existing.status]
  if (!allowed?.has(nextStatus) && existing.status !== nextStatus) {
    throw Object.assign(
      new Error(`Invalid transition ${existing.status} → ${nextStatus}`),
      { code: 'INVALID_EXECUTION_TRANSITION' },
    )
  }
  const now = new Date().toISOString()
  return withTenant(tenant.agencyId, tenant.agentId, async () => {
    const changed = await update(
      'executions',
      (row) => row.id === id,
      (row) => {
        const patch = {
          ...row,
          status: nextStatus,
        }
        if (providerRef !== undefined) patch.provider_ref = providerRef
        if (nextStatus === 'published') {
          patch.published_at = publishedAt || row.published_at || now
          patch.completed_at = row.completed_at || now
        }
        if (nextStatus === 'failed' || nextStatus === 'cancelled') {
          patch.completed_at = row.completed_at || now
        }
        return patch
      },
    )
    if (!changed) {
      throw Object.assign(new Error(`execution not found: ${id}`), { code: 'EXECUTION_NOT_FOUND' })
    }
    return findOne('executions', (row) => row.id === id)
  })
}

export async function getExecution(id, { agencyId = null, agentId = null } = {}) {
  if (!id) return null
  return withTenant(agencyId, agentId, () =>
    findOne('executions', (row) => row.id === id),
  )
}

export async function listExecutions({
  agencyId = null,
  agentId = null,
  status = null,
  kind = null,
  channelConnectionId = null,
} = {}) {
  return withTenant(agencyId, agentId, () =>
    findAll('executions', (row) => {
      if (agencyId != null && row.agency_id !== agencyId) return false
      if (agentId != null && row.agent_id !== agentId) return false
      if (status != null && row.status !== status) return false
      if (kind != null && row.kind !== kind) return false
      if (channelConnectionId != null && row.channel_connection_id !== channelConnectionId) return false
      return true
    }),
  )
}

export async function recordExecutionAttempt({
  executionId,
  status = null,
  response = null,
  errorMessage = null,
  errorClass = null,
  attemptedAt = null,
  id = null,
  data = {},
  agencyId = null,
  agentId = null,
} = {}) {
  if (!executionId) {
    throw Object.assign(new Error('executionId is required'), { code: 'MISSING_EXECUTION_ID' })
  }
  const parent = await getExecution(executionId, { agencyId, agentId })
  if (!parent) {
    throw Object.assign(new Error(`execution not found: ${executionId}`), {
      code: 'EXECUTION_NOT_FOUND',
    })
  }
  const tenant = tenantContext(parent, { agencyId, agentId })
  return withTenant(tenant.agencyId, tenant.agentId, () =>
    insert('execution_attempts', {
      id: id || prefixedId('exa_'),
      execution_id: executionId,
      status,
      response,
      error_message: errorMessage,
      error_class: errorClass,
      attempted_at: attemptedAt || new Date().toISOString(),
      data,
    }),
  )
}

export { EXECUTION_KINDS, EXECUTION_STATUSES, TRANSITIONS }
