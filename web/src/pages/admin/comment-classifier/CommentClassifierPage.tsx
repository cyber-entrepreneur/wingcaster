/**
 * PA-CLS-001 — Comment classifier admin (config + manual run + history).
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useAuth } from '@/context/AuthContext'
import { useStepUp } from '@/context/StepUpContext'
import { useToast } from '@/components/ui/toast'

interface CategoryMeta {
  label: string
  emoji: string
  description: string
  route: string
}

interface ClassifierConfig {
  categories: string[]
  sentiments: string[]
  meta: Record<string, CategoryMeta>
  operational?: {
    batch_size?: number
    ai_enabled?: boolean
    ai_provider?: string | null
    rules_confidence_threshold?: number
  }
}

interface ClassifierRun {
  id: string
  triggered_by_agent_id?: string | null
  batched: number
  updated_count: number
  skipped_reason?: string | null
  error_message?: string | null
  created_at: string
}

export function CommentClassifierPage() {
  const { isAdmin } = useAuth()
  const { runElevated } = useStepUp()
  const { addToast } = useToast()

  const [config, setConfig] = useState<ClassifierConfig | null>(null)
  const [runs, setRuns] = useState<ClassifierRun[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, history] = await Promise.all([
        api.getCommentClassifierConfig(),
        api.listCommentClassifierRuns({ limit: '20' }),
      ])
      setConfig(cfg)
      setRuns(history.runs || [])
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to load classifier admin',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (!isAdmin) return
    void reload()
  }, [isAdmin, reload])

  async function runNow() {
    setRunning(true)
    try {
      const result = await runElevated(
        () => api.runCommentClassifierBatch(),
        'Run comment classifier batch',
      )
      if (!result) return
      addToast({
        variant: 'success',
        title: 'Classifier run finished',
        description: result.skipped
          ? String(result.skipped)
          : `Updated ${String(result.updated ?? 0)} of ${String(result.batched ?? 0)} messages`,
      })
      await reload()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Classifier run failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setRunning(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader><CardTitle>Platform admin required</CardTitle></CardHeader>
          <CardContent className="text-sm text-[var(--lc-text-muted)]">
            Comment classifier admin is restricted to platform admins.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Comment classifier</h1>
          <p className="text-sm text-[var(--lc-text-muted)]">
            Review inbound social comment categories and trigger AI reclassification batches.
          </p>
        </div>
        <Button disabled={running || loading} onClick={() => void runNow()}>
          {running ? 'Running…' : 'Run now'}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Current config</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] px-3 py-2">
                <p>
                  Batch size:{' '}
                  <Numeric className="font-semibold">
                    {config?.operational?.batch_size ?? '—'}
                  </Numeric>
                </p>
                <p>
                  AI enabled:{' '}
                  <span className="font-semibold">
                    {config?.operational?.ai_enabled ? 'Yes' : 'No'}
                  </span>
                </p>
                <p>
                  Provider:{' '}
                  <span className="font-semibold">
                    {config?.operational?.ai_provider || '—'}
                  </span>
                </p>
                <p>
                  Rules confidence threshold:{' '}
                  <Numeric className="font-semibold">
                    {config?.operational?.rules_confidence_threshold ?? 0.6}
                  </Numeric>
                </p>
              </div>

              <p className="text-[var(--lc-text-muted)]">
                Categories and routing rules are code-defined. Changing them requires a deploy;
                after changes, run the classifier to re-process open general/low-confidence items.
              </p>

              <div className="max-h-80 space-y-2 overflow-auto">
                {(config?.categories || []).map((key) => {
                  const meta = config?.meta?.[key]
                  return (
                    <div
                      key={key}
                      className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-3 py-2"
                    >
                      <div className="font-medium">
                        {meta?.emoji ? `${meta.emoji} ` : ''}{meta?.label || key}
                      </div>
                      <div className="text-xs text-[var(--lc-text-muted)]">{meta?.description}</div>
                      <div className="text-xs font-mono text-[var(--lc-text-muted)]">{meta?.route}</div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Run history</CardTitle>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-sm text-[var(--lc-text-muted)]">No manual runs recorded yet.</p>
              ) : (
                <div className="max-h-[32rem] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--lc-surface-sunken)] text-start">
                      <tr>
                        <th className="px-2 py-2 font-medium">When</th>
                        <th className="px-2 py-2 font-medium">Batched</th>
                        <th className="px-2 py-2 font-medium">Updated</th>
                        <th className="px-2 py-2 font-medium">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => (
                        <tr key={run.id} className="border-t">
                          <td className="px-2 py-2">
                            {run.created_at ? new Date(run.created_at).toLocaleString() : '—'}
                          </td>
                          <td className="px-2 py-2"><Numeric>{run.batched}</Numeric></td>
                          <td className="px-2 py-2"><Numeric>{run.updated_count}</Numeric></td>
                          <td className="px-2 py-2 text-[var(--lc-text-muted)]">
                            {run.error_message
                              ? `Error: ${run.error_message}`
                              : run.skipped_reason
                                ? `Skipped: ${run.skipped_reason}`
                                : 'Completed'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default CommentClassifierPage
