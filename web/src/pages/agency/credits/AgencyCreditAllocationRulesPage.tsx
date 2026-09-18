import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Loader2, Percent, Save, Users } from 'lucide-react'
import {
  api,
  type AgencyCreditAllocationAgent,
  type AgencyCreditAllocationMode,
  type AgencyCreditAllocationOverride,
  type AgencyCreditAllocationRules,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

const MODE_OPTIONS: Array<{ value: AgencyCreditAllocationMode; label: string; description: string }> = [
  {
    value: 'manual',
    label: 'Manual per top-up',
    description: 'Allocate credits yourself after each top-up. No standing automation.',
  },
  {
    value: 'percentage',
    label: 'Automatic percentage',
    description: 'Split each future top-up by percentage. Remaining credits stay in the shared pool.',
  },
  {
    value: 'cap_per_agent',
    label: 'Automatic cap per agent',
    description: 'Cap how much each agent can receive from future top-ups.',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Combine percentage splits with per-agent caps for fine-grained control.',
  },
]

function emptyOverride(agent: AgencyCreditAllocationAgent): AgencyCreditAllocationOverride {
  return {
    agent_user_id: agent.user_id,
    agent_name: agent.name,
    percentage: null,
    cap_usd: null,
  }
}

function mergeOverrides(
  agents: AgencyCreditAllocationAgent[],
  saved: AgencyCreditAllocationOverride[],
): AgencyCreditAllocationOverride[] {
  const byId = new Map(saved.map((row) => [row.agent_user_id, row]))
  return agents.map((agent) => byId.get(agent.user_id) || emptyOverride(agent))
}

export function AgencyCreditAllocationRulesPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('Allocation rules')

  const affiliation =
    (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const role = affiliation?.role || null
  const isAdmin = role === 'owner' || role === 'admin'

  const [loadState, setLoadState] = useState<LoadState>(isAdmin ? 'loading' : 'forbidden')
  const [agents, setAgents] = useState<AgencyCreditAllocationAgent[]>([])
  const [savedRules, setSavedRules] = useState<AgencyCreditAllocationRules | null>(null)
  const [mode, setMode] = useState<AgencyCreditAllocationMode>('manual')
  const [overrides, setOverrides] = useState<AgencyCreditAllocationOverride[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const { rules, agents: loadedAgents } = await api.getAgencyCreditAllocationRules()
      setSavedRules(rules)
      setAgents(loadedAgents)
      setMode(rules.mode)
      setOverrides(mergeOverrides(loadedAgents, rules.overrides))
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) setLoadState('forbidden')
      else setLoadState('error')
    }
  }, [isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  const percentageTotal = useMemo(
    () =>
      overrides.reduce((sum, row) => {
        const value = row.percentage == null ? 0 : Number(row.percentage)
        return sum + (Number.isFinite(value) ? value : 0)
      }, 0),
    [overrides],
  )
  const sharedPool = Math.max(0, 100 - percentageTotal)
  const showPercentage = mode === 'percentage' || mode === 'hybrid'
  const showCap = mode === 'cap_per_agent' || mode === 'hybrid'
  const percentageInvalid = showPercentage && percentageTotal > 100

  const dirty = useMemo(() => {
    if (!savedRules) return false
    if (mode !== savedRules.mode) return true
    const savedById = new Map(savedRules.overrides.map((row) => [row.agent_user_id, row]))
    return overrides.some((row) => {
      const saved = savedById.get(row.agent_user_id)
      if (!saved) {
        return row.percentage != null || row.cap_usd != null
      }
      return row.percentage !== saved.percentage || row.cap_usd !== saved.cap_usd
    })
  }, [mode, overrides, savedRules])

  function updateOverride(agentUserId: string, patch: Partial<AgencyCreditAllocationOverride>) {
    setOverrides((prev) =>
      prev.map((row) => (row.agent_user_id === agentUserId ? { ...row, ...patch } : row)),
    )
  }

  async function save() {
    if (!dirty || percentageInvalid) return
    setSaving(true)
    try {
      const payloadOverrides = overrides
        .filter((row) => {
          if (mode === 'manual') return false
          if (mode === 'percentage') return row.percentage != null
          if (mode === 'cap_per_agent') return row.cap_usd != null
          return row.percentage != null || row.cap_usd != null
        })
        .map((row) => ({
          agent_user_id: row.agent_user_id,
          percentage: showPercentage ? row.percentage : null,
          cap_usd: showCap ? row.cap_usd : null,
        }))

      const { rules } = await api.updateAgencyCreditAllocationRules({
        mode,
        overrides: payloadOverrides,
      })
      setSavedRules(rules)
      setOverrides(mergeOverrides(agents, rules.overrides))
      addToast({
        variant: 'success',
        title: 'Allocation rules saved',
        description: 'Future top-ups will follow these rules. Existing balances are unchanged.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save allocation rules.'
      addToast({ variant: 'error', title: 'Save failed', description: message })
    } finally {
      setSaving(false)
    }
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-[960px] p-[var(--lc-space-lg)]" data-screen="AGN-CRD-004">
        <h1
          className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-2)' }}
        >
          Allocation rules
        </h1>
        <p className="text-[var(--lc-text-secondary)]">
          Only agency owners and admins can view or change credit allocation rules.
        </p>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      <div className="mx-auto max-w-[960px] p-[var(--lc-space-lg)]" data-screen="AGN-CRD-004">
        <div
          aria-busy="true"
          className="h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
        />
        <p className="sr-only">Loading allocation rules…</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-[960px] p-[var(--lc-space-lg)]" data-screen="AGN-CRD-004">
        <div
          role="alert"
          className="mb-[var(--lc-space-md)] flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-danger-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-danger-fg)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Could not load allocation rules. Try again.</p>
        </div>
        <Button type="button" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div
      className="mx-auto max-w-[960px] space-y-[var(--lc-space-lg)] p-[var(--lc-space-lg)] pb-[var(--lc-space-3xl)]"
      data-screen="AGN-CRD-004"
    >
      <header className="space-y-[var(--lc-space-sm)]">
        <Link
          to="/agency/credits"
          className="inline-flex items-center gap-[var(--lc-space-xs)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)] hover:text-[var(--lc-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to credits
        </Link>
        <div>
          <h1
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
          >
            Allocation rules
          </h1>
          <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
            Standing rules for how future top-ups are distributed across agents. Existing balances
            stay as they are.
          </p>
        </div>
      </header>

      <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
        <h2
          className="mb-[var(--lc-space-md)] text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-3)' }}
        >
          Allocation mode
        </h2>
        <div className="space-y-[var(--lc-space-sm)]">
          {MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-[var(--lc-space-md)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] hover:bg-[var(--lc-surface-sunken)]"
            >
              <input
                type="radio"
                name="allocation-mode"
                className="mt-1 h-4 w-4 accent-[var(--lc-action-primary)]"
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
              />
              <span>
                <span className="block font-medium text-[var(--lc-text-heading)]">{option.label}</span>
                <span className="mt-[var(--lc-space-2xs)] block text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {mode !== 'manual' ? (
        <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
          <div className="mb-[var(--lc-space-md)] flex flex-wrap items-center justify-between gap-[var(--lc-space-sm)]">
            <div className="flex items-center gap-[var(--lc-space-sm)]">
              <Users className="h-5 w-5 text-[var(--lc-text-muted)]" aria-hidden />
              <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                Per-agent overrides
              </h2>
            </div>
            {showPercentage ? (
              <div className="flex items-center gap-[var(--lc-space-xs)] text-[length:var(--lc-type-body-sm)]">
                <Percent className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden />
                <span>
                  Allocated: <Numeric>{percentageTotal.toFixed(1)}</Numeric>% · Shared pool:{' '}
                  <Numeric>{sharedPool.toFixed(1)}</Numeric>%
                </span>
              </div>
            ) : null}
          </div>

          {percentageInvalid ? (
            <div
              role="alert"
              className="mb-[var(--lc-space-md)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-danger-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-danger-fg)]"
            >
              Percentage overrides must sum to 100% or less. Reduce allocations before saving.
            </div>
          ) : null}

          {agents.length === 0 ? (
            <p className="text-[var(--lc-text-secondary)]">
              No active agents yet. Invite team members before setting allocation overrides.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[length:var(--lc-type-body-sm)]">
                <thead>
                  <tr className="border-b border-[var(--lc-border)] text-start text-[var(--lc-text-muted)]">
                    <th className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)] font-medium">Agent</th>
                    {showPercentage ? (
                      <th className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)] font-medium">
                        Percentage
                      </th>
                    ) : null}
                    {showCap ? (
                      <th className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)] font-medium">
                        Cap (USD)
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((row) => (
                    <tr key={row.agent_user_id} className="border-b border-[var(--lc-border)]">
                      <td className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">
                        <div className="font-medium text-[var(--lc-text-heading)]">{row.agent_name}</div>
                        <div className="text-[var(--lc-text-muted)]">{row.agent_user_id}</div>
                      </td>
                      {showPercentage ? (
                        <td className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">
                          <Label className="sr-only" htmlFor={`pct-${row.agent_user_id}`}>
                            Percentage for {row.agent_name}
                          </Label>
                          <Input
                            id={`pct-${row.agent_user_id}`}
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            inputMode="decimal"
                            value={row.percentage ?? ''}
                            onChange={(event) => {
                              const raw = event.target.value
                              updateOverride(row.agent_user_id, {
                                percentage: raw === '' ? null : Number.parseFloat(raw),
                              })
                            }}
                            className="w-28"
                          />
                        </td>
                      ) : null}
                      {showCap ? (
                        <td className="px-[var(--lc-space-sm)] py-[var(--lc-space-sm)]">
                          <Label className="sr-only" htmlFor={`cap-${row.agent_user_id}`}>
                            Cap for {row.agent_name}
                          </Label>
                          <Input
                            id={`cap-${row.agent_user_id}`}
                            type="number"
                            min={0}
                            step={0.01}
                            inputMode="decimal"
                            value={row.cap_usd ?? ''}
                            onChange={(event) => {
                              const raw = event.target.value
                              updateOverride(row.agent_user_id, {
                                cap_usd: raw === '' ? null : Number.parseFloat(raw),
                              })
                            }}
                            className="w-32"
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-[var(--lc-space-sm)]">
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          {savedRules?.is_default
            ? 'Default rules — manual allocation until you save a standing policy.'
            : savedRules?.updated_at
              ? `Last saved ${new Date(savedRules.updated_at).toLocaleString()}.`
              : null}
        </p>
        <Button
          type="button"
          size="lg"
          disabled={!dirty || saving || percentageInvalid}
          onClick={() => void save()}
        >
          {saving ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            <>
              <Save className="me-2 h-4 w-4" aria-hidden />
              Save rules
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
