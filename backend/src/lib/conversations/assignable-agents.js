/**
 * AGT-INB-004 — Assign conversation.
 *
 * Resolves the set of teammates a caller may assign a given conversation to.
 * A conversation can be assigned within the agency footprint it belongs to
 * (derived from its currently-assigned agent), intersected with the caller's
 * own agency memberships. The caller themselves is always assignable
 * ("assign to me"), including the solo-agent case with no agency at all.
 *
 * This mirrors the authorization intent of assertAssignableConversationAgent
 * (lib/authz.js), which the POST /api/conversations/:id/assign route still
 * enforces as the source of truth — this helper only powers the picker.
 */
import { findAll, findOne } from '../../db.js'

async function activeMembershipsFor(principalId) {
  return findAll(
    'agency_members',
    (m) => m.status === 'active' && (m.agent_id === principalId || m.user_id === principalId),
  )
}

async function agencyIdsForPrincipal(principalId) {
  if (!principalId) return new Set()
  const agent = await findOne('agents', (a) => a.id === principalId || a.user_id === principalId)
  const memberships = await activeMembershipsFor(principalId)
  return new Set([agent?.agency_id, ...memberships.map((m) => m.agency_id)].filter(Boolean))
}

function serializeAgent(agent, { isSelf }) {
  return {
    id: agent.id,
    name: agent.name ?? null,
    email: agent.email ?? null,
    role: agent.role ?? null,
    is_self: isSelf,
  }
}

export async function getAssignableAgents(callerId, conversation) {
  const callerAgent = await findOne('agents', (a) => a.id === callerId || a.user_id === callerId)
  const callerAgencyIds = await agencyIdsForPrincipal(callerId)

  const assignedId = conversation?.assigned_agent_id || null
  const conversationAgencyIds = assignedId ? await agencyIdsForPrincipal(assignedId) : new Set()

  // Shared agencies between caller and the conversation. When the conversation
  // has no agency footprint (solo / unassigned), fall back to the caller's own.
  const shared = conversationAgencyIds.size
    ? new Set([...callerAgencyIds].filter((id) => conversationAgencyIds.has(id)))
    : callerAgencyIds

  const candidateIds = new Set()
  if (callerAgent) candidateIds.add(callerAgent.id)
  if (shared.size) {
    const members = await findAll(
      'agency_members',
      (m) => m.status === 'active' && shared.has(m.agency_id),
    )
    for (const m of members) candidateIds.add(m.agent_id || m.user_id)
  }

  const agents = []
  const seen = new Set()
  for (const pid of candidateIds) {
    if (!pid) continue
    const agent = await findOne('agents', (a) => a.id === pid || a.user_id === pid)
    if (!agent || seen.has(agent.id)) continue
    seen.add(agent.id)
    const isSelf = callerAgent ? agent.id === callerAgent.id : false
    agents.push(serializeAgent(agent, { isSelf }))
  }

  // Self first, then alphabetical by display name.
  agents.sort((a, b) => {
    if (a.is_self !== b.is_self) return a.is_self ? -1 : 1
    return String(a.name || '').localeCompare(String(b.name || ''))
  })
  return agents
}

export default { getAssignableAgents }
