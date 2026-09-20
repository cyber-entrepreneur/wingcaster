/**
 * Journey persistence — all access via withTenant.
 */

import { findAll, findOne, insert, update } from '../../persistence/index.js'
import { withTenant } from '../../lib/growth-os/with-tenant.js'
import { prefixedId, stepsToGraph } from './graph.js'

const VALID_STATUSES = new Set(['draft', 'active', 'paused', 'archived'])

export async function createJourney({
  name,
  description = '',
  status = 'draft',
  trigger = 'manual',
  tagsFilter = [],
  targetChannel = 'email',
  audienceRules = [],
  entryAudienceId = null,
  goalEvent = null,
  steps = [],
  graph = null,
  agencyId = null,
  agentId = null,
  createdBy = null,
  legacyCampaignId = null,
}) {
  if (!name?.trim()) throw Object.assign(new Error('Journey name is required'), { code: 'MISSING_NAME' })
  if (!VALID_STATUSES.has(status)) {
    throw Object.assign(new Error(`Invalid journey status: ${status}`), { code: 'INVALID_STATUS' })
  }

  const journeyGraph = graph || stepsToGraph(steps, targetChannel)
  const journeyId = prefixedId('jrn_')
  const versionId = prefixedId('jrv_')

  return withTenant(agencyId, agentId, async () => {
    const journey = await insert('journeys', {
      id: journeyId,
      agency_id: agencyId,
      agent_id: agentId,
      name: name.trim(),
      description: description.trim(),
      status,
      trigger,
      entry_audience_id: entryAudienceId,
      goal_event: goalEvent,
      legacy_campaign_id: legacyCampaignId,
      tags_filter: Array.isArray(tagsFilter) ? tagsFilter : [],
      target_channel: targetChannel,
      audience_rules: Array.isArray(audienceRules) ? audienceRules : [],
      created_by: createdBy || agentId,
      suppression: {},
    })

    const version = await insert('journey_versions', {
      id: versionId,
      journey_id: journeyId,
      version: 1,
      graph: journeyGraph,
      published_at: status === 'active' ? new Date().toISOString() : null,
    })

    return { ...journey, current_version: version }
  })
}

export async function getJourney(id, { agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    const journey = await findOne('journeys', (j) => j.id === id)
    if (!journey) return null
    const versions = await findAll('journey_versions', (v) => v.journey_id === id)
    versions.sort((a, b) => b.version - a.version)
    return { ...journey, versions }
  })
}

export async function listJourneys({ status, trigger, agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    let rows = await findAll('journeys')
    if (status) rows = rows.filter((j) => j.status === status)
    if (trigger) rows = rows.filter((j) => j.trigger === trigger)
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return rows
  })
}

export async function publishJourneyVersion({
  journeyId,
  graph,
  agencyId = null,
  agentId = null,
}) {
  return withTenant(agencyId, agentId, async () => {
    const journey = await findOne('journeys', (j) => j.id === journeyId)
    if (!journey) {
      throw Object.assign(new Error(`journey not found: ${journeyId}`), { code: 'JOURNEY_NOT_FOUND' })
    }
    const existing = await findAll('journey_versions', (v) => v.journey_id === journeyId)
    const nextVersion = existing.length ? Math.max(...existing.map((v) => v.version)) + 1 : 1
    const version = await insert('journey_versions', {
      id: prefixedId('jrv_'),
      journey_id: journeyId,
      version: nextVersion,
      graph,
      published_at: new Date().toISOString(),
    })
    await update('journeys', (j) => j.id === journeyId, () => ({
      ...journey,
      status: journey.status === 'draft' ? 'active' : journey.status,
      updated_at: new Date().toISOString(),
    }))
    return version
  })
}

export async function updateJourney(id, patch, { agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    const journey = await findOne('journeys', (j) => j.id === id)
    if (!journey) return null
    const allowed = [
      'name', 'description', 'status', 'trigger', 'tags_filter',
      'target_channel', 'audience_rules', 'entry_audience_id', 'goal_event', 'suppression',
    ]
    const next = { ...journey, updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (patch[key] !== undefined) next[key] = patch[key]
    }
    if (next.status && !VALID_STATUSES.has(next.status)) {
      throw Object.assign(new Error(`Invalid journey status: ${next.status}`), { code: 'INVALID_STATUS' })
    }
    await update('journeys', (j) => j.id === id, () => next)

    if (patch.steps || patch.graph) {
      const graph = patch.graph || stepsToGraph(patch.steps, next.target_channel)
      const versions = await findAll('journey_versions', (v) => v.journey_id === id)
      const latest = versions.sort((a, b) => b.version - a.version)[0]
      if (latest) {
        await update('journey_versions', (v) => v.id === latest.id, () => ({
          ...latest,
          graph,
          updated_at: new Date().toISOString(),
        }))
      }
    }

    return findOne('journeys', (j) => j.id === id)
  })
}

export async function createJourneyRun({
  journeyVersionId,
  contactId,
  agencyId = null,
  agentId = null,
  entryNodeId = null,
}) {
  return withTenant(agencyId, agentId, async () => {
    const version = await findOne('journey_versions', (v) => v.id === journeyVersionId)
    if (!version) {
      throw Object.assign(new Error(`journey version not found: ${journeyVersionId}`), {
        code: 'VERSION_NOT_FOUND',
      })
    }
    const startNode = entryNodeId || version.graph?.nodes?.find((n) => n.type === 'trigger')?.id
    const run = await insert('journey_runs', {
      id: prefixedId('jrun_'),
      journey_version_id: journeyVersionId,
      contact_id: contactId,
      agency_id: agencyId,
      agent_id: agentId,
      current_node_id: startNode,
      state: {},
      status: 'active',
      entered_at: new Date().toISOString(),
    })
    return run
  })
}

export async function getJourneyRun(id, { agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, () => findOne('journey_runs', (r) => r.id === id))
}

export async function listJourneyRuns({ journeyVersionId, contactId, status, agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    let rows = await findAll('journey_runs')
    if (journeyVersionId) rows = rows.filter((r) => r.journey_version_id === journeyVersionId)
    if (contactId) rows = rows.filter((r) => r.contact_id === contactId)
    if (status) rows = rows.filter((r) => r.status === status)
    return rows
  })
}

export async function updateJourneyRun(id, patch, { agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    const run = await findOne('journey_runs', (r) => r.id === id)
    if (!run) return null
    const next = { ...run, ...patch, updated_at: new Date().toISOString() }
    await update('journey_runs', (r) => r.id === id, () => next)
    return findOne('journey_runs', (r) => r.id === id)
  })
}

export async function recordNodeRun({
  journeyRunId,
  nodeId,
  nodeType,
  input = {},
  result = {},
  executionId = null,
  creativeId = null,
  agencyId = null,
  agentId = null,
}) {
  return withTenant(agencyId, agentId, () =>
    insert('journey_node_runs', {
      id: prefixedId('jnr_'),
      journey_run_id: journeyRunId,
      node_id: nodeId,
      node_type: nodeType,
      agency_id: agencyId,
      agent_id: agentId,
      input,
      result,
      execution_id: executionId,
      creative_id: creativeId,
      occurred_at: new Date().toISOString(),
    }),
  )
}

export async function listNodeRuns({ journeyRunId, agencyId = null, agentId = null } = {}) {
  return withTenant(agencyId, agentId, async () => {
    let rows = await findAll('journey_node_runs')
    if (journeyRunId) rows = rows.filter((r) => r.journey_run_id === journeyRunId)
    rows.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
    return rows
  })
}
