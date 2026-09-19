/**
 * AGN-ROU-002 — Lead routing rule editor.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { api, type AgencyRoutingRule, type RoutingRuleCondition } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

const TRIGGERS = [
  { value: 'inquiry', label: 'New inquiry' },
  { value: 'comment', label: 'New comment' },
  { value: 'whatsapp_message', label: 'New WhatsApp message' },
]

const TARGETS = [
  { value: 'manual', label: 'Specific agent' },
  { value: 'round_robin', label: 'Round-robin group' },
  { value: 'least_loaded', label: 'Least busy' },
  { value: 'weighted', label: 'By language skill' },
]

const CONDITION_FIELDS = [
  { value: 'source', label: 'Source channel' },
  { value: 'area', label: 'Property area' },
  { value: 'property_type', label: 'Property type' },
  { value: 'language', label: 'Language' },
  { value: 'time_of_day', label: 'Time of day' },
]

function emptyRule(): Partial<AgencyRoutingRule> {
  return {
    name: '',
    priority: 100,
    trigger: 'inquiry',
    strategy: 'round_robin',
    enabled: true,
    relationship_priority: true,
    filters: { match: 'all', conditions: [] },
    target: { strategy: 'round_robin', assign_to_agent_id: null, round_robin_group_id: null, language: null },
  }
}

export function AgencyRoutingRuleEditorPage() {
  const { ruleId } = useParams()
  const navigate = useNavigate()
  const isNew = ruleId === 'new'
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  usePageTitle(isNew ? 'New routing rule' : 'Edit routing rule')

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [saving, setSaving] = useState(false)
  const [rule, setRule] = useState<Partial<AgencyRoutingRule>>(emptyRule())
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])

  const role = (agent?.affiliation as { role?: string } | undefined)?.role
  const isAdmin = role === 'owner' || role === 'admin'

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const [rulesRes, agency] = await Promise.all([
        isNew ? Promise.resolve(null) : api.getAgencyRoutingRule(ruleId!),
        api.getMyAgency().catch(() => null),
      ])
      if (!isNew && !rulesRes) {
        setLoadState('error')
        return
      }
      setRule(isNew ? emptyRule() : rulesRes!)
      const roster = (agency as { members?: { user_id: string; name?: string }[] } | null)?.members || []
      setMembers(roster.map((row) => ({ id: row.user_id, name: row.name || row.user_id })))
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
      addToast({ title: 'Could not load rule', description: (err as Error).message, variant: 'error' })
    }
  }, [addToast, isAdmin, isNew, ruleId])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  const conditions = useMemo(() => rule.filters?.conditions || [], [rule.filters])

  function updateCondition(index: number, patch: Partial<RoutingRuleCondition>) {
    const next = [...conditions]
    next[index] = { ...next[index], ...patch }
    setRule((prev) => ({ ...prev, filters: { match: prev.filters?.match || 'all', conditions: next } }))
  }

  function addCondition() {
    setRule((prev) => ({
      ...prev,
      filters: {
        match: prev.filters?.match || 'all',
        conditions: [...(prev.filters?.conditions || []), { field: 'source', op: 'eq', value: '' }],
      },
    }))
  }

  function removeCondition(index: number) {
    setRule((prev) => ({
      ...prev,
      filters: {
        match: prev.filters?.match || 'all',
        conditions: (prev.filters?.conditions || []).filter((_, i) => i !== index),
      },
    }))
  }

  async function save() {
    if (!rule.name?.trim()) {
      addToast({ title: 'Name is required', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: rule.name.trim(),
        priority: rule.priority,
        trigger: rule.trigger,
        strategy: rule.target?.strategy || rule.strategy,
        enabled: rule.enabled,
        relationship_priority: rule.relationship_priority,
        filters: rule.filters,
        target: rule.target,
      }
      if (isNew) {
        const created = await api.createAgencyRoutingRule(payload)
        addToast({ title: 'Rule created', variant: 'success' })
        navigate(`/agency/routing/rules/${created.id}`)
      } else {
        await api.updateAgencyRoutingRule(ruleId!, payload)
        addToast({ title: 'Rule saved', variant: 'success' })
        void load()
      }
    } catch (err) {
      addToast({ title: 'Save failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function destroy() {
    if (isNew || !ruleId) return
    if (!window.confirm('Delete this routing rule?')) return
    try {
      await api.deleteAgencyRoutingRule(ruleId)
      addToast({ title: 'Rule deleted', variant: 'success' })
      navigate('/agency/routing')
    } catch (err) {
      addToast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    }
  }

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-screen="AGN-ROU-002" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" />
      </div>
    )
  }

  if (!agent || loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-ROU-002" dir={dir}>
        <AlertTriangle className="mx-auto h-12 w-12 text-[var(--lc-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold">Admin access required</h1>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-screen="AGN-ROU-002" dir={dir}>
        <h1 className="text-2xl font-bold">Rule not found</h1>
        <Link to="/agency/routing" className="mt-4 inline-block"><Button>Back to rules</Button></Link>
      </div>
    )
  }

  const targetStrategy = rule.target?.strategy || rule.strategy || 'round_robin'

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]" data-screen="AGN-ROU-002" dir={dir}>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link to="/agency/routing" className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]">
              <ArrowLeft className="h-4 w-4" />
              Routing rules
            </Link>
            <h1 className="text-3xl font-bold text-[var(--lc-text-heading)]">
              {isNew ? 'New routing rule' : 'Edit routing rule'}
            </h1>
          </div>
          <div className="flex gap-2">
            {!isNew && (
              <Button variant="outline" className="gap-2 text-red-700" onClick={() => void destroy()}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <Button className="gap-2" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="rule-name">Rule name</Label>
              <Input id="rule-name" value={rule.name || ''} onChange={(e) => setRule((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="rule-priority">Priority</Label>
              <Input id="rule-priority" type="number" value={rule.priority ?? 100} onChange={(e) => setRule((prev) => ({ ...prev, priority: Number(e.target.value) }))} />
            </div>
            <div>
              <Label htmlFor="rule-trigger">Trigger</Label>
              <select
                id="rule-trigger"
                aria-label="Trigger"
                value={rule.trigger || 'inquiry'}
                onChange={(e) => setRule((prev) => ({ ...prev, trigger: e.target.value as AgencyRoutingRule['trigger'] }))}
                className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              >
                {TRIGGERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={rule.enabled !== false} onChange={(e) => setRule((prev) => ({ ...prev, enabled: e.target.checked }))} />
              Rule active
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conditions</CardTitle>
            <CardDescription>All conditions must match unless you switch to match-any (future).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {conditions.map((condition, index) => (
              <div key={index} className="grid gap-2 rounded-md border border-[var(--lc-border)] p-3 sm:grid-cols-4">
                <select
                  aria-label={`Condition ${index + 1} field`}
                  value={condition.field}
                  onChange={(e) => updateCondition(index, { field: e.target.value as RoutingRuleCondition['field'] })}
                  className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-2 py-2 text-sm"
                >
                  {CONDITION_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                </select>
                <select
                  aria-label={`Condition ${index + 1} operator`}
                  value={condition.op}
                  onChange={(e) => updateCondition(index, { op: e.target.value as RoutingRuleCondition['op'] })}
                  className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-2 py-2 text-sm"
                >
                  <option value="eq">equals</option>
                  <option value="contains">contains</option>
                  <option value="gte">≥</option>
                  <option value="lte">≤</option>
                </select>
                <Input
                  aria-label={`Condition ${index + 1} value`}
                  value={condition.value}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                />
                <Button type="button" variant="outline" onClick={() => removeCondition(index)}>Remove</Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addCondition}>Add condition</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Target</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="rule-target">Assignment</Label>
              <select
                id="rule-target"
                aria-label="Assignment"
                value={targetStrategy}
                onChange={(e) => setRule((prev) => {
                  const strategy = e.target.value as AgencyRoutingRule['strategy']
                  const base = prev.target || emptyRule().target!
                  return {
                    ...prev,
                    strategy,
                    target: { ...base, strategy },
                  }
                })}
                className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              >
                {TARGETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            {targetStrategy === 'manual' && (
              <div className="sm:col-span-2">
                <Label htmlFor="assign-agent">Assign to agent</Label>
                <select
                  id="assign-agent"
                  aria-label="Assign to agent"
                  value={rule.target?.assign_to_agent_id || ''}
                  onChange={(e) => setRule((prev) => {
                    const base = prev.target || emptyRule().target!
                    return {
                      ...prev,
                      target: { ...base, strategy: 'manual', assign_to_agent_id: e.target.value || null },
                    }
                  })}
                  className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                >
                  <option value="">Select agent</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </div>
            )}
            {targetStrategy === 'weighted' && (
              <div className="sm:col-span-2">
                <Label htmlFor="language-skill">Language skill</Label>
                <Input
                  id="language-skill"
                  value={rule.target?.language || ''}
                  onChange={(e) => setRule((prev) => {
                    const base = prev.target || emptyRule().target!
                    return {
                      ...prev,
                      target: { ...base, strategy: 'weighted', language: e.target.value || null },
                    }
                  })}
                  placeholder="e.g. ar, en"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
