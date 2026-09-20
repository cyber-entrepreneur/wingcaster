/**
 * Journey runtime engine 2.0 — graph traversal with consent-gated send nodes,
 * event/attribute branches, exits, re-entry, lead_score, goal, experiment splits.
 */

import {
  checkEligibility,
  createExecution,
  ingestEvent,
  listEvents,
  withTenant,
} from '../../lib/growth-os/index.js'
import { findOne } from '../../persistence/index.js'
import {
  assignExperimentVariant,
  getNode,
  getOutgoing,
  getEntryNode,
  resolveBranchTarget,
} from './graph.js'
import {
  createJourneyRun,
  getJourney,
  getJourneyRun,
  listJourneyRuns,
  listNodeRuns,
  listTransitions,
  recordNodeRun,
  recordTransition,
  updateJourneyRun,
} from './repository.js'

function hoursToMs(hours) {
  return Math.max(0, Number(hours) || 0) * 60 * 60 * 1000
}

function isWaitComplete(node, run, now = Date.now()) {
  const hours = Number(node.config?.hours) || 0
  if (hours <= 0) return true
  const waitStarted = run.state?.[`wait_started_${node.id}`]
  if (!waitStarted) return true
  const startedMs = new Date(waitStarted).getTime()
  if (!Number.isFinite(startedMs)) return true
  return now - startedMs >= hoursToMs(hours)
}

function defaultReentryRules(journey) {
  const rules = journey?.reentry_rules
  if (rules && typeof rules === 'object') return rules
  return { allow: false, cooldown_hours: 0, max_entries: 1 }
}

/**
 * Enforce re-entry rules before creating a new run for the same contact+journey.
 */
export async function assertReentryAllowed(journey, contactId, { agencyId, agentId } = {}) {
  const rules = defaultReentryRules(journey)
  const versionIds = (journey.versions || []).map((v) => v.id)
  const prior = (await listJourneyRuns({ contactId, agencyId, agentId }))
    .filter((r) => versionIds.includes(r.journey_version_id))
    .sort((a, b) => new Date(b.entered_at).getTime() - new Date(a.entered_at).getTime())

  const active = prior.find((r) => r.status === 'active')
  if (active) {
    throw Object.assign(new Error('Contact already has an active journey run'), {
      code: 'REENTRY_ACTIVE_RUN',
      run_id: active.id,
    })
  }

  if (!prior.length) return true

  const maxEntries = Number(rules.max_entries)
  if (Number.isFinite(maxEntries) && maxEntries > 0 && prior.length >= maxEntries) {
    throw Object.assign(new Error('Re-entry not allowed: max entries reached'), {
      code: 'REENTRY_MAX_ENTRIES',
      max_entries: maxEntries,
    })
  }

  if (rules.allow !== true) {
    throw Object.assign(new Error('Re-entry not allowed for this journey'), {
      code: 'REENTRY_DENIED',
    })
  }

  const cooldownHours = Number(rules.cooldown_hours) || 0
  if (cooldownHours > 0) {
    const last = prior[0]
    const lastAt = new Date(last.exited_at || last.entered_at).getTime()
    const readyAt = lastAt + hoursToMs(cooldownHours)
    if (Date.now() < readyAt) {
      throw Object.assign(new Error('Re-entry cooldown not elapsed'), {
        code: 'REENTRY_COOLDOWN',
        ready_at: new Date(readyAt).toISOString(),
      })
    }
  }

  return true
}

/**
 * Enrol a contact into a journey (uses latest published version).
 */
export async function enrollContact({
  journeyId,
  contactId,
  agencyId = null,
  agentId = null,
}) {
  const journey = await getJourney(journeyId, { agencyId, agentId })
  if (!journey || journey.status !== 'active') {
    throw Object.assign(new Error('Active journey not found'), { code: 'JOURNEY_NOT_ACTIVE' })
  }
  const version = journey.versions?.find((v) => v.published_at) || journey.versions?.[0]
  if (!version) {
    throw Object.assign(new Error('No journey version available'), { code: 'NO_VERSION' })
  }

  await assertReentryAllowed(journey, contactId, { agencyId, agentId })

  const entryNode = getEntryNode(version.graph)
  const run = await createJourneyRun({
    journeyVersionId: version.id,
    contactId,
    agencyId,
    agentId,
    entryNodeId: entryNode,
  })

  await ingestEvent({
    eventName: 'journey.entered',
    actorType: 'system',
    actorId: 'journey_engine',
    objectType: 'campaign',
    objectId: journeyId,
    contactId,
    agencyId,
    agentId,
    context: { journey_run_id: run.id, journey_version_id: version.id },
    idempotencyKey: `journey.entered:${run.id}`,
  })

  return run
}

async function loadRecentEvents(contactId, { agencyId, agentId }) {
  if (!contactId) return []
  return listEvents({ contactId, agencyId, agentId })
}

async function advanceTo(run, fromNodeId, toNodeId, reason, { agencyId, agentId }) {
  const transition = await recordTransition({
    journeyRunId: run.id,
    fromNode: fromNodeId,
    toNode: toNodeId,
    reason,
    agencyId,
    agentId,
  })
  const updated = await updateJourneyRun(run.id, { current_node_id: toNodeId }, { agencyId, agentId })
  return { run: updated, transition }
}

/**
 * Process a single node for a journey run. Returns { done, run, nodeRuns, transitions }.
 */
export async function processNode(run, version, contact, { agencyId, agentId, now = Date.now() } = {}) {
  const graph = version.graph
  const nodeId = run.current_node_id
  const node = getNode(graph, nodeId)
  const nodeRuns = []
  const transitions = []

  if (!node) {
    const updated = await updateJourneyRun(run.id, {
      status: 'completed',
      exited_at: new Date().toISOString(),
      current_node_id: null,
    }, { agencyId, agentId })
    return { done: true, run: updated, nodeRuns, transitions }
  }

  // Global exit criteria on the journey definition (goal event observed).
  const exitCriteria = version.data?.exit_criteria
    || (await getJourney(version.journey_id, { agencyId, agentId }))?.exit_criteria
    || {}
  if (exitCriteria.goal_event) {
    const events = await loadRecentEvents(contact.id, { agencyId, agentId })
    const hit = events.some((ev) => ev.event_name === exitCriteria.goal_event)
    if (hit) {
      const nr = await recordNodeRun({
        journeyRunId: run.id,
        nodeId: node.id,
        nodeType: node.type,
        input: { exit_criteria: exitCriteria },
        result: { outcome: 'exited', reason: 'exit_criteria_goal_event', goal_event: exitCriteria.goal_event },
        agencyId,
        agentId,
      })
      nodeRuns.push(nr)
      const updated = await updateJourneyRun(run.id, {
        status: 'exited',
        exited_at: new Date().toISOString(),
        current_node_id: null,
      }, { agencyId, agentId })
      return { done: true, run: updated, nodeRuns, transitions, exited: true }
    }
  }

  if (node.type === 'exit') {
    const nr = await recordNodeRun({
      journeyRunId: run.id,
      nodeId: node.id,
      nodeType: 'exit',
      input: node.config || {},
      result: { outcome: 'exited', reason: node.config?.reason || 'exit_node' },
      agencyId,
      agentId,
    })
    nodeRuns.push(nr)
    const updated = await updateJourneyRun(run.id, {
      status: 'exited',
      exited_at: new Date().toISOString(),
      current_node_id: null,
    }, { agencyId, agentId })
    return { done: true, run: updated, nodeRuns, transitions }
  }

  if (node.type === 'goal') {
    const goalEvent = node.config?.goal_event
    let achieved = Boolean(node.config?.achieved)
    if (goalEvent) {
      const events = await loadRecentEvents(contact.id, { agencyId, agentId })
      achieved = events.some((ev) => ev.event_name === goalEvent)
    }
    const nr = await recordNodeRun({
      journeyRunId: run.id,
      nodeId: node.id,
      nodeType: 'goal',
      input: node.config || {},
      result: { outcome: achieved ? 'goal_achieved' : 'goal_reached', goal_event: goalEvent || null, achieved },
      agencyId,
      agentId,
    })
    nodeRuns.push(nr)
    const updated = await updateJourneyRun(run.id, {
      status: 'completed',
      exited_at: new Date().toISOString(),
      current_node_id: null,
      state: { ...run.state, goal_achieved: achieved, goal_event: goalEvent || null },
    }, { agencyId, agentId })
    return { done: true, run: updated, nodeRuns, transitions }
  }

  if (node.type === 'wait') {
    const state = { ...run.state }
    if (!state[`wait_started_${node.id}`]) {
      state[`wait_started_${node.id}`] = new Date().toISOString()
      run = await updateJourneyRun(run.id, { state }, { agencyId, agentId })
      const nr = await recordNodeRun({
        journeyRunId: run.id,
        nodeId: node.id,
        nodeType: 'wait',
        input: node.config || {},
        result: { started: true },
        agencyId,
        agentId,
      })
      nodeRuns.push(nr)
      if (!isWaitComplete(node, run, now)) {
        return { done: false, run, nodeRuns, transitions, waiting: true }
      }
    } else if (!isWaitComplete(node, run, now)) {
      return { done: false, run, nodeRuns, transitions, waiting: true }
    }
    const next = getOutgoing(graph, node.id)[0]
    const advanced = await advanceTo(run, node.id, next, { type: 'wait_elapsed', hours: node.config?.hours ?? 0 }, { agencyId, agentId })
    transitions.push(advanced.transition)
    return { done: false, run: advanced.run, nodeRuns, transitions, advanced: true }
  }

  if (node.type === 'condition' || node.type === 'branch') {
    const recentEvents = await loadRecentEvents(contact.id, { agencyId, agentId })
    const { next, reason } = resolveBranchTarget(graph, node, contact, run.state || {}, recentEvents, now)
    const nr = await recordNodeRun({
      journeyRunId: run.id,
      nodeId: node.id,
      nodeType: node.type,
      input: node.config || {},
      result: { next_node_id: next, ...reason },
      agencyId,
      agentId,
    })
    nodeRuns.push(nr)
    const advanced = await advanceTo(run, node.id, next, reason, { agencyId, agentId })
    transitions.push(advanced.transition)
    return { done: false, run: advanced.run, nodeRuns, transitions, advanced: true }
  }

  if (node.type === 'lead_score') {
    const delta = Number(node.config?.score_delta) || 0
    const field = node.config?.field || 'lead_score'
    const prev = Number(run.state?.[field]) || 0
    const nextScore = prev + delta
    const state = { ...run.state, [field]: nextScore }
    run = await updateJourneyRun(run.id, { state }, { agencyId, agentId })
    const next = getOutgoing(graph, node.id)[0]
    const nr = await recordNodeRun({
      journeyRunId: run.id,
      nodeId: node.id,
      nodeType: 'lead_score',
      input: node.config || {},
      result: { field, previous: prev, score: nextScore, next_node_id: next },
      agencyId,
      agentId,
    })
    nodeRuns.push(nr)
    const advanced = await advanceTo(
      run,
      node.id,
      next,
      { type: 'lead_score', field, previous: prev, score: nextScore },
      { agencyId, agentId },
    )
    transitions.push(advanced.transition)
    if (!next) {
      const updated = await updateJourneyRun(run.id, {
        status: 'completed',
        exited_at: new Date().toISOString(),
        current_node_id: null,
      }, { agencyId, agentId })
      return { done: true, run: updated, nodeRuns, transitions }
    }
    return { done: false, run: advanced.run, nodeRuns, transitions, advanced: true }
  }

  if (node.type === 'experiment') {
    const assignment = assignExperimentVariant(node.config || {}, contact.id)
    const next = assignment.next || getOutgoing(graph, node.id)[0]
    const state = {
      ...run.state,
      [`experiment_${node.id}`]: assignment.variant,
    }
    run = await updateJourneyRun(run.id, { state }, { agencyId, agentId })
    const reason = {
      type: 'experiment',
      variant: assignment.variant,
      assignment_reason: assignment.assignment_reason,
      experiment_id: node.config?.experiment_id || null,
    }
    const nr = await recordNodeRun({
      journeyRunId: run.id,
      nodeId: node.id,
      nodeType: 'experiment',
      input: node.config || {},
      result: { ...reason, next_node_id: next },
      agencyId,
      agentId,
    })
    nodeRuns.push(nr)
    const advanced = await advanceTo(run, node.id, next, reason, { agencyId, agentId })
    transitions.push(advanced.transition)
    if (!next) {
      const updated = await updateJourneyRun(advanced.run.id, {
        status: 'completed',
        exited_at: new Date().toISOString(),
        current_node_id: null,
      }, { agencyId, agentId })
      return { done: true, run: updated, nodeRuns, transitions }
    }
    return { done: false, run: advanced.run, nodeRuns, transitions, advanced: true }
  }

  if (node.type === 'send') {
    const channel = node.config?.channel || 'email'
    const purpose = node.config?.purpose || 'marketing'
    const eligibility = await checkEligibility({
      contactId: contact.id,
      channel,
      purpose,
      agencyId,
      agentId,
      approvedTemplate: node.config?.template_id || null,
    })

    if (!eligibility.allowed) {
      const nr = await recordNodeRun({
        journeyRunId: run.id,
        nodeId: node.id,
        nodeType: 'send',
        input: node.config || {},
        result: {
          outcome: 'suppressed',
          reason_code: eligibility.reason_code,
          frequency_reason: eligibility.frequency_reason || null,
          frequency_detail: eligibility.frequency_detail || null,
        },
        creativeId: node.config?.creative_id || null,
        agencyId,
        agentId,
      })
      nodeRuns.push(nr)

      await ingestEvent({
        eventName: 'journey.node.suppressed',
        actorType: 'system',
        actorId: 'journey_engine',
        objectType: 'campaign',
        objectId: version.journey_id,
        contactId: contact.id,
        agencyId,
        agentId,
        context: {
          journey_run_id: run.id,
          node_id: node.id,
          reason_code: eligibility.reason_code,
          frequency_reason: eligibility.frequency_reason || null,
        },
        idempotencyKey: `journey.node.suppressed:${run.id}:${node.id}`,
      })

      const updated = await updateJourneyRun(run.id, {
        status: 'suppressed',
        exited_at: new Date().toISOString(),
        current_node_id: null,
      }, { agencyId, agentId })
      return { done: true, run: updated, nodeRuns, transitions, suppressed: true }
    }

    const execution = await createExecution({
      kind: 'message',
      status: 'draft',
      agencyId,
      agentId,
      journeyNodeRunId: null,
      creativeId: node.config?.creative_id || null,
      subjectType: 'contact',
      subjectId: contact.id,
      data: {
        channel,
        purpose,
        subject: node.config?.subject || '',
        body: node.config?.body || '',
        template_id: node.config?.template_id || null,
      },
    })

    const nr = await recordNodeRun({
      journeyRunId: run.id,
      nodeId: node.id,
      nodeType: 'send',
      input: node.config || {},
      result: { outcome: 'execution_created', execution_id: execution.id },
      executionId: execution.id,
      creativeId: node.config?.creative_id || null,
      agencyId,
      agentId,
    })
    nodeRuns.push(nr)

    const next = getOutgoing(graph, node.id)[0]
    if (!next || getNode(graph, next)?.type === 'exit') {
      if (next) {
        const advanced = await advanceTo(
          run,
          node.id,
          next,
          { type: 'send_completed', execution_id: execution.id },
          { agencyId, agentId },
        )
        transitions.push(advanced.transition)
      }
      const updated = await updateJourneyRun(run.id, {
        status: next ? 'exited' : 'completed',
        exited_at: new Date().toISOString(),
        current_node_id: null,
      }, { agencyId, agentId })
      // If next is exit, record exit node run for inspector completeness.
      if (next && getNode(graph, next)?.type === 'exit') {
        const exitNr = await recordNodeRun({
          journeyRunId: run.id,
          nodeId: next,
          nodeType: 'exit',
          input: getNode(graph, next)?.config || {},
          result: { outcome: 'exited', reason: 'after_send' },
          agencyId,
          agentId,
        })
        nodeRuns.push(exitNr)
        return { done: true, run: { ...updated, status: 'exited' }, nodeRuns, transitions }
      }
      return { done: true, run: updated, nodeRuns, transitions }
    }
    const advanced = await advanceTo(
      run,
      node.id,
      next,
      { type: 'send_completed', execution_id: execution.id },
      { agencyId, agentId },
    )
    transitions.push(advanced.transition)
    return { done: false, run: advanced.run, nodeRuns, transitions, advanced: true }
  }

  // trigger — pass through
  const next = getOutgoing(graph, node.id)[0]
  const nr = await recordNodeRun({
    journeyRunId: run.id,
    nodeId: node.id,
    nodeType: node.type,
    input: node.config || {},
    result: { passed: true, next_node_id: next },
    agencyId,
    agentId,
  })
  nodeRuns.push(nr)
  if (!next) {
    const updated = await updateJourneyRun(run.id, {
      status: 'completed',
      exited_at: new Date().toISOString(),
      current_node_id: null,
    }, { agencyId, agentId })
    return { done: true, run: updated, nodeRuns, transitions }
  }
  const advanced = await advanceTo(
    run,
    node.id,
    next,
    { type: 'trigger_passthrough' },
    { agencyId, agentId },
  )
  transitions.push(advanced.transition)
  return { done: false, run: advanced.run, nodeRuns, transitions, advanced: true }
}

/**
 * Advance a journey run until wait, completion, or maxSteps.
 */
export async function advanceRun(runId, { agencyId = null, agentId = null, maxSteps = 20 } = {}) {
  let run = await getJourneyRun(runId, { agencyId, agentId })
  if (!run || run.status !== 'active') {
    return { run, nodeRuns: [], transitions: [], done: true }
  }

  const version = await withTenant(agencyId, agentId, () =>
    findOne('journey_versions', (v) => v.id === run.journey_version_id),
  )
  const contact = await findOne('contacts', (c) => c.id === run.contact_id)
  if (!version || !contact) {
    throw Object.assign(new Error('Missing version or contact for run'), { code: 'RUN_CONTEXT_MISSING' })
  }

  return advanceRunWithContext(run, version, contact, { agencyId, agentId, maxSteps })
}

async function advanceRunWithContext(run, version, contact, { agencyId, agentId, maxSteps }) {
  const allNodeRuns = []
  const allTransitions = []
  let steps = 0
  let done = false
  let current = run

  while (!done && steps < maxSteps && current.status === 'active') {
    const result = await processNode(current, version, contact, { agencyId, agentId })
    current = result.run
    allNodeRuns.push(...result.nodeRuns)
    allTransitions.push(...(result.transitions || []))
    done = result.done
    if (!result.advanced && !result.waiting) break
    if (result.waiting) break
    steps++
  }

  return { run: current, nodeRuns: allNodeRuns, transitions: allTransitions, done }
}

/**
 * Traverse a journey run from entry to completion (for tests / synchronous processing).
 */
export async function traverseRun(runId, { agencyId = null, agentId = null } = {}) {
  return advanceRun(runId, { agencyId, agentId, maxSteps: 50 })
}

export async function getRunWithNodeRuns(runId, { agencyId = null, agentId = null } = {}) {
  const run = await getJourneyRun(runId, { agencyId, agentId })
  if (!run) return null
  const nodeRuns = await listNodeRuns({ journeyRunId: runId, agencyId, agentId })
  const transitions = await listTransitions({ journeyRunId: runId, agencyId, agentId })
  return { ...run, node_runs: nodeRuns, transitions }
}
