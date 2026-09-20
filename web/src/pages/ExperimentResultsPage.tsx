/**
 * Wave 2D — Experiment results dashboard.
 * Per-variant funnel + lift vs control + confidence; conclude promotes a winner.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Trophy } from 'lucide-react'
import {
  api,
  type Experiment,
  type ExperimentResults,
  type ExperimentVariantResult,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

function formatPct(rate: number | null | undefined) {
  if (rate == null || Number.isNaN(rate)) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

function formatLift(lift: number | null | undefined) {
  if (lift == null || Number.isNaN(lift)) return '—'
  const sign = lift > 0 ? '+' : ''
  return `${sign}${(lift * 100).toFixed(1)}%`
}

function confidenceLabel(row: ExperimentVariantResult) {
  const vs = row.vs_control
  if (!vs) return '—'
  if (vs.reason === 'insufficient_sample') return 'Insufficient sample'
  if (vs.confidence == null || vs.p_value == null) return 'Not computed'
  return `${(vs.confidence * 100).toFixed(1)}% (p=${vs.p_value.toFixed(4)})`
}

export function ExperimentResultsPage() {
  const { id } = useParams()
  const { addToast } = useToast()
  usePageTitle('Experiment results')

  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [results, setResults] = useState<ExperimentResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [concluding, setConcluding] = useState(false)
  const [winner, setWinner] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [exp, res] = await Promise.all([
        api.getExperiment(id),
        api.getExperimentResults(id),
      ])
      setExperiment(exp)
      setResults(res)
      const best = res.variants
        .filter((v) => !v.is_control && v.assigned > 0)
        .sort((a, b) => (b.conversion_rate || 0) - (a.conversion_rate || 0))[0]
      setWinner(res.winner_variant || best?.variant || '')
    } catch (err) {
      setError((err as Error).message || 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const onConclude = async () => {
    if (!id) return
    setConcluding(true)
    try {
      const outcome = await api.concludeExperiment(id, {
        winner_variant: winner || null,
      })
      setExperiment(outcome.experiment)
      setResults(outcome.results)
      addToast({
        title: 'Experiment concluded',
        description: outcome.results.winner_variant
          ? `Winner promoted: ${outcome.results.winner_variant}`
          : 'No winner promoted',
        variant: 'success',
      })
    } catch (err) {
      addToast({
        title: 'Conclude failed',
        description: (err as Error).message,
        variant: 'error',
      })
    } finally {
      setConcluding(false)
    }
  }

  if (loading) {
    return (
      <CrmShell>
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-[var(--lc-text-secondary)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading results…
        </div>
      </CrmShell>
    )
  }

  return (
    <CrmShell>
      <CmdPageHeader
        title="Experiment results"
        subtitle={
          experiment
            ? `${experiment.dimension} · goal ${experiment.goal_event} · ${experiment.status}`
            : 'Funnel outcomes per variant'
        }
        actions={
          <Button asChild variant="ghost">
            <Link to={id ? `/experiments/${id}` : '/experiments'}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />
      <div className="space-y-6 p-6">
        {error && (
          <p className="text-sm text-[var(--lc-status-danger-fg)]" role="alert">
            {error}
          </p>
        )}

        {results && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4">
                <p className="text-xs text-[var(--lc-text-secondary)]">Assignments</p>
                <p className="text-2xl font-semibold text-[var(--lc-text-primary)]">
                  {results.assignment_count}
                </p>
              </div>
              <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4">
                <p className="text-xs text-[var(--lc-text-secondary)]">Goal conversions</p>
                <p className="text-2xl font-semibold text-[var(--lc-text-primary)]">
                  {results.matched_conversions}
                </p>
              </div>
              <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4">
                <p className="text-xs text-[var(--lc-text-secondary)]">Control</p>
                <p className="text-2xl font-semibold text-[var(--lc-text-primary)]">
                  {results.control_variant || '—'}
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--lc-text-secondary)]">
              Method: {results.method}. Sequential / bandit significance:{' '}
              {results.sequential?.code || 'NOT_CONFIGURED'} — confidence is only shown when
              computed from a two-proportion z-test with adequate sample size.
            </p>

            <div className="overflow-x-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--lc-border)] text-[var(--lc-text-secondary)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Variant</th>
                    <th className="px-4 py-3 font-medium">Assigned</th>
                    <th className="px-4 py-3 font-medium">Conversions</th>
                    <th className="px-4 py-3 font-medium">Rate</th>
                    <th className="px-4 py-3 font-medium">Lift vs control</th>
                    <th className="px-4 py-3 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {results.variants.map((row) => (
                    <tr key={row.variant} className="border-b border-[var(--lc-border)] last:border-0">
                      <td className="px-4 py-3 text-[var(--lc-text-primary)]">
                        {row.variant}
                        {row.is_control ? (
                          <span className="ml-2 text-xs text-[var(--lc-text-secondary)]">control</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{row.assigned}</td>
                      <td className="px-4 py-3">{row.conversions}</td>
                      <td className="px-4 py-3">{formatPct(row.conversion_rate)}</td>
                      <td className="px-4 py-3">
                        {row.is_control ? '—' : formatLift(row.vs_control?.lift)}
                        {!row.is_control && row.vs_control?.significant_at_95 ? (
                          <span className="ml-2 text-xs text-[var(--lc-status-published-fg)]">sig.</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--lc-text-secondary)]">
                        {row.is_control ? '—' : confidenceLabel(row)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {experiment?.status !== 'concluded' && (
              <div className="flex flex-col gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label
                    className="mb-1 block text-sm font-medium text-[var(--lc-text-primary)]"
                    htmlFor="winner-variant"
                  >
                    Promote winner
                  </label>
                  <select
                    id="winner-variant"
                    className="w-full rounded-[var(--lc-radius-sm)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)]"
                    value={winner}
                    onChange={(e) => setWinner(e.target.value)}
                  >
                    <option value="">No winner</option>
                    {results.variants
                      .filter((v) => !v.is_control)
                      .map((v) => (
                        <option key={v.variant} value={v.variant}>
                          {v.variant} ({formatPct(v.conversion_rate)})
                        </option>
                      ))}
                  </select>
                </div>
                <Button type="button" onClick={onConclude} disabled={concluding}>
                  <Trophy className="mr-2 h-4 w-4" />
                  {concluding ? 'Concluding…' : 'Conclude experiment'}
                </Button>
              </div>
            )}

            {experiment?.status === 'concluded' && results.winner_variant && (
              <p className="text-sm text-[var(--lc-text-primary)]">
                Concluded — winner: <strong>{results.winner_variant}</strong>
              </p>
            )}
          </>
        )}
      </div>
    </CrmShell>
  )
}
