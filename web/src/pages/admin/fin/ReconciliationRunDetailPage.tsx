import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { FinAdminGate, FinTable } from './shell'

type ReconCheck = Record<string, unknown>
type ReconDrift = Record<string, unknown>

function resultVariant(result: string) {
  if (result === 'GREEN') return 'default'
  if (result === 'DRIFT') return 'destructive'
  return 'outline'
}

function formatJson(value: unknown) {
  if (value == null || value === '') return '—'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function ReconciliationRunDetailPage() {
  const { id = '' } = useParams()
  const [run, setRun] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('Missing run id.')
      return
    }
    setLoading(true)
    setError(null)
    void api.finGet(`/reconciliation/runs/${id}`)
      .then((body) => setRun(body))
      .catch(() => {
        setRun(null)
        setError('Could not load reconciliation run.')
      })
      .finally(() => setLoading(false))
  }, [id])

  const checks = (run?.checks || []) as ReconCheck[]
  const drifts = (run?.drifts || []) as ReconDrift[]

  const summary = useMemo(() => ({
    green: checks.filter((row) => row.result === 'GREEN').length,
    drift: checks.filter((row) => row.result === 'DRIFT').length,
    error: checks.filter((row) => row.result === 'ERROR').length,
  }), [checks])

  if (loading) {
    return (
      <FinAdminGate title="Reconciliation run">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading run…
        </div>
      </FinAdminGate>
    )
  }

  if (error || !run) {
    return (
      <FinAdminGate title="Reconciliation run">
        <p className="text-sm text-red-600" role="alert">{error || 'Run not found.'}</p>
        <Link to="/admin/fin/reconciliation" className="mt-3 inline-block text-sm text-muted-foreground hover:underline">
          Back to reconciliation runs
        </Link>
      </FinAdminGate>
    )
  }

  return (
    <FinAdminGate title="Reconciliation run">
      <Link
        to="/admin/fin/reconciliation"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to runs
      </Link>

      <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><span className="text-muted-foreground">Run id:</span> {String(run.id || id)}</div>
        <div><span className="text-muted-foreground">Status:</span> {String(run.status || '')}</div>
        <div><span className="text-muted-foreground">Scope:</span> {String(run.scope || '')}</div>
        <div><span className="text-muted-foreground">Schedule:</span> {String(run.schedule_kind || '')}</div>
        <div><span className="text-muted-foreground">Started:</span> {String(run.started_at || '')}</div>
        <div><span className="text-muted-foreground">Finished:</span> {String(run.finished_at || '—')}</div>
      </dl>

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="default"><Numeric>{summary.green}</Numeric> green</Badge>
        <Badge variant="destructive"><Numeric>{summary.drift}</Numeric> drift</Badge>
        <Badge variant="outline"><Numeric>{summary.error}</Numeric> error</Badge>
        <Badge variant="secondary"><Numeric>{drifts.length}</Numeric> drift items</Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Checks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {checks.length ? (
            <table className="w-full text-sm">
              <thead className="bg-[var(--lc-surface-sunken)] text-left">
                <tr>
                  {['check_code', 'severity', 'result', 'observed_delta_units', 'drift_action'].map((col) => (
                    <th key={col} className="px-3 py-2 font-medium">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checks.map((row) => (
                  <tr key={String(row.id || row.check_code)} className="border-t">
                    <td className="px-3 py-2 font-medium">{String(row.check_code || '')}</td>
                    <td className="px-3 py-2">{String(row.severity || '')}</td>
                    <td className="px-3 py-2">
                      <Badge variant={resultVariant(String(row.result || ''))}>
                        {String(row.result || '')}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {row.observed_delta_units == null ? '—' : <Numeric>{String(row.observed_delta_units)}</Numeric>}
                    </td>
                    <td className="px-3 py-2">{String(row.drift_action || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">No checks recorded for this run.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drift items</CardTitle>
        </CardHeader>
        <CardContent>
          {drifts.length ? (
            <FinTable
              columns={['check_code', 'entity_type', 'entity_id', 'expected', 'actual', 'delta', 'resolved_at']}
              rows={drifts.map((row) => ({
                ...row,
                check_code: checks.find((check) => check.id === row.check_id)?.check_code || row.check_id,
                expected: formatJson(row.expected),
                actual: formatJson(row.actual),
                delta: formatJson(row.delta),
                resolved_at: row.resolved_at || '—',
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No drift items for this run.</p>
          )}
        </CardContent>
      </Card>
    </FinAdminGate>
  )
}
