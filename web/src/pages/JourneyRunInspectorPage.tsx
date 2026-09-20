import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { api, type JourneyRunDetail } from '@/api/client'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * Journey run inspector — reconstructs a contact's path from node runs + transitions.
 */
export function JourneyRunInspectorPage() {
  const { runId } = useParams<{ runId: string }>()
  usePageTitle('Journey run')
  const [run, setRun] = useState<JourneyRunDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!runId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const detail = await api.getJourneyRun(runId)
        if (!cancelled) setRun(detail as JourneyRunDetail)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load run')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [runId])

  return (
    <CrmShell>
      <CmdPageHeader
        title="Run inspector"
        subtitle="Node-by-node path and transition reasons for this journey run."
        actions={
          <Link
            to="/journeys"
            className="inline-flex min-h-[var(--lc-tap-target-min)] items-center gap-2 text-sm text-[var(--lc-action-primary)]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to journeys
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl space-y-[var(--lc-space-lg)] px-[var(--lc-space-md)] pb-[var(--lc-space-xl)]">
        {loading && (
          <div className="flex items-center gap-2 text-[var(--lc-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading run…
          </div>
        )}
        {error && <p className="text-[var(--lc-status-danger)]">{error}</p>}

        {run && (
          <>
            <section className="space-y-1">
              <p className="text-sm text-[var(--lc-text-muted)]">Run</p>
              <p className="font-medium text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
                {run.id}
              </p>
              <p className="text-sm text-[var(--lc-text-secondary)]">
                Status: {run.status} · Contact: {run.contact_id}
              </p>
            </section>

            <section>
              <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="mb-3 text-[var(--lc-text-primary)]">
                Transitions
              </h2>
              <ol className="space-y-[var(--lc-space-sm)]">
                {(run.transitions || []).map((t) => (
                  <li
                    key={t.id}
                    className="border-b border-[var(--lc-border)] pb-[var(--lc-space-sm)]"
                  >
                    <div className="text-sm text-[var(--lc-text-primary)]">
                      <span className="font-medium">{t.from_node || '∅'}</span>
                      {' → '}
                      <span className="font-medium">{t.to_node || '∅'}</span>
                    </div>
                    <pre className="mt-1 overflow-auto text-[11px] text-[var(--lc-text-muted)]">
                      {JSON.stringify(t.reason, null, 2)}
                    </pre>
                  </li>
                ))}
                {!run.transitions?.length && (
                  <p className="text-sm text-[var(--lc-text-muted)]">No transitions recorded.</p>
                )}
              </ol>
            </section>

            <section>
              <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="mb-3 text-[var(--lc-text-primary)]">
                Node runs
              </h2>
              <ol className="space-y-[var(--lc-space-sm)]">
                {(run.node_runs || []).map((nr) => (
                  <li key={nr.id} className="border-b border-[var(--lc-border)] pb-[var(--lc-space-sm)]">
                    <div className="flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="font-semibold uppercase text-[var(--lc-text-muted)]">{nr.node_type}</span>
                      <span className="text-[var(--lc-text-primary)]">{nr.node_id}</span>
                      <span className="text-[var(--lc-text-muted)]">
                        {nr.occurred_at ? new Date(nr.occurred_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <pre className="mt-1 overflow-auto text-[11px] text-[var(--lc-text-muted)]">
                      {JSON.stringify(nr.result, null, 2)}
                    </pre>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </CrmShell>
  )
}
