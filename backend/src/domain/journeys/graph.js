/**
 * Journey graph utilities — DAG node/edge model for branch-capable orchestration.
 * Wave 2E: attribute + event/engagement condition predicates, experiment splits.
 */

import { createHash, randomUUID } from 'node:crypto'

export const NODE_TYPES = new Set([
  'trigger', 'wait', 'send', 'condition', 'branch',
  'lead_score', 'goal', 'exit', 'experiment',
])

export function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

/**
 * Convert legacy linear campaign steps to a journey graph (wait→send pairs).
 */
export function stepsToGraph(steps = [], targetChannel = 'email') {
  const nodes = []
  const edges = []
  let prevId = 'n_trigger'

  nodes.push({ id: 'n_trigger', type: 'trigger', config: {} })

  if (!steps?.length) {
    nodes.push({ id: 'n_exit', type: 'exit', config: {} })
    edges.push({ from: prevId, to: 'n_exit' })
    return { nodes, edges }
  }

  steps.forEach((step, i) => {
    const waitId = `n_wait_${i}`
    nodes.push({
      id: waitId,
      type: 'wait',
      config: { hours: Math.max(0, Number(step.delay_hours) || 0) },
    })
    edges.push({ from: prevId, to: waitId })

    const sendId = `n_send_${i}`
    nodes.push({
      id: sendId,
      type: 'send',
      config: {
        channel: step.channel || targetChannel,
        subject: step.subject || '',
        body: step.body || '',
        template_id: step.template_id || null,
        creative_id: step.creative_id || null,
        purpose: step.purpose || 'marketing',
      },
    })
    edges.push({ from: waitId, to: sendId })
    prevId = sendId
  })

  nodes.push({ id: 'n_exit', type: 'exit', config: {} })
  edges.push({ from: prevId, to: 'n_exit' })

  return { nodes, edges }
}

export function graphToSteps(graph, targetChannel = 'email') {
  const nodes = graph?.nodes || []
  const edges = graph?.edges || []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = new Map()
  for (const e of edges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, [])
    outgoing.get(e.from).push(e.to)
  }

  const steps = []
  let current = outgoing.get('n_trigger')?.[0]
  while (current) {
    const node = byId.get(current)
    if (!node) break
    if (node.type === 'exit') break
    if (node.type === 'wait') {
      const nextIds = outgoing.get(current) || []
      const sendNode = nextIds.map((id) => byId.get(id)).find((n) => n?.type === 'send')
      if (sendNode) {
        steps.push({
          delay_hours: node.config?.hours ?? 0,
          channel: sendNode.config?.channel || targetChannel,
          template_id: sendNode.config?.template_id || null,
          subject: sendNode.config?.subject || '',
          body: sendNode.config?.body || '',
          creative_id: sendNode.config?.creative_id || null,
          purpose: sendNode.config?.purpose || 'marketing',
        })
        current = outgoing.get(sendNode.id)?.[0]
        continue
      }
    }
    current = outgoing.get(current)?.[0]
  }
  return steps
}

export function getNode(graph, nodeId) {
  return (graph?.nodes || []).find((n) => n.id === nodeId) || null
}

export function getOutgoing(graph, nodeId) {
  return (graph?.edges || []).filter((e) => e.from === nodeId).map((e) => e.to)
}

export function getEntryNode(graph) {
  const trigger = (graph?.nodes || []).find((n) => n.type === 'trigger')
  if (!trigger) return null
  const next = getOutgoing(graph, trigger.id)
  return next[0] || null
}

/**
 * Attribute predicates (status/tags/source/territory/state fields).
 */
export function evaluateAttributeCondition(config, contact, state = {}) {
  const field = config?.field
  const operator = config?.operator || 'is'
  const expected = config?.value

  let actual
  if (field === 'tags') {
    actual = (contact?.tags || []).join(',')
    if (operator === 'contains') return (contact?.tags || []).some((t) => String(t) === String(expected))
  } else if (field === 'status') {
    actual = contact?.status
  } else if (field === 'source') {
    actual = contact?.source
  } else if (field === 'territory') {
    actual = contact?.territory || contact?.data?.territory
  } else {
    actual = state[field] ?? contact?.[field]
  }

  if (operator === 'is') return String(actual) === String(expected)
  if (operator === 'is_not') return String(actual) !== String(expected)
  if (operator === 'contains') return String(actual || '').includes(String(expected))
  if (operator === 'gt') return Number(actual) > Number(expected)
  if (operator === 'gte') return Number(actual) >= Number(expected)
  if (operator === 'lt') return Number(actual) < Number(expected)
  if (operator === 'lte') return Number(actual) <= Number(expected)
  return false
}

/**
 * Event/engagement predicates — e.g. "message.replied within 48h".
 */
export function evaluateEventCondition(config, recentEvents = [], now = Date.now()) {
  const eventName = config?.event_name
  if (!eventName) return false
  const windowHours = Number(config?.window_hours)
  const since = Number.isFinite(windowHours) && windowHours > 0
    ? now - windowHours * 60 * 60 * 1000
    : null
  const operator = config?.operator || 'occurred'

  const matched = (recentEvents || []).some((ev) => {
    if (ev.event_name !== eventName) return false
    if (since == null) return true
    return new Date(ev.occurred_at).getTime() >= since
  })

  if (operator === 'not_occurred' || operator === 'absent') return !matched
  return matched
}

/**
 * Evaluate a condition config. Supports attribute (default) and event kinds.
 */
export function evaluateCondition(config, contact, state = {}, recentEvents = [], now = Date.now()) {
  const kind = config?.kind || (config?.event_name ? 'event' : 'attribute')
  if (kind === 'event') {
    return evaluateEventCondition(config, recentEvents, now)
  }
  return evaluateAttributeCondition(config, contact, state)
}

export function resolveBranchTarget(graph, node, contact, state, recentEvents = [], now = Date.now()) {
  const config = node.config || {}
  if (node.type === 'condition') {
    const result = evaluateCondition(config, contact, state, recentEvents, now)
    return {
      next: result ? config.true_next : config.false_next,
      reason: {
        type: 'condition',
        kind: config.kind || (config.event_name ? 'event' : 'attribute'),
        matched: result,
        predicate: {
          field: config.field,
          event_name: config.event_name,
          operator: config.operator,
          value: config.value,
          window_hours: config.window_hours,
        },
      },
    }
  }
  if (node.type === 'branch') {
    const key = config.branch_key
    const value = state[key]
    const mapping = config.branches || {}
    const next = mapping[value] || config.default_next || getOutgoing(graph, node.id)[0]
    return {
      next,
      reason: {
        type: 'branch',
        branch_key: key,
        branch_value: value,
        matched_key: mapping[value] != null,
      },
    }
  }
  return {
    next: getOutgoing(graph, node.id)[0],
    reason: { type: 'passthrough' },
  }
}

/**
 * Deterministic experiment assignment for node-level splits without a persisted
 * Experiment row. When config.experiment_id points at experiments, the engine
 * delegates to domain/experiments assignment-engine instead.
 */
export function assignExperimentVariant(config, contactId) {
  const variants = Array.isArray(config?.variants) ? config.variants : []
  const holdoutPct = Math.max(0, Math.min(100, Number(config?.holdout_pct) || 0))
  const seed = `${config?.experiment_id || 'node'}:${contactId || 'anon'}`
  const hash = createHash('sha256').update(seed).digest()
  const bucket = hash.readUInt32BE(0) % 10000

  if (holdoutPct > 0 && bucket < holdoutPct * 100) {
    return {
      variant: 'holdout',
      next: config.holdout_next || null,
      assignment_reason: 'holdout',
    }
  }

  if (!variants.length) {
    return {
      variant: null,
      next: config.default_next || null,
      assignment_reason: 'no_variants',
    }
  }

  const totalWeight = variants.reduce((sum, v) => sum + Math.max(0, Number(v.weight) || 0), 0) || variants.length
  const pick = (hash.readUInt32BE(4) % 10000) / 10000 * totalWeight
  let cursor = 0
  for (const variant of variants) {
    cursor += Math.max(0, Number(variant.weight) || (totalWeight / variants.length))
    if (pick <= cursor) {
      return {
        variant: variant.key || variant.id || variant.name,
        next: variant.next || null,
        assignment_reason: 'weighted_hash',
      }
    }
  }
  const last = variants[variants.length - 1]
  return {
    variant: last.key || last.id || last.name,
    next: last.next || null,
    assignment_reason: 'weighted_hash_fallback',
  }
}
