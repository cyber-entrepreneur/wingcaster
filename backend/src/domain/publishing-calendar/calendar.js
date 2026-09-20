/**
 * Wave 2B — calendar read model + reschedule / bulk draft actions.
 * All execution reads/writes go through growth-os under withTenant.
 */

import { findOne, query } from '../../persistence/index.js'
import {
  getExecution,
  isReschedulable,
  listExecutions,
  scheduleExecution,
  transitionExecution,
} from '../../lib/growth-os/index.js'
import { RESCHEDULABLE_STATUSES } from './constants.js'

/**
 * Resolve agent ids for an optional office soft-filter.
 * Assumption: no first-class office entity yet — match agents whose
 * `data.office_id` or `data.office` equals the requested office key,
 * or whose `data.office_address` equals it. When office is set but
 * no agents match, returns [] (empty calendar) and marks filter unsupported
 * only when zero agency agents carry any office attribute at all.
 *
 * Agents are not Growth-OS RLS'd — query is SQL-scoped by agency_id
 * (Wave 1D: never unbounded findAll on tenant tables).
 */
export async function resolveOfficeAgentIds(agencyId, office) {
  if (!office) {
    return { agentIds: null, officeSupported: true, officeMatched: true }
  }
  if (!agencyId) {
    throw Object.assign(new Error('agencyId is required for office filter'), {
      code: 'MISSING_AGENCY_ID',
    })
  }

  const rows = await query(
    `SELECT id,
            data->>'office_id' AS office_id,
            data->>'office' AS office,
            data->>'office_address' AS office_address
       FROM public.agents
      WHERE agency_id = $1`,
    [agencyId],
  )

  const needle = String(office).trim().toLowerCase()
  let anyOfficeAttr = false
  const matched = []
  for (const agent of rows) {
    const candidates = [agent.office_id, agent.office, agent.office_address]
      .filter((v) => v != null && String(v).trim() !== '')
      .map((v) => String(v).trim().toLowerCase())
    if (candidates.length) anyOfficeAttr = true
    if (candidates.includes(needle)) matched.push(agent.id)
  }

  return {
    agentIds: matched,
    officeSupported: anyOfficeAttr,
    officeMatched: matched.length > 0,
  }
}

/**
 * Calendar/list query over executions with the full filter set.
 */
export async function queryCalendarExecutions({
  agencyId,
  agentId = null,
  from = null,
  to = null,
  status = null,
  kind = null,
  campaignId = null,
  propertyId = null,
  channelConnectionId = null,
  office = null,
  limit = 2000,
} = {}) {
  if (!agencyId) {
    throw Object.assign(new Error('agencyId is required'), { code: 'MISSING_AGENCY_ID' })
  }

  const unsupportedFilters = []
  let agentIds = agentId ? [agentId] : null

  if (office) {
    const officeResolution = await resolveOfficeAgentIds(agencyId, office)
    if (!officeResolution.officeSupported) {
      unsupportedFilters.push('office')
    }
    if (agentIds) {
      const officeSet = new Set(officeResolution.agentIds || [])
      agentIds = agentIds.filter((id) => officeSet.has(id))
    } else {
      agentIds = officeResolution.agentIds || []
    }
    // Office requested with zero matching agents → empty calendar (not unfiltered).
    if (agentIds.length === 0) {
      return {
        executions: [],
        total: 0,
        truncated: false,
        filters: {
          from,
          to,
          status,
          kind,
          campaign_id: campaignId,
          property_id: propertyId,
          agent_id: agentId,
          channel_connection_id: channelConnectionId,
          office,
        },
        meta: {
          unsupported_filters: unsupportedFilters,
          reschedulable_statuses: [...RESCHEDULABLE_STATUSES],
        },
      }
    }
  }

  const rows = await listExecutions({
    agencyId,
    agentId: null,
    agentIds,
    status,
    kind,
    channelConnectionId,
    campaignId,
    subjectType: propertyId ? 'property' : null,
    subjectId: propertyId,
    from,
    to,
  })

  const sorted = [...rows].sort((a, b) => {
    const aAt = a.scheduled_at ? Date.parse(a.scheduled_at) : Number.POSITIVE_INFINITY
    const bAt = b.scheduled_at ? Date.parse(b.scheduled_at) : Number.POSITIVE_INFINITY
    if (aAt !== bAt) return aAt - bAt
    return String(a.id).localeCompare(String(b.id))
  })

  const capped = sorted.slice(0, Math.max(1, Math.min(Number(limit) || 2000, 5000)))
  const executions = capped.map(serializeExecution)

  return {
    executions,
    total: sorted.length,
    truncated: sorted.length > capped.length,
    filters: {
      from,
      to,
      status,
      kind,
      campaign_id: campaignId,
      property_id: propertyId,
      agent_id: agentId,
      channel_connection_id: channelConnectionId,
      office,
    },
    meta: {
      unsupported_filters: unsupportedFilters,
      reschedulable_statuses: [...RESCHEDULABLE_STATUSES],
    },
  }
}

function serializeExecution(row) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    scheduled_at: row.scheduled_at,
    recurrence: row.recurrence,
    campaign_id: row.campaign_id,
    agent_id: row.agent_id,
    agency_id: row.agency_id,
    channel_connection_id: row.channel_connection_id,
    creative_id: row.creative_id,
    audience_id: row.audience_id,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    provider_ref: row.provider_ref,
    published_at: row.published_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    reschedulable: isReschedulable(row.status),
    data: row.data || {},
  }
}

/**
 * Reschedule via canonical scheduleExecution (blocks published/processing/…).
 */
export async function rescheduleCalendarExecution(
  executionId,
  scheduledAt,
  { agencyId = null, agentId = null, recurrence = null } = {},
) {
  const existing = await getExecution(executionId, { agencyId, agentId })
  if (!existing) {
    throw Object.assign(new Error(`execution not found: ${executionId}`), {
      code: 'EXECUTION_NOT_FOUND',
    })
  }
  if (agencyId != null && existing.agency_id !== agencyId) {
    throw Object.assign(new Error(`execution not found: ${executionId}`), {
      code: 'EXECUTION_NOT_FOUND',
    })
  }
  if (!isReschedulable(existing.status)) {
    throw Object.assign(
      new Error(`Cannot reschedule execution from status ${existing.status}`),
      { code: 'INVALID_EXECUTION_TRANSITION' },
    )
  }

  const updated = await scheduleExecution(executionId, scheduledAt, {
    recurrence,
    agencyId: agencyId ?? existing.agency_id,
    agentId: agentId ?? existing.agent_id,
  })
  return serializeExecution(updated)
}

/**
 * Bulk cancel draft executions only (destructive — caller confirms in UI).
 */
export async function cancelDraftExecutions(
  executionIds,
  { agencyId = null, agentId = null } = {},
) {
  if (!Array.isArray(executionIds) || executionIds.length === 0) {
    throw Object.assign(new Error('executionIds required'), { code: 'MISSING_EXECUTION_IDS' })
  }
  const results = []
  for (const id of executionIds) {
    try {
      const existing = await getExecution(id, { agencyId, agentId })
      if (!existing || (agencyId != null && existing.agency_id !== agencyId)) {
        results.push({ id, ok: false, code: 'EXECUTION_NOT_FOUND' })
        continue
      }
      if (existing.status !== 'draft' && existing.status !== 'scheduled') {
        results.push({ id, ok: false, code: 'NOT_CANCELLABLE', status: existing.status })
        continue
      }
      const updated = await transitionExecution(id, 'cancelled', {
        agencyId: agencyId ?? existing.agency_id,
        agentId: agentId ?? existing.agent_id,
      })
      results.push({ id, ok: true, execution: serializeExecution(updated) })
    } catch (err) {
      results.push({ id, ok: false, code: err.code || 'CANCEL_FAILED', message: err.message })
    }
  }
  return { results }
}

/**
 * Bulk reschedule draft/scheduled executions to a shared scheduled_at.
 */
export async function bulkRescheduleExecutions(
  executionIds,
  scheduledAt,
  { agencyId = null, agentId = null, recurrence = null } = {},
) {
  if (!Array.isArray(executionIds) || executionIds.length === 0) {
    throw Object.assign(new Error('executionIds required'), { code: 'MISSING_EXECUTION_IDS' })
  }
  if (!scheduledAt) {
    throw Object.assign(new Error('scheduledAt is required'), { code: 'MISSING_SCHEDULED_AT' })
  }
  const results = []
  for (const id of executionIds) {
    try {
      const execution = await rescheduleCalendarExecution(id, scheduledAt, {
        agencyId,
        agentId,
        recurrence,
      })
      results.push({ id, ok: true, execution })
    } catch (err) {
      results.push({ id, ok: false, code: err.code || 'RESCHEDULE_FAILED', message: err.message })
    }
  }
  return { results }
}

/** Optional helper for tests — look up a single agent office attribute. */
export async function getAgentOfficeAttr(agentId) {
  const agent = await findOne('agents', (row) => row.id === agentId)
  if (!agent) return null
  const data = agent.data && typeof agent.data === 'object' ? agent.data : {}
  return data.office_id ?? data.office ?? agent.office_address ?? data.office_address ?? null
}
