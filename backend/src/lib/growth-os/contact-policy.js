/**
 * Growth-OS Wave 2E — ContactPolicy access layer.
 * Enforces frequency caps, quiet hours, and do-not-contact windows.
 */

import { randomUUID } from 'node:crypto'
import { findAll, findOne, insert, query, update } from '../../persistence/index.js'
import { withTenant } from './with-tenant.js'

const CONTACT_POLICY_SCOPES = new Set(['agency', 'agent'])

const DELIVERY_EVENT_NAMES = new Set(['message.submitted', 'message.delivered'])

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

function assertScope(scope) {
  if (!CONTACT_POLICY_SCOPES.has(scope)) {
    throw Object.assign(new Error(`Invalid contact_policy.scope: ${scope}`), {
      code: 'INVALID_CONTACT_POLICY_SCOPE',
    })
  }
}

function normalizeRules(rules = {}) {
  return {
    frequency_caps: Array.isArray(rules.frequency_caps) ? rules.frequency_caps : [],
    quiet_hours: rules.quiet_hours && typeof rules.quiet_hours === 'object'
      ? rules.quiet_hours
      : null,
    do_not_contact_windows: Array.isArray(rules.do_not_contact_windows)
      ? rules.do_not_contact_windows
      : [],
    campaign_priority: Array.isArray(rules.campaign_priority) ? rules.campaign_priority : [],
    negotiation_suppression: Boolean(rules.negotiation_suppression),
  }
}

/**
 * Resolve the effective policy for a tenant: agent-scoped wins over agency-scoped.
 */
export async function resolveContactPolicy({ agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    if (agentId) {
      const agentPolicy = await findOne(
        'contact_policies',
        (row) => row.scope === 'agent' && row.agent_id === agentId,
      )
      if (agentPolicy) return agentPolicy
    }
    if (agencyId) {
      const agencyPolicy = await findOne(
        'contact_policies',
        (row) => row.scope === 'agency' && row.agency_id === agencyId,
      )
      if (agencyPolicy) return agencyPolicy
    }
    const rows = await findAll('contact_policies')
    return (Array.isArray(rows) ? rows : [])[0] || null
  })
}

export async function getContactPolicy(id, { agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, () => findOne('contact_policies', (row) => row.id === id))
}

export async function listContactPolicies({ agencyId = null, agentId = null, scope = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    let rows = await findAll('contact_policies')
    if (scope) rows = rows.filter((row) => row.scope === scope)
    rows.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    return rows
  })
}

export async function upsertContactPolicy({
  id = null,
  scope = 'agency',
  name = 'Default contact policy',
  rules = {},
  agencyId = null,
  agentId = null,
  data = {},
} = {}) {
  assertScope(scope)
  if (scope === 'agency' && !agencyId) {
    throw Object.assign(new Error('agencyId is required for agency-scoped ContactPolicy'), {
      code: 'MISSING_AGENCY_ID',
    })
  }
  if (scope === 'agent' && !agentId) {
    throw Object.assign(new Error('agentId is required for agent-scoped ContactPolicy'), {
      code: 'MISSING_AGENT_ID',
    })
  }

  const normalized = normalizeRules(rules)

  return withTenant(agencyId, agentId, async () => {
    let existing = null
    if (id) {
      existing = await findOne('contact_policies', (row) => row.id === id)
    } else if (scope === 'agency') {
      existing = await findOne(
        'contact_policies',
        (row) => row.scope === 'agency' && row.agency_id === agencyId,
      )
    } else {
      existing = await findOne(
        'contact_policies',
        (row) => row.scope === 'agent' && row.agent_id === agentId,
      )
    }

    if (existing) {
      const next = {
        ...existing,
        name: name?.trim() || existing.name,
        rules: normalized,
        data: { ...(existing.data || {}), ...data },
        updated_at: new Date().toISOString(),
      }
      await update('contact_policies', (row) => row.id === existing.id, () => next)
      return findOne('contact_policies', (row) => row.id === existing.id)
    }

    return insert('contact_policies', {
      id: id || prefixedId('cpl_'),
      agency_id: agencyId,
      agent_id: agentId,
      scope,
      name: name?.trim() || 'Default contact policy',
      rules: normalized,
      data,
    })
  })
}

function parseHm(hm) {
  const [h, m] = String(hm || '00:00').split(':').map((v) => Number(v))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/**
 * Quiet hours: true when `now` falls inside a configured quiet window.
 * Windows may wrap midnight (e.g. 22:00–08:00).
 */
export function isInQuietHours(quietHours, now = new Date()) {
  if (!quietHours?.windows?.length) return false
  const tz = quietHours.timezone || 'UTC'
  let local
  try {
    local = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  } catch {
    local = new Date(now)
  }
  const day = local.getDay()
  const minutes = local.getHours() * 60 + local.getMinutes()

  for (const window of quietHours.windows) {
    const days = Array.isArray(window.days) && window.days.length
      ? window.days.map(Number)
      : [0, 1, 2, 3, 4, 5, 6]
    if (!days.includes(day)) continue
    const start = parseHm(window.start)
    const end = parseHm(window.end)
    if (start === end) continue
    if (start < end) {
      if (minutes >= start && minutes < end) return true
    } else if (minutes >= start || minutes < end) {
      return true
    }
  }
  return false
}

export function isInDoNotContactWindow(windows, { channel, now = new Date() } = {}) {
  if (!Array.isArray(windows) || !windows.length) return false
  const ts = now.getTime()
  const normalizedChannel = String(channel || '').toLowerCase()
  for (const window of windows) {
    const start = window.start ? new Date(window.start).getTime() : null
    const end = window.end ? new Date(window.end).getTime() : null
    if (start != null && Number.isFinite(start) && ts < start) continue
    if (end != null && Number.isFinite(end) && ts >= end) continue
    const channels = Array.isArray(window.channels) ? window.channels.map((c) => String(c).toLowerCase()) : null
    if (channels?.length && !channels.includes(normalizedChannel)) continue
    return true
  }
  return false
}

function eventChannel(row) {
  return String(
    row?.context?.channel
    || row?.data?.channel
    || row?.context?.target_channel
    || '',
  ).toLowerCase()
}

function executionChannel(row) {
  return String(row?.data?.channel || row?.channel || '').toLowerCase()
}

async function countRecentSends({
  contactId,
  channel,
  purpose,
  windowHours,
  agencyId,
  agentId,
  now,
}) {
  const since = new Date(now.getTime() - Math.max(0, Number(windowHours) || 0) * 60 * 60 * 1000)
  const normalizedChannel = String(channel || '').toLowerCase()
  const normalizedPurpose = purpose ? String(purpose).toLowerCase() : null

  const eventRows = await query(
    `SELECT id, event_name, occurred_at, context, data, execution_id
     FROM public.events
     WHERE contact_id = $1
       AND event_name = ANY($2::text[])
       AND occurred_at >= $3
       AND ($4::text IS NULL OR agency_id = $4)
       AND ($5::text IS NULL OR agent_id = $5)`,
    [contactId, [...DELIVERY_EVENT_NAMES], since.toISOString(), agencyId, agentId],
  )
  const events = Array.isArray(eventRows) ? eventRows : eventRows?.rows || []
  let count = 0
  const linkedExecutionIds = new Set()

  for (const row of events) {
    const ch = eventChannel(row)
    if (ch && ch !== normalizedChannel) continue
    const rowPurpose = String(row?.context?.purpose || row?.data?.purpose || '').toLowerCase()
    if (normalizedPurpose && rowPurpose && rowPurpose !== normalizedPurpose) continue
    count++
    if (row.execution_id) linkedExecutionIds.add(row.execution_id)
  }

  const execRows = await query(
    `SELECT id, created_at, published_at, status, data, subject_id
     FROM public.executions
     WHERE kind = 'message'
       AND subject_type = 'contact'
       AND subject_id = $1
       AND status IN ('queued', 'processing', 'published', 'draft')
       AND COALESCE(published_at, created_at) >= $2
       AND ($3::text IS NULL OR agency_id = $3)
       AND ($4::text IS NULL OR agent_id = $4)`,
    [contactId, since.toISOString(), agencyId, agentId],
  )
  const executions = Array.isArray(execRows) ? execRows : execRows?.rows || []
  for (const row of executions) {
    if (linkedExecutionIds.has(row.id)) continue
    const ch = executionChannel(row)
    if (ch && ch !== normalizedChannel) continue
    const rowPurpose = String(row?.data?.purpose || '').toLowerCase()
    if (normalizedPurpose && rowPurpose && rowPurpose !== normalizedPurpose) continue
    count++
  }

  return count
}

/**
 * Implement Wave 0 frequency-cap hook.
 * @returns {{ capped: boolean, reason?: string, detail?: object }}
 */
export async function checkFrequencyCap({
  contactId,
  channel,
  purpose,
  agencyId = null,
  agentId = null,
  now: nowInput = null,
} = {}) {
  if (!contactId || !channel) {
    return { capped: false }
  }

  const now = nowInput ? new Date(nowInput) : new Date()
  const normalizedChannel = String(channel).toLowerCase()

  return withTenant(agencyId, agentId, async () => {
    const policy = await resolveContactPolicy({ agencyId, agentId })
    if (!policy) return { capped: false }

    const rules = normalizeRules(policy.rules || {})

    if (isInDoNotContactWindow(rules.do_not_contact_windows, { channel: normalizedChannel, now })) {
      return {
        capped: true,
        reason: 'do_not_contact_window',
        detail: { policy_id: policy.id },
      }
    }

    if (isInQuietHours(rules.quiet_hours, now)) {
      return {
        capped: true,
        reason: 'quiet_hours',
        detail: { policy_id: policy.id },
      }
    }

    for (const cap of rules.frequency_caps) {
      const capChannel = String(cap.channel || '').toLowerCase()
      if (capChannel && capChannel !== normalizedChannel) continue
      const capPurpose = cap.purpose ? String(cap.purpose).toLowerCase() : null
      if (capPurpose && purpose && capPurpose !== String(purpose).toLowerCase()) continue

      const maxSends = Number(cap.max_sends)
      const windowHours = Number(cap.window_hours)
      if (!Number.isFinite(maxSends) || maxSends < 0) continue
      if (!Number.isFinite(windowHours) || windowHours <= 0) continue

      const recent = await countRecentSends({
        contactId,
        channel: normalizedChannel,
        purpose: capPurpose || purpose,
        windowHours,
        agencyId,
        agentId,
        now,
      })

      if (recent >= maxSends) {
        return {
          capped: true,
          reason: 'frequency_cap',
          detail: {
            policy_id: policy.id,
            max_sends: maxSends,
            window_hours: windowHours,
            recent_sends: recent,
            channel: normalizedChannel,
            purpose: capPurpose || purpose,
          },
        }
      }
    }

    return { capped: false, detail: { policy_id: policy.id } }
  })
}

export {
  CONTACT_POLICY_SCOPES,
  normalizeRules,
}
