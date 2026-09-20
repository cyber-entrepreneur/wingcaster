/**
 * Journey runtime engine — graph traversal with consent-gated send nodes.
 */

import {
  checkEligibility,
  createExecution,
  ingestEvent,
} from '../../lib/growth-os/index.js'
import { findOne } from '../../persistence/index.js'
import {
  getNode,
  getOutgoing,
  getEntryNode,
  resolveBranchTarget,
} from './graph.js'
import {
  createJourneyRun,
  getJourney,
  getJourneyRun,
  listNodeRuns,
  recordNodeRun,
  updateJourneyRun,
} from './repository.js'

function hoursToMs(hours) {
  return Math.max(0, Number(hours) || 0) * 60 * 60 * 1000
}

function isWaitComplete(node, run, now = Date.now()) {
  const waitStarted = run.state?.[`wait_started_${node.id}`]
  if (!waitStarted) return true
  const hours = node.config?.hours ?? 0
  return now - new Date(waitStarted).getTime() >= hoursToMs(hours)
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

/**
 * Process a single node for a journey run. Returns { done, run, nodeRuns }.
 */
export async function processNode(run, version, contact, { agencyId, agentId, now = Date.now() } = {}) {
  const graph = version.graph
  const nodeId = run.current_node_id
  const node = getNode(graph, nodeId)
  const nodeRuns = []

  if (!node) {
    const updated = await updateJourneyRun(run.id, {
      status: 'completed',
      exited_at: new Date().toISOString(),
      current_node_id: null,
    }, { agencyId, agentId })
    return { done: true, run: updated, nodeRuns }
  }

  if (node.type === 'exit' || node.type === 'goal') {
    const nr = await recordNodeRun({
      journeyRunId: run.id,
      nodeId: node.id,
      nodeType: node.type,
      input: node.config || {},
      result: { outcome: 'exited' },
      agencyId,
      agentId,
    })
    nodeRuns.push(nr)
    const updated = await updateJourneyRun(run.id, {
      status: 'completed',
      exited_at: new Date().toISOString(),
      current_node_id: null,
    }, { agencyId, agentId })
    return { done: true, run: updated, nodeRuns }
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
        return { done: false, run, nodeRuns, waiting: true }
      }
    } else if (!isWaitComplete(node, run, now)) {
      return { done: false, run, nodeRuns, waiting: true }
    }
    const next = getOutgoing(graph, node.id)[0]
    run = await updateJourneyRun(run.id, { current_node_id: next }, { agencyId, agentId })
    return { done: false, run, nodeRuns, advanced: true }
  }

  if (node.type === 'condition' || node.type === 'branch') {
    const next = resolveBranchTarget(graph, node, contact, run.state || {})
    const nr = await recordNodeRun({
      journeyRunId: run.id,
      nodeId: node.id,
      nodeType: node.type,
      input: node.config || {},
      result: { next_node_id: next },
      agencyId,
      agentId,
    })
    nodeRuns.push(nr)
    run = await updateJourneyRun(run.id, { current_node_id: next }, { agencyId, agentId })
    return { done: false, run, nodeRuns, advanced: true }
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
        result: { outcome: 'suppressed', reason_code: eligibility.reason_code },
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
        },
        idempotencyKey: `journey.node.suppressed:${run.id}:${node.id}`,
      })

      const updated = await updateJourneyRun(run.id, {
        status: 'suppressed',
        exited_at: new Date().toISOString(),
        current_node_id: null,
      }, { agencyId, agentId })
      return { done: true, run: updated, nodeRuns, suppressed: true }
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
      const updated = await updateJourneyRun(run.id, {
        status: 'completed',
        exited_at: new Date().toISOString(),
        current_node_id: null,
      }, { agencyId, agentId })
      return { done: true, run: updated, nodeRuns }
    }
    run = await updateJourneyRun(run.id, { current_node_id: next }, { agencyId, agentId })
    return { done: false, run, nodeRuns, advanced: true }
  }

  // trigger, lead_score, experiment — pass through
  const next = getOutgoing(graph, node.id)[0]
  const nr = await recordNodeRun({
    journeyRunId: run.id,
    nodeId: node.id,
    nodeType: node.type,
    input: node.config || {},
    result: { passed: true },
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
    return { done: true, run: updated, nodeRuns }
  }
  run = await updateJourneyRun(run.id, { current_node_id: next }, { agencyId, agentId })
  return { done: false, run, nodeRuns, advanced: true }
}

/**
 * Advance a journey run until wait, completion, or maxSteps.
 */
export async function advanceRun(runId, { agencyId = null, agentId = null, maxSteps = 20 } = {}) {
  let run = await getJourneyRun(runId, { agencyId, agentId })
  if (!run || run.status !== 'active') {
    return { run, nodeRuns: [], done: true }
  }

  const version = await findOne('journey_versions', (v) => v.id === run.journey_version_id)
  const contact = await findOne('contacts', (c) => c.id === run.contact_id)
  if (!version || !contact) {
    throw Object.assign(new Error('Missing version or contact for run'), { code: 'RUN_CONTEXT_MISSING' })
  }

  const allNodeRuns = []
  let steps = 0
  let done = false

  while (!done && steps < maxSteps && run.status === 'active') {
    const result = await processNode(run, version, contact, { agencyId, agentId })
    run = result.run
    allNodeRuns.push(...result.nodeRuns)
    done = result.done
    if (!result.advanced && !result.waiting) break
    if (result.waiting) break
    steps++
  }

  return { run, nodeRuns: allNodeRuns, done }
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
  return { ...run, node_runs: nodeRuns }
}
