/**
 * Wave 2D — Experiment list.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { usePageTitle } from '@/lib/usePageTitle'
import { api, type Experiment } from '@/api/client'

export function ExperimentsPage() {
  usePageTitle('Experiments')
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getExperiments()
      .then((res) => setExperiments(res.experiments || []))
      .catch((err) => setError((err as Error).message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <CrmShell>
      <CmdPageHeader
        title="Experiments"
        subtitle="A/B/n tests on creative, copy, CTA, channel, timing, and journey path — measured by funnel outcomes."
        actions={
          <Button asChild>
            <Link to="/experiments/new">
              <Plus className="mr-2 h-4 w-4" /> New experiment
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        {loading ? (
          <p className="text-sm text-[var(--lc-text-secondary)]">Loading experiments…</p>
        ) : error ? (
          <p className="text-sm text-[var(--lc-status-danger-fg)]" role="alert">
            {error}
          </p>
        ) : experiments.length === 0 ? (
          <div className="rounded-[var(--lc-radius-md)] border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface)] p-8 text-center">
            <FlaskConical className="mx-auto mb-3 h-8 w-8 text-[var(--lc-text-secondary)]" />
            <p className="text-sm text-[var(--lc-text-secondary)]">
              No experiments yet. Create one to test what drives the funnel.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--lc-border)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)]">
            {experiments.map((exp) => (
              <li key={exp.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link
                    to={`/experiments/${exp.id}`}
                    className="font-medium text-[var(--lc-text-primary)] hover:underline"
                  >
                    {exp.dimension} · {exp.goal_event}
                  </Link>
                  <p className="text-xs text-[var(--lc-text-secondary)]">
                    {exp.status} · {exp.allocation} · {exp.variants?.length ?? 0} variants · holdout{' '}
                    {exp.holdout_pct}%
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/experiments/${exp.id}`}>Edit</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/experiments/${exp.id}/results`}>Results</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CrmShell>
  )
}
