/**
 * Journey graph utilities — DAG node/edge model for branch-capable orchestration.
 */

import { randomUUID } from 'node:crypto'

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

export function evaluateCondition(config, contact, state = {}) {
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
    actual = state[field]
  }

  if (operator === 'is') return String(actual) === String(expected)
  if (operator === 'is_not') return String(actual) !== String(expected)
  if (operator === 'contains') return String(actual || '').includes(String(expected))
  return false
}

export function resolveBranchTarget(graph, node, contact, state) {
  const config = node.config || {}
  if (node.type === 'condition') {
    const result = evaluateCondition(config, contact, state)
    return result ? config.true_next : config.false_next
  }
  if (node.type === 'branch') {
    const key = config.branch_key
    const value = state[key]
    const mapping = config.branches || {}
    return mapping[value] || config.default_next || getOutgoing(graph, node.id)[0]
  }
  return getOutgoing(graph, node.id)[0]
}
