/**
 * Capability pack definitions + assignment helpers (BE-BLOCKER-29 / AGN-ROL).
 */

import { createHash, randomUUID } from 'node:crypto'
import { query, transaction } from '../../db.js'
import { agencyTenantId } from '../../tenant-authorization.js'
import { normalizeCapabilityPacks } from '../settings/index-route.js'

export const FINANCE_GRANT_ACTION_KIND = 'CAPABILITY_PACK_FINANCE_GRANT'

const DOMAIN_LABELS = Object.freeze({
  listings: 'Listings',
  crm: 'CRM',
  publishing: 'Publishing',
  analytics: 'Analytics',
  billing: 'Billing',
  settings: 'Settings',
})

const DOMAIN_ORDER = Object.freeze([
  'listings', 'crm', 'publishing', 'analytics', 'billing', 'settings',
])

function asUuidOrNull(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))
    ? String(id)
    : null
}

function parseCapabilities(raw) {
  if (raw == null) return []
  if (typeof raw === 'string') {
    try {
      return parseCapabilities(JSON.parse(raw))
    } catch {
      return []
    }
  }
  if (Array.isArray(raw)) {
    return raw.map((entry) => {
      if (typeof entry === 'string') {
        return {
          key: entry,
          label: entry,
          description: '',
          domain: entry.includes('.') ? entry.split('.')[0] : 'settings',
          is_financial: false,
          enabled: true,
        }
      }
      return {
        key: String(entry.key || ''),
        label: String(entry.label || entry.key || ''),
        description: String(entry.description || ''),
        domain: String(entry.domain || 'settings'),
        is_financial: Boolean(entry.is_financial),
        enabled: entry.enabled !== false,
      }
    }).filter((c) => c.key)
  }
  if (typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => {
      if (typeof value === 'boolean') {
        return {
          key,
          label: key,
          description: '',
          domain: key.includes('.') ? key.split('.')[0] : 'settings',
          is_financial: false,
          enabled: value,
        }
      }
      return {
        key,
        label: String(value?.label || key),
        description: String(value?.description || ''),
        domain: String(value?.domain || (key.includes('.') ? key.split('.')[0] : 'settings')),
        is_financial: Boolean(value?.is_financial),
        enabled: value?.enabled !== false,
      }
    })
  }
  return []
}

export function packHasFinancialCapabilities(pack) {
  if (!pack) return false
  if (pack.slug === 'finance' || pack.id === 'finance') return true
  return parseCapabilities(pack.capabilities).some((cap) => cap.is_financial && cap.enabled !== false)
}

export function capabilitySummary(capabilities, limit = 4) {
  const enabled = parseCapabilities(capabilities).filter((c) => c.enabled !== false)
  return enabled.slice(0, limit).map((c) => ({ key: c.key, label: c.label }))
}

function groupDomains(capabilities) {
  const caps = parseCapabilities(capabilities)
  const byDomain = new Map()
  for (const cap of caps) {
    const domain = DOMAIN_ORDER.includes(cap.domain) ? cap.domain : 'settings'
    if (!byDomain.has(domain)) byDomain.set(domain, [])
    byDomain.get(domain).push({
      key: cap.key,
      label: cap.label,
      description: cap.description,
      is_financial: Boolean(cap.is_financial),
      enabled: cap.enabled !== false,
    })
  }
  return DOMAIN_ORDER
    .filter((key) => byDomain.has(key))
    .map((key) => ({
      key,
      label: DOMAIN_LABELS[key] || key,
      capabilities: byDomain.get(key),
    }))
}

export async function listPackDefinitions() {
  return query(
    `SELECT id, slug, name, description, capabilities, is_seeded, is_custom, editable,
            sort_order, created_at, updated_at, data
       FROM public.capability_pack_definitions
      ORDER BY sort_order ASC, slug ASC`,
  )
}

export async function getPackDefinition(idOrSlug) {
  const key = String(idOrSlug || '').trim()
  if (!key) return null
  const rows = await query(
    `SELECT id, slug, name, description, capabilities, is_seeded, is_custom, editable,
            sort_order, created_at, updated_at, data
       FROM public.capability_pack_definitions
      WHERE id = $1 OR slug = $1
      LIMIT 1`,
    [key],
  )
  return rows[0] || null
}

export async function resolvePackIds(packRefs) {
  const refs = [...new Set((packRefs || []).map((p) => String(p || '').trim()).filter(Boolean))]
  if (!refs.length) return { packs: [], unknown: [] }
  const rows = await query(
    `SELECT id, slug, name, description, capabilities, is_seeded, is_custom, editable, sort_order, data
       FROM public.capability_pack_definitions
      WHERE id = ANY($1::text[]) OR slug = ANY($1::text[])`,
    [refs],
  )
  const byKey = new Map()
  for (const row of rows) {
    byKey.set(row.id, row)
    byKey.set(row.slug, row)
  }
  const packs = []
  const seen = new Set()
  const unknown = []
  for (const ref of refs) {
    const pack = byKey.get(ref)
    if (!pack) {
      unknown.push(ref)
      continue
    }
    if (seen.has(pack.id)) continue
    seen.add(pack.id)
    packs.push(pack)
  }
  return { packs, unknown }
}

export async function countMembersByPack(agencyId) {
  const tenantId = agencyTenantId(agencyId)
  const rows = await query(
    `SELECT pack_id, COUNT(*)::int AS member_count
       FROM public.tenant_memberships tm
       CROSS JOIN LATERAL jsonb_array_elements_text(
         CASE
           WHEN jsonb_typeof(COALESCE(tm.capability_packs, '[]'::jsonb)) = 'array'
           THEN COALESCE(tm.capability_packs, '[]'::jsonb)
           ELSE '[]'::jsonb
         END
       ) AS pack_id
      WHERE tm.tenant_id = $1
        AND tm.status = 'active'
      GROUP BY pack_id`,
    [tenantId],
  )
  return Object.fromEntries(rows.map((r) => [r.pack_id, r.member_count]))
}

export async function countAgencyOwners(agencyId) {
  const tenantId = agencyTenantId(agencyId)
  const rows = await query(
    `SELECT COUNT(*)::int AS owner_count
       FROM public.tenant_memberships
      WHERE tenant_id = $1 AND role = 'owner' AND status = 'active'`,
    [tenantId],
  )
  return rows[0]?.owner_count || 0
}

export async function countAgencyMembers(agencyId) {
  const tenantId = agencyTenantId(agencyId)
  const rows = await query(
    `SELECT COUNT(*)::int AS member_count
       FROM public.tenant_memberships
      WHERE tenant_id = $1 AND status = 'active'`,
    [tenantId],
  )
  return rows[0]?.member_count || 0
}

export async function listMembersPreview(agencyId, packId, { limit = 5 } = {}) {
  const tenantId = agencyTenantId(agencyId)
  const rows = await query(
    `SELECT tm.user_id, u.name AS display_name, u.data->>'avatar_url' AS avatar_url
       FROM public.tenant_memberships tm
       LEFT JOIN public.users u ON u.id = tm.user_id
      WHERE tm.tenant_id = $1
        AND tm.status = 'active'
        AND COALESCE(tm.capability_packs, '[]'::jsonb) ? $2
      ORDER BY tm.joined_at NULLS LAST, tm.user_id
      LIMIT $3`,
    [tenantId, packId, limit],
  )
  return rows.map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name || null,
    avatar_url: r.avatar_url || null,
  }))
}

export function toListPackDto(pack, { memberCount = 0 } = {}) {
  const caps = parseCapabilities(pack.capabilities)
  const enabled = caps.filter((c) => c.enabled !== false)
  const requiresTwoPerson = Boolean(pack.data?.requires_two_person)
    || packHasFinancialCapabilities(pack)
  return {
    id: pack.slug || pack.id,
    kind: pack.is_custom ? 'custom' : 'seeded',
    name: pack.name,
    description: pack.description,
    capability_summary: capabilitySummary(caps, 4),
    capability_total: enabled.length,
    member_count: memberCount,
    requires_two_person: requiresTwoPerson,
    editable: Boolean(pack.editable),
  }
}

export function toDetailPackDto(pack, { memberCount = 0, membersPreview = [] } = {}) {
  return {
    id: pack.slug || pack.id,
    kind: pack.is_custom ? 'custom' : 'seeded',
    name: pack.name,
    description: pack.description,
    editable: Boolean(pack.editable),
    member_count: memberCount,
    members_preview: membersPreview,
    domains: groupDomains(pack.capabilities),
  }
}

export async function getMembershipCapabilityPacks(agencyId, userId) {
  const tenantId = agencyTenantId(agencyId)
  const rows = await query(
    `SELECT id, tenant_id, user_id, role, status, capability_packs, capabilities
       FROM public.tenant_memberships
      WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
      LIMIT 1`,
    [tenantId, userId],
  )
  return rows[0] || null
}

export async function assignCapabilityPacks({
  agencyId,
  targetUserId,
  packRefs,
  actorId,
  auditReason = null,
}) {
  const { packs, unknown } = await resolvePackIds(packRefs)
  if (unknown.length) {
    const err = new Error('UNKNOWN_PACK')
    err.code = 'UNKNOWN_PACK'
    err.unknown_ids = unknown
    throw err
  }

  const membership = await getMembershipCapabilityPacks(agencyId, targetUserId)
  if (!membership) {
    const err = new Error('MEMBER_NOT_FOUND')
    err.code = 'MEMBER_NOT_FOUND'
    throw err
  }

  const nextIds = packs.map((p) => p.slug || p.id)
  const currentIds = normalizeCapabilityPacks(membership.capability_packs)
  const newlyGranted = packs.filter((p) => !currentIds.includes(p.slug) && !currentIds.includes(p.id))
  const financialGrants = newlyGranted.filter((p) => packHasFinancialCapabilities(p))

  if (financialGrants.length) {
    const ownerCount = await countAgencyOwners(agencyId)
    if (ownerCount < 2) {
      const err = new Error('SECOND_OWNER_REQUIRED')
      err.code = 'SECOND_OWNER_REQUIRED'
      err.help_url = '/agency/settings/ownership'
      throw err
    }

    const payload = {
      agency_id: agencyId,
      target_user_id: targetUserId,
      packs: nextIds,
      financial_pack_ids: financialGrants.map((p) => p.slug || p.id),
      requested_by: actorId,
      audit_reason: auditReason,
    }
    const approvalId = await createFinancePackApprovalRequest({ actorId, payload })
    return {
      pending: true,
      approval_request_id: approvalId,
      requires_approvers: 1,
      message: 'Awaiting second owner approval to grant Finance.',
    }
  }

  const updated = await applyCapabilityPackAssignment({
    agencyId,
    targetUserId,
    packIds: nextIds,
  })
  return { pending: false, membership: updated }
}

export async function applyCapabilityPackAssignment({ agencyId, targetUserId, packIds }) {
  const tenantId = agencyTenantId(agencyId)
  const rows = await query(
    `UPDATE public.tenant_memberships
        SET capability_packs = $1::jsonb,
            updated_at = NOW(),
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('capability_packs', $1::jsonb)
      WHERE tenant_id = $2
        AND user_id = $3
        AND status = 'active'
      RETURNING id, tenant_id, user_id, role, status, capability_packs, capabilities, updated_at`,
    [JSON.stringify(packIds), tenantId, targetUserId],
  )
  if (!rows.length) {
    const err = new Error('MEMBER_NOT_FOUND')
    err.code = 'MEMBER_NOT_FOUND'
    throw err
  }
  return rows[0]
}

async function createFinancePackApprovalRequest({ actorId, payload }) {
  const id = randomUUID()
  const actorUuid = asUuidOrNull(actorId)
  const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO fin.approval_requests (
         id, environment, tenant_id, action_kind, status, payload_hash,
         min_distinct_approvers, created_at, created_by_actor_type, created_by_actor_id,
         updated_at, payload
       ) VALUES (
         $1, 'LIVE', NULL, $2, 'REQUESTED', $3,
         1, NOW(), 'USER', $4, NOW(), $5::jsonb
       )`,
      [id, FINANCE_GRANT_ACTION_KIND, payloadHash, actorUuid, JSON.stringify(payload)],
    )
  })
  return id
}

export function membershipHasSettingsAccess(membership) {
  if (!membership) return false
  if (membership.role === 'owner' || membership.role === 'admin') return true
  if (membership.role === 'guest') return false
  return membership.role === 'member'
}
