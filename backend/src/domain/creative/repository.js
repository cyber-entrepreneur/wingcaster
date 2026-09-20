/**
 * Creative domain persistence — all access via withTenant.
 */

import { randomUUID } from 'node:crypto'
import { findAll, findOne, insert, update } from '../../persistence/index.js'
import { withTenant } from '../../lib/growth-os/index.js'

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

function tenantIds({ agencyId, agentId }) {
  return { agency_id: agencyId, agent_id: agentId }
}

export async function createCreative({
  agencyId,
  agentId,
  subjectType = 'listing',
  subjectId,
  source = 'manual',
  approvalState = 'not_required',
  status = 'draft',
  channelKeys = [],
  data = {},
}) {
  const now = new Date().toISOString()
  const row = {
    id: prefixedId('cre_'),
    ...tenantIds({ agencyId, agentId }),
    subject_type: subjectType,
    subject_id: subjectId,
    source,
    approval_state: approvalState,
    status,
    channel_keys: channelKeys,
    created_at: now,
    updated_at: now,
    data,
  }
  return withTenant(agencyId, agentId, () => insert('creatives', row))
}

export async function getCreative(id, { agencyId, agentId }) {
  return withTenant(agencyId, agentId, () =>
    findOne('creatives', (r) => r.id === id),
  )
}

export async function listCreativesForSubject(subjectType, subjectId, { agencyId, agentId }) {
  return withTenant(agencyId, agentId, () =>
    findAll('creatives', (r) => r.subject_type === subjectType && r.subject_id === subjectId),
  )
}

export async function updateCreative(id, patch, { agencyId, agentId }) {
  const existing = await getCreative(id, { agencyId, agentId })
  if (!existing) return null
  const merged = { ...existing, ...patch, updated_at: new Date().toISOString() }
  return withTenant(agencyId, agentId, () =>
    update('creatives', (r) => r.id === id, () => merged),
  )
}

export async function createVariant({
  agencyId,
  agentId,
  creativeId,
  label,
  copy = {},
  experimentId = null,
  sortOrder = 0,
  data = {},
}) {
  const now = new Date().toISOString()
  const row = {
    id: prefixedId('crv_'),
    ...tenantIds({ agencyId, agentId }),
    creative_id: creativeId,
    label,
    copy,
    experiment_id: experimentId,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
    data,
  }
  return withTenant(agencyId, agentId, () => insert('creative_variants', row))
}

export async function getVariant(id, { agencyId, agentId }) {
  return withTenant(agencyId, agentId, () =>
    findOne('creative_variants', (r) => r.id === id),
  )
}

export async function listVariantsForCreative(creativeId, { agencyId, agentId }) {
  const rows = await withTenant(agencyId, agentId, () =>
    findAll('creative_variants', (r) => r.creative_id === creativeId),
  )
  return rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
}

export async function updateVariant(id, patch, { agencyId, agentId }) {
  const existing = await getVariant(id, { agencyId, agentId })
  if (!existing) return null
  const merged = { ...existing, ...patch, updated_at: new Date().toISOString() }
  return withTenant(agencyId, agentId, () =>
    update('creative_variants', (r) => r.id === id, () => merged),
  )
}

export async function createRendition({
  agencyId,
  agentId,
  creativeVariantId,
  channelKey,
  width,
  height,
  provider = 'local',
  assetUrl = null,
  status = 'ready',
  data = {},
}) {
  const now = new Date().toISOString()
  const row = {
    id: prefixedId('rnd_'),
    ...tenantIds({ agencyId, agentId }),
    creative_variant_id: creativeVariantId,
    channel_key: channelKey,
    width,
    height,
    provider,
    asset_url: assetUrl,
    status,
    created_at: now,
    updated_at: now,
    data,
  }
  return withTenant(agencyId, agentId, () => insert('creative_renditions', row))
}

export async function listRenditionsForVariant(variantId, { agencyId, agentId }) {
  return withTenant(agencyId, agentId, () =>
    findAll('creative_renditions', (r) => r.creative_variant_id === variantId),
  )
}

export async function createApprovalRequest({
  agencyId,
  agentId,
  subjectType,
  subjectId,
  subjectVersion = 1,
  requestedBy,
  state = 'pending',
  reviewers = [],
  decisionHistory = [],
  data = {},
}) {
  const now = new Date().toISOString()
  const row = {
    id: prefixedId('apr_'),
    ...tenantIds({ agencyId, agentId }),
    subject_type: subjectType,
    subject_id: subjectId,
    subject_version: subjectVersion,
    requested_by: requestedBy,
    state,
    reviewers,
    decision_history: decisionHistory,
    created_at: now,
    updated_at: now,
    data,
  }
  return withTenant(agencyId, agentId, () => insert('approval_requests', row))
}

export async function getApprovalRequestForSubject(subjectType, subjectId, { agencyId, agentId }) {
  const rows = await withTenant(agencyId, agentId, () =>
    findAll('approval_requests', (r) => r.subject_type === subjectType && r.subject_id === subjectId),
  )
  return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null
}

export async function updateApprovalRequest(id, patch, { agencyId, agentId }) {
  const existing = await withTenant(agencyId, agentId, () =>
    findOne('approval_requests', (r) => r.id === id),
  )
  if (!existing) return null
  const merged = { ...existing, ...patch, updated_at: new Date().toISOString() }
  return withTenant(agencyId, agentId, () =>
    update('approval_requests', (r) => r.id === id, () => merged),
  )
}

export async function loadCreativeBundle(creativeId, { agencyId, agentId }) {
  const creative = await getCreative(creativeId, { agencyId, agentId })
  if (!creative) return null
  const variants = await listVariantsForCreative(creativeId, { agencyId, agentId })
  const variantsWithRenditions = []
  for (const variant of variants) {
    const renditions = await listRenditionsForVariant(variant.id, { agencyId, agentId })
    variantsWithRenditions.push({ ...variant, renditions })
  }
  const approval = await getApprovalRequestForSubject('creative', creativeId, { agencyId, agentId })
  return { creative, variants: variantsWithRenditions, approval_request: approval }
}
