/**
 * Journey graph canvas — branching editor for Wave 2E.
 * Nodes: trigger / wait / send / condition / branch / lead_score / goal / exit / experiment
 */
import { useMemo, useState } from 'react'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type JourneyNodeType =
  | 'trigger'
  | 'wait'
  | 'send'
  | 'condition'
  | 'branch'
  | 'lead_score'
  | 'goal'
  | 'exit'
  | 'experiment'

export interface JourneyNode {
  id: string
  type: JourneyNodeType
  config: Record<string, unknown>
  x?: number
  y?: number
}

export interface JourneyEdge {
  from: string
  to: string
}

export interface JourneyGraph {
  nodes: JourneyNode[]
  edges: JourneyEdge[]
}

const NODE_PALETTE: { type: JourneyNodeType; label: string }[] = [
  { type: 'wait', label: 'Wait' },
  { type: 'send', label: 'Send' },
  { type: 'condition', label: 'Condition' },
  { type: 'branch', label: 'Branch' },
  { type: 'lead_score', label: 'Lead score' },
  { type: 'goal', label: 'Goal' },
  { type: 'exit', label: 'Exit' },
  { type: 'experiment', label: 'Experiment' },
]

function newId(type: string) {
  return `n_${type}_${Math.random().toString(36).slice(2, 9)}`
}

function defaultConfig(type: JourneyNodeType): Record<string, unknown> {
  switch (type) {
    case 'wait':
      return { hours: 24 }
    case 'send':
      return { channel: 'email', purpose: 'marketing', subject: '', body: '' }
    case 'condition':
      return {
        kind: 'attribute',
        field: 'status',
        operator: 'is',
        value: 'lead',
        true_next: '',
        false_next: '',
      }
    case 'branch':
      return { branch_key: 'segment', branches: {}, default_next: '' }
    case 'lead_score':
      return { score_delta: 10, field: 'lead_score' }
    case 'goal':
      return { goal_event: 'viewing.booked' }
    case 'exit':
      return { reason: 'manual_exit' }
    case 'experiment':
      return {
        experiment_id: '',
        variants: [
          { key: 'A', weight: 50, next: '' },
          { key: 'B', weight: 50, next: '' },
        ],
        holdout_pct: 0,
        holdout_next: '',
      }
    default:
      return {}
  }
}

export function emptyJourneyGraph(): JourneyGraph {
  return {
    nodes: [
      { id: 'n_trigger', type: 'trigger', config: {}, x: 40, y: 120 },
      { id: 'n_exit', type: 'exit', config: { reason: 'end' }, x: 420, y: 120 },
    ],
    edges: [{ from: 'n_trigger', to: 'n_exit' }],
  }
}

export function JourneyCanvas({
  graph,
  onChange,
}: {
  graph: JourneyGraph
  onChange: (next: JourneyGraph) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(graph.nodes[0]?.id ?? null)
  const selected = useMemo(
    () => graph.nodes.find((n) => n.id === selectedId) || null,
    [graph.nodes, selectedId],
  )

  function addNode(type: JourneyNodeType) {
    const id = newId(type)
    const node: JourneyNode = {
      id,
      type,
      config: defaultConfig(type),
      x: 160 + graph.nodes.length * 24,
      y: 80 + (graph.nodes.length % 4) * 56,
    }
    const trigger = graph.nodes.find((n) => n.type === 'trigger')
    const edges = [...graph.edges]
    if (trigger) {
      const fromTrigger = edges.findIndex((e) => e.from === trigger.id)
      if (fromTrigger >= 0) {
        const oldTo = edges[fromTrigger].to
        edges[fromTrigger] = { from: trigger.id, to: id }
        edges.push({ from: id, to: oldTo })
      } else {
        edges.push({ from: trigger.id, to: id })
      }
    }
    onChange({ nodes: [...graph.nodes, node], edges })
    setSelectedId(id)
  }

  function updateSelected(patch: Partial<JourneyNode>) {
    if (!selected) return
    onChange({
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === selected.id ? { ...n, ...patch, config: { ...n.config, ...(patch.config || {}) } } : n)),
    })
  }

  function removeSelected() {
    if (!selected || selected.type === 'trigger') return
    const id = selected.id
    onChange({
      nodes: graph.nodes.filter((n) => n.id !== id),
      edges: graph.edges
        .filter((e) => e.from !== id && e.to !== id)
        .concat(
          // reconnect orphans loosely via remaining exit if needed
        ),
    })
    setSelectedId(graph.nodes.find((n) => n.type === 'trigger')?.id ?? null)
  }

  function setEdge(from: string, to: string) {
    if (!from || !to || from === to) return
    const edges = graph.edges.filter((e) => e.from !== from)
    edges.push({ from, to })
    onChange({ ...graph, edges })
  }

  return (
    <div className="grid gap-[var(--lc-space-md)] lg:grid-cols-[1fr_320px]">
      <div
        className="relative min-h-[360px] overflow-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]"
        role="application"
        aria-label="Journey canvas"
      >
        <div className="mb-[var(--lc-space-sm)] flex flex-wrap gap-[var(--lc-space-xs)]">
          {NODE_PALETTE.map((item) => (
            <Button
              key={item.type}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addNode(item.type)}
              className="min-h-[var(--lc-tap-target-min)]"
            >
              <Plus className="h-3.5 w-3.5" />
              {item.label}
            </Button>
          ))}
        </div>

        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {graph.edges.map((edge) => {
            const from = graph.nodes.find((n) => n.id === edge.from)
            const to = graph.nodes.find((n) => n.id === edge.to)
            if (!from || !to) return null
            const x1 = (from.x ?? 40) + 90
            const y1 = (from.y ?? 40) + 20
            const x2 = to.x ?? 200
            const y2 = (to.y ?? 40) + 20
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--lc-border-strong)"
                strokeWidth="2"
              />
            )
          })}
        </svg>

        <div className="relative z-[1] min-h-[280px]">
          {graph.nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedId(node.id)}
              className={cn(
                'absolute min-w-[140px] rounded-[var(--lc-radius-md)] border px-3 py-2 text-left transition-shadow',
                selectedId === node.id
                  ? 'border-[var(--lc-action-primary)] bg-[var(--lc-surface)] shadow-[var(--lc-shadow-sm)]'
                  : 'border-[var(--lc-border)] bg-[var(--lc-surface)]',
              )}
              style={{ left: node.x ?? 40, top: node.y ?? 40 }}
            >
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-[var(--lc-text-muted)]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--lc-text-muted)]">
                  {node.type}
                </span>
              </div>
              <div className="mt-1 text-sm text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
                {node.id}
              </div>
            </button>
          ))}
        </div>
      </div>

      <aside className="space-y-[var(--lc-space-md)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-[var(--lc-space-md)]">
        <div className="flex items-center justify-between gap-2">
          <h3 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-primary)]">
            Node
          </h3>
          {selected && selected.type !== 'trigger' && (
            <Button type="button" size="sm" variant="ghost" onClick={removeSelected} aria-label="Remove node">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!selected && (
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
            Select a node to edit its configuration and outbound link.
          </p>
        )}

        {selected && (
          <div className="space-y-[var(--lc-space-sm)]">
            <div>
              <Label className="text-xs">Type</Label>
              <p className="text-sm text-[var(--lc-text-primary)]">{selected.type}</p>
            </div>

            {selected.type === 'wait' && (
              <div className="space-y-1.5">
                <Label htmlFor="wait-hours">Wait hours</Label>
                <Input
                  id="wait-hours"
                  type="number"
                  min={0}
                  value={Number(selected.config.hours) || 0}
                  onChange={(e) => updateSelected({ config: { hours: Number(e.target.value) || 0 } })}
                />
              </div>
            )}

            {selected.type === 'send' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="send-channel">Channel</Label>
                  <select
                    id="send-channel"
                    className="h-9 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                    value={String(selected.config.channel || 'email')}
                    onChange={(e) => updateSelected({ config: { channel: e.target.value } })}
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="send-purpose">Purpose</Label>
                  <select
                    id="send-purpose"
                    className="h-9 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                    value={String(selected.config.purpose || 'marketing')}
                    onChange={(e) => updateSelected({ config: { purpose: e.target.value } })}
                  >
                    <option value="marketing">Marketing</option>
                    <option value="nurture">Nurture</option>
                    <option value="transactional">Transactional</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="send-subject">Subject</Label>
                  <Input
                    id="send-subject"
                    value={String(selected.config.subject || '')}
                    onChange={(e) => updateSelected({ config: { subject: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="send-body">Body</Label>
                  <textarea
                    id="send-body"
                    className="min-h-[80px] w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                    value={String(selected.config.body || '')}
                    onChange={(e) => updateSelected({ config: { body: e.target.value } })}
                  />
                </div>
              </>
            )}

            {selected.type === 'condition' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cond-kind">Predicate</Label>
                  <select
                    id="cond-kind"
                    className="h-9 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                    value={String(selected.config.kind || 'attribute')}
                    onChange={(e) => updateSelected({ config: { kind: e.target.value } })}
                  >
                    <option value="attribute">Attribute</option>
                    <option value="event">Event / engagement</option>
                  </select>
                </div>
                {String(selected.config.kind || 'attribute') === 'event' ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="cond-event">Event name</Label>
                      <Input
                        id="cond-event"
                        value={String(selected.config.event_name || '')}
                        onChange={(e) => updateSelected({ config: { event_name: e.target.value } })}
                        placeholder="message.replied"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cond-window">Window hours</Label>
                      <Input
                        id="cond-window"
                        type="number"
                        min={0}
                        value={Number(selected.config.window_hours) || 48}
                        onChange={(e) => updateSelected({ config: { window_hours: Number(e.target.value) || 0 } })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cond-op-event">Operator</Label>
                      <select
                        id="cond-op-event"
                        className="h-9 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                        value={String(selected.config.operator || 'occurred')}
                        onChange={(e) => updateSelected({ config: { operator: e.target.value } })}
                      >
                        <option value="occurred">Occurred</option>
                        <option value="not_occurred">Did not occur</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="cond-field">Field</Label>
                      <Input
                        id="cond-field"
                        value={String(selected.config.field || '')}
                        onChange={(e) => updateSelected({ config: { field: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cond-op">Operator</Label>
                      <select
                        id="cond-op"
                        className="h-9 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                        value={String(selected.config.operator || 'is')}
                        onChange={(e) => updateSelected({ config: { operator: e.target.value } })}
                      >
                        <option value="is">is</option>
                        <option value="is_not">is not</option>
                        <option value="contains">contains</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cond-value">Value</Label>
                      <Input
                        id="cond-value"
                        value={String(selected.config.value || '')}
                        onChange={(e) => updateSelected({ config: { value: e.target.value } })}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="cond-true">True → node</Label>
                  <select
                    id="cond-true"
                    className="h-9 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                    value={String(selected.config.true_next || '')}
                    onChange={(e) => updateSelected({ config: { true_next: e.target.value } })}
                  >
                    <option value="">Select…</option>
                    {graph.nodes.filter((n) => n.id !== selected.id).map((n) => (
                      <option key={n.id} value={n.id}>{n.type}:{n.id}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cond-false">False → node</Label>
                  <select
                    id="cond-false"
                    className="h-9 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                    value={String(selected.config.false_next || '')}
                    onChange={(e) => updateSelected({ config: { false_next: e.target.value } })}
                  >
                    <option value="">Select…</option>
                    {graph.nodes.filter((n) => n.id !== selected.id).map((n) => (
                      <option key={n.id} value={n.id}>{n.type}:{n.id}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {selected.type !== 'condition' && selected.type !== 'trigger' && (
              <div className="space-y-1.5">
                <Label htmlFor="next-node">Next node</Label>
                <select
                  id="next-node"
                  className="h-9 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm"
                  value={graph.edges.find((e) => e.from === selected.id)?.to || ''}
                  onChange={(e) => setEdge(selected.id, e.target.value)}
                >
                  <option value="">Select…</option>
                  {graph.nodes.filter((n) => n.id !== selected.id).map((n) => (
                    <option key={n.id} value={n.id}>{n.type}:{n.id}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="rounded-[var(--lc-radius-sm)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-3">
              <p className="mb-1 text-xs font-medium text-[var(--lc-text-muted)]">Preview</p>
              <pre className="overflow-auto text-[11px] text-[var(--lc-text-secondary)]">
                {JSON.stringify(selected.config, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
