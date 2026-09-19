import { v4 as uuidv4 } from 'uuid'
import { findAll, findOne, insert, remove, update } from '../../db.js'
import { agencyTenantId } from '../../tenant-authorization.js'

export const ROUTING_TRIGGERS = ['inquiry', 'comment', 'whatsapp_message']
export const ROUTING_STRATEGIES = ['round_robin', 'first_response', 'least_loaded', 'weighted', 'manual']
export const CONDITION_FIELDS = ['source', 'area', 'property_type', 'language', 'time_of_day']
export const CONDITION_OPS = ['eq', 'contains', 'gte', 'lte']

const conditionSchema = {
  field: (v) => CONDITION_FIELDS.includes(v),
  op: (v) => CONDITION_OPS.includes(v),
  value: (v) => v != null && String(v).trim().length > 0,
}

function normalizeFilters(raw) {
  const match = raw?.match === 'any' ? 'any' : 'all'
  const conditions = Array.isArray(raw?.conditions)
    ? raw.conditions.filter((row) => conditionSchema.field(row?.field) && conditionSchema.op(row?.op) && conditionSchema.value(row?.value))
    : []
  return { match, conditions }
}

function serializePolicy(row) {
  const filters = typeof row.filters === 'string' ? JSON.parse(row.filters || '{}') : (row.filters || {})
  const strategyConfig = typeof row.strategy_config === 'string'
    ? JSON.parse(row.strategy_config || '{}')
    : (row.strategy_config || {})
  const eligibleMembers = typeof row.eligible_members === 'string'
    ? JSON.parse(row.eligible_members || '{}')
    : (row.eligible_members || {})

  return {
    id: row.id,
    agency_id: String(row.tenant_id || '').startsWith('agency:')
      ? String(row.tenant_id).slice('agency:'.length)
      : null,
    name: row.name,
    priority: row.priority,
    trigger: row.trigger || 'inquiry',
    enabled: row.enabled !== false,
    strategy: row.strategy,
    relationship_priority: row.relationship_priority !== false,
    filters: normalizeFilters(filters),
    target: {
      strategy: row.strategy,
      assign_to_agent_id: strategyConfig.assign_to_agent_id || null,
      round_robin_group_id: strategyConfig.round_robin_group_id || null,
      language: strategyConfig.language || null,
    },
    eligible_members: eligibleMembers,
    strategy_config: strategyConfig,
    claim_timeout_seconds: row.claim_timeout_seconds,
    response_timeout_seconds: row.response_timeout_seconds,
    max_attempts: row.max_attempts,
    cooldown_seconds: row.cooldown_seconds,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listAgencyRoutingRules(agencyId) {
  const tenantId = agencyTenantId(agencyId)
  const rows = await findAll('tenant_lead_routing_policies', (row) => row.tenant_id === tenantId)
  return rows
    .map(serializePolicy)
    .sort((a, b) => (a.priority || 100) - (b.priority || 100))
}

export async function getAgencyRoutingRule(agencyId, ruleId) {
  const tenantId = agencyTenantId(agencyId)
  const row = await findOne(
    'tenant_lead_routing_policies',
    (item) => item.id === ruleId && item.tenant_id === tenantId,
  )
  return row ? serializePolicy(row) : null
}

export async function createAgencyRoutingRule(agencyId, userId, payload) {
  const tenantId = agencyTenantId(agencyId)
  const now = new Date().toISOString()
  const strategyConfig = {
    ...(payload.strategy_config || {}),
    assign_to_agent_id: payload.target?.assign_to_agent_id || null,
    round_robin_group_id: payload.target?.round_robin_group_id || null,
    language: payload.target?.language || null,
  }

  const row = {
    id: uuidv4(),
    tenant_id: tenantId,
    name: payload.name,
    priority: Number(payload.priority) || 100,
    trigger: ROUTING_TRIGGERS.includes(payload.trigger) ? payload.trigger : 'inquiry',
    strategy: ROUTING_STRATEGIES.includes(payload.strategy) ? payload.strategy : 'round_robin',
    relationship_priority: payload.relationship_priority !== false,
    filters: normalizeFilters(payload.filters),
    eligible_members: payload.eligible_members || {},
    strategy_config: strategyConfig,
    claim_timeout_seconds: payload.claim_timeout_seconds ?? null,
    response_timeout_seconds: payload.response_timeout_seconds ?? null,
    max_attempts: Number(payload.max_attempts) || 3,
    cooldown_seconds: Number(payload.cooldown_seconds) || 300,
    escalation_membership_id: payload.escalation_membership_id || null,
    enabled: payload.enabled !== false,
    created_by: userId,
    created_at: now,
    updated_at: now,
  }

  await insert('tenant_lead_routing_policies', row)
  return serializePolicy(row)
}

export async function updateAgencyRoutingRule(agencyId, ruleId, payload) {
  const existing = await getAgencyRoutingRule(agencyId, ruleId)
  if (!existing) return null

  const tenantId = agencyTenantId(agencyId)
  const strategyConfig = {
    ...existing.strategy_config,
    ...(payload.strategy_config || {}),
    assign_to_agent_id: payload.target?.assign_to_agent_id ?? existing.target.assign_to_agent_id,
    round_robin_group_id: payload.target?.round_robin_group_id ?? existing.target.round_robin_group_id,
    language: payload.target?.language ?? existing.target.language,
  }

  const next = {
    name: payload.name ?? existing.name,
    priority: payload.priority != null ? Number(payload.priority) : existing.priority,
    trigger: payload.trigger && ROUTING_TRIGGERS.includes(payload.trigger) ? payload.trigger : existing.trigger,
    strategy: payload.strategy && ROUTING_STRATEGIES.includes(payload.strategy) ? payload.strategy : existing.strategy,
    relationship_priority: payload.relationship_priority != null ? payload.relationship_priority !== false : existing.relationship_priority,
    filters: payload.filters ? normalizeFilters(payload.filters) : existing.filters,
    eligible_members: payload.eligible_members ?? existing.eligible_members,
    strategy_config: strategyConfig,
    claim_timeout_seconds: payload.claim_timeout_seconds ?? existing.claim_timeout_seconds,
    response_timeout_seconds: payload.response_timeout_seconds ?? existing.response_timeout_seconds,
    max_attempts: payload.max_attempts != null ? Number(payload.max_attempts) : existing.max_attempts,
    cooldown_seconds: payload.cooldown_seconds != null ? Number(payload.cooldown_seconds) : existing.cooldown_seconds,
    escalation_membership_id: payload.escalation_membership_id ?? existing.escalation_membership_id,
    enabled: payload.enabled != null ? payload.enabled !== false : existing.enabled,
    updated_at: new Date().toISOString(),
  }

  await update(
    'tenant_lead_routing_policies',
    (row) => row.id === ruleId && row.tenant_id === tenantId,
    (row) => ({ ...row, ...next }),
  )
  return getAgencyRoutingRule(agencyId, ruleId)
}

export async function deleteAgencyRoutingRule(agencyId, ruleId) {
  const tenantId = agencyTenantId(agencyId)
  const existing = await findOne(
    'tenant_lead_routing_policies',
    (row) => row.id === ruleId && row.tenant_id === tenantId,
  )
  if (!existing) return false
  await remove('tenant_lead_routing_policies', (row) => row.id === ruleId && row.tenant_id === tenantId)
  return true
}

export default {
  listAgencyRoutingRules,
  getAgencyRoutingRule,
  createAgencyRoutingRule,
  updateAgencyRoutingRule,
  deleteAgencyRoutingRule,
}
