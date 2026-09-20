/**
 * Audience CRUD — all access via withTenant.
 */

import { randomUUID } from 'node:crypto'
import { findAll, findOne, insert, query, update } from '../../persistence/index.js'
import { withTenant } from '../../lib/growth-os/with-tenant.js'
import {
  AUDIENCE_TYPES,
  INCLUSION_VALUES,
  MEMBER_SOURCES,
  MEMBERSHIP_STATES,
} from './constants.js'
import { parseAudienceRules } from './rules-engine.js'

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

function assertAudienceType(type) {
  if (!AUDIENCE_TYPES.has(type)) {
    throw Object.assign(new Error(`Invalid audience.type: ${type}`), { code: 'INVALID_AUDIENCE_TYPE' })
  }
}

function assertMemberSource(memberSource) {
  if (!MEMBER_SOURCES.has(memberSource)) {
    throw Object.assign(new Error(`Invalid audience.member_source: ${memberSource}`), {
      code: 'INVALID_MEMBER_SOURCE',
    })
  }
}

function assertMembershipState(state) {
  if (!MEMBERSHIP_STATES.has(state)) {
    throw Object.assign(new Error(`Invalid membership.state: ${state}`), {
      code: 'INVALID_MEMBERSHIP_STATE',
    })
  }
}

function assertInclusion(inclusion) {
  if (!INCLUSION_VALUES.has(inclusion)) {
    throw Object.assign(new Error(`Invalid membership.inclusion: ${inclusion}`), {
      code: 'INVALID_INCLUSION',
    })
  }
}

function serializeAudience(row) {
  if (!row) return null
  const rules = parseAudienceRules(row.rules)
  return {
    id: row.id,
    agency_id: row.agency_id,
    agent_id: row.agent_id,
    name: row.name,
    type: row.type,
    rules: row.rules,
    tags_filter: rules.tags_filter,
    audience_rules: rules.audience_rules,
    static_contact_ids: rules.static_contact_ids,
    member_source: row.member_source,
    estimated_size: row.estimated_size,
    created_at: row.created_at,
    updated_at: row.updated_at,
    data: row.data ?? {},
  }
}

export async function createAudience({
  name,
  type = 'dynamic',
  rules = {},
  memberSource = 'crm',
  estimatedSize = null,
  agencyId = null,
  agentId = null,
  id = null,
  data = {},
} = {}) {
  if (!name?.trim()) {
    throw Object.assign(new Error('Audience name is required'), { code: 'MISSING_AUDIENCE_NAME' })
  }
  assertAudienceType(type)
  assertMemberSource(memberSource)

  const normalizedRules = type === 'static'
    ? {
        ...parseAudienceRules(rules),
        static_contact_ids: parseAudienceRules(rules).static_contact_ids,
      }
    : parseAudienceRules(rules)

  return withTenant(agencyId, agentId, async () => {
    const row = await insert('audiences', {
      id: id || prefixedId('aud_'),
      agency_id: agencyId,
      agent_id: agentId,
      name: name.trim(),
      type,
      rules: normalizedRules,
      member_source: memberSource,
      estimated_size: estimatedSize,
      data,
    })
    return serializeAudience(row)
  })
}

export async function getAudience(id, { agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    const row = await findOne('audiences', (a) => a.id === id)
    return serializeAudience(row)
  })
}

export async function listAudiences({ agencyId = null, agentId = null, type = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    let rows = await findAll('audiences')
    if (type) rows = rows.filter((a) => a.type === type)
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return rows.map(serializeAudience)
  })
}

export async function updateAudience(id, patch, { agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    const existing = await findOne('audiences', (a) => a.id === id)
    if (!existing) return null

    const next = { ...existing, updated_at: new Date().toISOString() }
    if (patch.name !== undefined) next.name = String(patch.name).trim()
    if (patch.type !== undefined) {
      assertAudienceType(patch.type)
      next.type = patch.type
    }
    if (patch.rules !== undefined) next.rules = parseAudienceRules(patch.rules)
    if (patch.member_source !== undefined) {
      assertMemberSource(patch.member_source)
      next.member_source = patch.member_source
    }
    if (patch.estimated_size !== undefined) next.estimated_size = patch.estimated_size
    if (patch.data !== undefined) next.data = { ...(existing.data || {}), ...patch.data }

    await update('audiences', (a) => a.id === id, () => next)
    return serializeAudience(await findOne('audiences', (a) => a.id === id))
  })
}

export async function deleteAudience(id, { agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    const existing = await findOne('audiences', (a) => a.id === id)
    if (!existing) return false
    await query('DELETE FROM public.audience_memberships WHERE audience_id = $1', [id])
    const result = await query('DELETE FROM public.audiences WHERE id = $1', [id])
    const count = result?.rowCount ?? result?.length ?? 0
    return count > 0
  })
}

export async function upsertMembership({
  audienceId,
  contactId,
  state,
  inclusion = 'include',
  qualifiedAt = null,
  expiresAt = null,
  agencyId = null,
  agentId = null,
  data = {},
} = {}) {
  assertMembershipState(state)
  assertInclusion(inclusion)

  return withTenant(agencyId, agentId, async () => {
    const existing = await findOne(
      'audience_memberships',
      (m) => m.audience_id === audienceId && m.contact_id === contactId,
    )
    const now = new Date().toISOString()
    const payload = {
      audience_id: audienceId,
      contact_id: contactId,
      state,
      inclusion,
      qualified_at: qualifiedAt || now,
      expires_at: expiresAt,
      agency_id: agencyId,
      agent_id: agentId,
      updated_at: now,
      data,
    }

    if (existing) {
      await update('audience_memberships', (m) => m.id === existing.id, () => ({
        ...existing,
        ...payload,
      }))
      return findOne('audience_memberships', (m) => m.id === existing.id)
    }

    return insert('audience_memberships', {
      id: prefixedId('amsh_'),
      ...payload,
      created_at: now,
    })
  })
}

export async function listMemberships(audienceId, { agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () =>
    findAll('audience_memberships', (m) => m.audience_id === audienceId),
  )
}

export { serializeAudience }
