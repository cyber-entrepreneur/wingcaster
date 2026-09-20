import { describe, expect, it } from 'vitest'
import {
  evaluateCondition,
  getEntryNode,
  getOutgoing,
  graphToSteps,
  stepsToGraph,
} from './graph.js'

describe('journey graph', () => {
  it('converts linear steps to wait→send pairs', () => {
    const graph = stepsToGraph([
      { delay_hours: 0, channel: 'email', subject: 'Hi', body: 'Hello' },
      { delay_hours: 24, channel: 'sms', subject: '', body: 'Follow up' },
    ], 'email')

    expect(graph.nodes.filter((n) => n.type === 'send')).toHaveLength(2)
    expect(graph.nodes.filter((n) => n.type === 'wait')).toHaveLength(2)
    expect(getEntryNode(graph)).toBe('n_wait_0')
  })

  it('round-trips steps through graph', () => {
    const steps = [
      { delay_hours: 0, channel: 'email', subject: 'A', body: 'B' },
      { delay_hours: 48, channel: 'whatsapp', subject: '', body: 'C' },
    ]
    const graph = stepsToGraph(steps, 'email')
    const back = graphToSteps(graph, 'email')
    expect(back).toHaveLength(2)
    expect(back[0].channel).toBe('email')
    expect(back[1].delay_hours).toBe(48)
  })

  it('evaluates condition nodes', () => {
    const contact = { status: 'lead', tags: ['buyer', 'vip'] }
    expect(evaluateCondition({ field: 'status', operator: 'is', value: 'lead' }, contact)).toBe(true)
    expect(evaluateCondition({ field: 'tags', operator: 'contains', value: 'vip' }, contact)).toBe(true)
    expect(evaluateCondition({ field: 'status', operator: 'is_not', value: 'client' }, contact)).toBe(true)
  })

  it('evaluates event engagement conditions', () => {
    const events = [{ event_name: 'message.replied', occurred_at: new Date().toISOString() }]
    expect(evaluateCondition({
      kind: 'event',
      event_name: 'message.replied',
      window_hours: 48,
      operator: 'occurred',
    }, {}, {}, events)).toBe(true)
    expect(evaluateCondition({
      kind: 'event',
      event_name: 'message.replied',
      window_hours: 48,
      operator: 'not_occurred',
    }, {}, {}, [])).toBe(true)
  })

  it('supports branch-capable graph structure', () => {
    const graph = {
      nodes: [
        { id: 'n_trigger', type: 'trigger', config: {} },
        { id: 'n_cond', type: 'condition', config: { field: 'status', operator: 'is', value: 'lead', true_next: 'n_send', false_next: 'n_exit' } },
        { id: 'n_send', type: 'send', config: { channel: 'email', subject: 'Hi', body: 'Hey' } },
        { id: 'n_exit', type: 'exit', config: {} },
      ],
      edges: [
        { from: 'n_trigger', to: 'n_cond' },
        { from: 'n_send', to: 'n_exit' },
      ],
    }
    expect(getOutgoing(graph, 'n_trigger')).toEqual(['n_cond'])
    expect(graph.nodes.find((n) => n.type === 'condition')).toBeTruthy()
  })
})
