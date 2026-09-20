/**
 * Wave 2D — Experiment CRUD under withTenant.
 */

import { randomUUID } from 'node:crypto'
import { findAll, findOne, insert, update } from '../../persistence/index.js'
import { withTenant } from '../../lib/growth-os/index.js'
import {
  EXPERIMENT_ALLOCATIONS,
  EXPERIMENT_DIMENSIONS,
  EXPERIMENT_STATUSES,
} from './constants.js'

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

function requireTenant({ agencyId, agentId }) {
  if ((agencyId == null || agencyId === '') && (agentId == null || agentId === '')) {
    throw Object.assign(new Error('agencyId or agentId required'), {
      code: 'TENANT_SCOPE_REQUIRED',
    })
  }
}

function normaliseVariants(variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw Object.assign(new Error('variants must be a non-empty array'), {
      code: 'INVALID_VARIANTS',
    })
  }
  return variants.map((v, index) => {
    const key = String(v?.key ?? v?.id ?? v?.name ?? '').trim()
    if (!key) {
      throw Object.assign(new Error(`variant[${index}] requires key`), {
        code: 'INVALID_VARIANTS',
      })
    }
    return {
      key,
      label: v?.label != null ? String(v.label) : key,
      weight: v?.weight != null ? Number(v.weight) : 1,
      next: v?.next ?? null,
      creative_variant_id: v?.creative_variant_id ?? null,
      journey_path: v?.journey_path ?? null,
      is_control: Boolean(v?.is_control),
      payload: v?.payload && typeof v.payload === 'object' ? v.payload : {},
    }
  })
}

function mapExperiment(row) {
  if (!row) return null
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    dimension: row.dimension,
    variants: row.variants,
    allocation: row.allocation,
    holdout_pct: row.holdout_pct != null ? Number(row.holdout_pct) : 0,
    goal_event: row.goal_event,
    status: row.status,
    result: row.result || {},
    agency_id: row.agency_id,
    agent_id: row.agent_id,
    data: row.data || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapAssignment(row) {
  if (!row) return null
  return {
    id: row.id,
    experiment_id: row.experiment_id,
    contact_id: row.contact_id,
    variant: row.variant,
    assigned_at: row.assigned_at,
    assignment_reason: row.assignment_reason,
    model_version: row.model_version,
    agency_id: row.agency_id,
    agent_id: row.agent_id,
    data: row.data || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function createExperiment({
  agencyId = null,
  agentId = null,
  campaignId = null,
  dimension,
  variants,
  allocation = 'even',
  holdoutPct = 0,
  goalEvent,
  status = 'draft',
  data = {},
} = {}) {
  requireTenant({ agencyId, agentId })
  if (!EXPERIMENT_DIMENSIONS.includes(dimension)) {
    throw Object.assign(new Error(`invalid dimension: ${dimension}`), {
      code: 'INVALID_DIMENSION',
    })
  }
  if (!EXPERIMENT_ALLOCATIONS.includes(allocation)) {
    throw Object.assign(new Error(`invalid allocation: ${allocation}`), {
      code: 'INVALID_ALLOCATION',
    })
  }
  if (!EXPERIMENT_STATUSES.includes(status)) {
    throw Object.assign(new Error(`invalid status: ${status}`), {
      code: 'INVALID_STATUS',
    })
  }
  if (!goalEvent || typeof goalEvent !== 'string') {
    throw Object.assign(new Error('goal_event required'), {
      code: 'INVALID_GOAL_EVENT',
    })
  }
  const holdout = Math.max(0, Math.min(100, Number(holdoutPct) || 0))
  const normalised = normaliseVariants(variants)
  const now = new Date().toISOString()

  return withTenant(agencyId, agentId, async () => {
    const row = await insert('experiments', {
      id: prefixedId('exp_'),
      campaign_id: campaignId,
      dimension,
      variants: normalised,
      allocation,
      holdout_pct: holdout,
      goal_event: goalEvent,
      status,
      result: {},
      agency_id: agencyId,
      agent_id: agentId,
      created_at: now,
      updated_at: now,
      data,
    })
    return mapExperiment(row)
  })
}

export async function getExperiment(id, { agencyId = null, agentId = null } = {}) {
  requireTenant({ agencyId, agentId })
  if (!id) return null
  return withTenant(agencyId, agentId, async () => {
    const row = await findOne('experiments', (r) => r.id === id)
    return mapExperiment(row)
  })
}

export async function listExperiments({
  agencyId = null,
  agentId = null,
  campaignId = null,
  status = null,
  dimension = null,
} = {}) {
  requireTenant({ agencyId, agentId })
  return withTenant(agencyId, agentId, async () => {
    const rows = await findAll('experiments', (row) => {
      if (agencyId != null && row.agency_id !== agencyId) return false
      if (agentId != null && row.agent_id !== agentId) return false
      if (campaignId != null && row.campaign_id !== campaignId) return false
      if (status != null && row.status !== status) return false
      if (dimension != null && row.dimension !== dimension) return false
      return true
    })
    return rows.map(mapExperiment)
  })
}

export async function updateExperiment(id, patch, { agencyId = null, agentId = null } = {}) {
  requireTenant({ agencyId, agentId })
  const existing = await getExperiment(id, { agencyId, agentId })
  if (!existing) return null

  const next = { ...existing }
  if (patch.campaignId !== undefined) next.campaign_id = patch.campaignId
  if (patch.dimension !== undefined) {
    if (!EXPERIMENT_DIMENSIONS.includes(patch.dimension)) {
      throw Object.assign(new Error(`invalid dimension: ${patch.dimension}`), {
        code: 'INVALID_DIMENSION',
      })
    }
    next.dimension = patch.dimension
  }
  if (patch.variants !== undefined) next.variants = normaliseVariants(patch.variants)
  if (patch.allocation !== undefined) {
    if (!EXPERIMENT_ALLOCATIONS.includes(patch.allocation)) {
      throw Object.assign(new Error(`invalid allocation: ${patch.allocation}`), {
        code: 'INVALID_ALLOCATION',
      })
    }
    next.allocation = patch.allocation
  }
  if (patch.holdoutPct !== undefined) {
    next.holdout_pct = Math.max(0, Math.min(100, Number(patch.holdoutPct) || 0))
  }
  if (patch.goalEvent !== undefined) next.goal_event = patch.goalEvent
  if (patch.status !== undefined) {
    if (!EXPERIMENT_STATUSES.includes(patch.status)) {
      throw Object.assign(new Error(`invalid status: ${patch.status}`), {
        code: 'INVALID_STATUS',
      })
    }
    next.status = patch.status
  }
  if (patch.result !== undefined) next.result = patch.result
  if (patch.data !== undefined) next.data = { ...(existing.data || {}), ...patch.data }
  next.updated_at = new Date().toISOString()

  return withTenant(agencyId, agentId, async () => {
    await update(
      'experiments',
      (r) => r.id === id,
      () => ({
        ...next,
        holdout_pct: next.holdout_pct,
      }),
    )
    const row = await findOne('experiments', (r) => r.id === id)
    return mapExperiment(row)
  })
}

export async function getAssignment(experimentId, contactId, {
  agencyId = null,
  agentId = null,
} = {}) {
  requireTenant({ agencyId, agentId })
  return withTenant(agencyId, agentId, async () => {
    const row = await findOne(
      'experiment_assignments',
      (r) => r.experiment_id === experimentId && r.contact_id === contactId,
    )
    return mapAssignment(row)
  })
}

export async function listAssignments({
  agencyId = null,
  agentId = null,
  experimentId = null,
  contactId = null,
  variant = null,
} = {}) {
  requireTenant({ agencyId, agentId })
  return withTenant(agencyId, agentId, async () => {
    const rows = await findAll('experiment_assignments', (row) => {
      if (agencyId != null && row.agency_id !== agencyId) return false
      if (agentId != null && row.agent_id !== agentId) return false
      if (experimentId != null && row.experiment_id !== experimentId) return false
      if (contactId != null && row.contact_id !== contactId) return false
      if (variant != null && row.variant !== variant) return false
      return true
    })
    return rows.map(mapAssignment)
  })
}

export async function insertAssignment(row, { agencyId = null, agentId = null } = {}) {
  requireTenant({ agencyId, agentId })
  const now = new Date().toISOString()
  return withTenant(agencyId, agentId, async () => {
    const inserted = await insert('experiment_assignments', {
      id: row.id || prefixedId('exa_'),
      experiment_id: row.experiment_id,
      contact_id: row.contact_id,
      variant: row.variant,
      assigned_at: row.assigned_at || now,
      assignment_reason: row.assignment_reason,
      model_version: row.model_version,
      agency_id: agencyId,
      agent_id: agentId,
      created_at: now,
      updated_at: now,
      data: row.data || {},
    })
    return mapAssignment(inserted)
  })
}

export { mapExperiment, mapAssignment, normaliseVariants, prefixedId }
