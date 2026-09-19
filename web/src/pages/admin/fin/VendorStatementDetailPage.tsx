import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { FinAdminGate } from './shell'
import { ReconcileVendorStatementDialog } from './ReconcileVendorStatementDialog'
import { vendorApi } from './vendor-api'

type StatementSummary = {
  statement_period_key?: string
  status?: string
  total_minor?: number | string
  unresolved_variance_count?: number
  currency?: string
}

type StatementRow = Record<string, unknown>
type LineItem = Record<string, unknown>
type DriftRow = Record<string, unknown>

function minor(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function statusVariant(status: string) {
  if (status === 'FINALIZED') return 'default'
  if (status === 'RECONCILED') return 'secondary'
  if (status === 'RECEIVED') return 'outline'
  return 'destructive'
}

export function VendorStatementDetailPage() {
  const { vendorId = '', month = '' } = useParams()
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reconcileOpen, setReconcileOpen] = useState(false)

  const reload = useCallback(() => {
    if (!vendorId || !month) {
      setLoading(false)
      setError('Missing vendor or statement month.')
      return
    }
    setLoading(true)
    setError(null)
    void vendorApi.getStatement(vendorId, month)
      .then((body) => setPayload(body))
      .catch(() => {
        setPayload(null)
        setError('Could not load vendor statement.')
      })
      .finally(() => setLoading(false))
  }, [vendorId, month])

  useEffect(() => { reload() }, [reload])

  const statement = (payload?.statement || null) as StatementRow | null
  const lineItems = (payload?.line_items || []) as LineItem[]
  const driftIndicators = (payload?.drift_indicators || []) as DriftRow[]

  const totals = useMemo(() => {
    const invoiced = minor(statement?.total_minor)
    const expected = lineItems.reduce((sum, row) => sum + minor(row.amount_minor), 0)
    return {
      invoiced,
      expected,
      delta: invoiced - expected,
      currency: String(statement?.currency || ''),
    }
  }, [statement, lineItems])

  const unresolvedCount = Number(statement?.unresolved_variance_count || 0)
  const status = String(statement?.status || '')
  const canReconcile = ['RECEIVED', 'RECONCILED'].includes(status)

  if (loading) {
    return (
      <FinAdminGate title="Vendor statement">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading statement…
        </div>
      </FinAdminGate>
    )
  }

  if (error || !statement) {
    return (
      <FinAdminGate title="Vendor statement">
        <p className="text-sm text-red-600" role="alert">{error || 'Statement not found.'}</p>
        <Link
          to="/admin/fin/vendor-costs"
          className="mt-3 inline-block text-sm text-muted-foreground hover:underline"
        >
          Back to vendor costs
        </Link>
      </FinAdminGate>
    )
  }

  return (
    <FinAdminGate title="Vendor statement">
      <Link
        to="/admin/fin/vendor-costs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to vendor costs
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(status)}>{status || 'UNKNOWN'}</Badge>
        {unresolvedCount > 0 ? (
          <Badge variant="destructive">
            <Numeric>{unresolvedCount}</Numeric> unresolved drift
          </Badge>
        ) : (
          <Badge variant="default">No unresolved drift</Badge>
        )}
      </div>

      {unresolvedCount > 0 ? (
        <Card className="mb-4 border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700" role="alert">
            Statement has out-of-tolerance drift on{' '}
            <Numeric>{unresolvedCount}</Numeric> axis
            {unresolvedCount === 1 ? '' : 'es'}. Review variances before finalizing.
          </CardContent>
        </Card>
      ) : null}

      <dl className="mb-6 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><span className="text-muted-foreground">Month:</span> {month}</div>
        <div>
          <span className="text-muted-foreground">Expected total:</span>{' '}
          <Numeric>{totals.expected}</Numeric> {totals.currency}
        </div>
        <div>
          <span className="text-muted-foreground">Invoiced total:</span>{' '}
          <Numeric>{totals.invoiced}</Numeric> {totals.currency}
        </div>
        <div>
          <span className="text-muted-foreground">Delta:</span>{' '}
          <Numeric>{totals.delta}</Numeric> {totals.currency}
        </div>
      </dl>

      <div className="mb-6 flex flex-wrap gap-2">
        {canReconcile ? (
          <Button size="sm" onClick={() => setReconcileOpen(true)}>
            Reconcile statement
          </Button>
        ) : null}
        <Button size="sm" variant="outline" asChild>
          <Link to="/admin/fin/exceptions">Flag anomaly</Link>
        </Button>
      </div>

      <ReconcileVendorStatementDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        vendorId={vendorId}
        month={month}
        statement={statement as StatementSummary}
        onReconciled={reload}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lineItems.length ? (
            <table className="w-full text-sm">
              <thead className="bg-[var(--lc-surface-sunken)] text-left">
                <tr>
                  {['rate_key', 'quantity_units', 'unit_cost_minor', 'amount_minor', 'variance'].map((col) => (
                    <th key={col} className="px-3 py-2 font-medium">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((row, idx) => {
                  const variance = driftIndicators.find((drift) => {
                    const details = drift.details as Record<string, unknown> | undefined
                    return details?.product_code === row.rate_key || drift.axis === row.rate_key
                  })
                  return (
                    <tr key={String(row.rate_key || idx)} className="border-t">
                      <td className="px-3 py-2">{String(row.rate_key ?? '')}</td>
                      <td className="px-3 py-2"><Numeric>{String(row.quantity_units ?? '')}</Numeric></td>
                      <td className="px-3 py-2"><Numeric>{String(row.unit_cost_minor ?? '')}</Numeric></td>
                      <td className="px-3 py-2"><Numeric>{String(row.amount_minor ?? '')}</Numeric></td>
                      <td className="px-3 py-2">
                        {variance ? (
                          <span className="text-red-600">
                            {String(variance.reason_code || variance.axis || 'drift')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">No line items.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drift indicators</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {driftIndicators.length ? (
            <table className="w-full text-sm">
              <thead className="bg-[var(--lc-surface-sunken)] text-left">
                <tr>
                  {['axis', 'reason_code', 'left_qty', 'right_qty', 'resolved'].map((col) => (
                    <th key={col} className="px-3 py-2 font-medium">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {driftIndicators.map((row, idx) => (
                  <tr key={String(row.axis || idx)} className="border-t">
                    <td className="px-3 py-2">{String(row.axis ?? '')}</td>
                    <td className="px-3 py-2">{String(row.reason_code ?? '')}</td>
                    <td className="px-3 py-2"><Numeric>{String(row.left_qty ?? '')}</Numeric></td>
                    <td className="px-3 py-2"><Numeric>{String(row.right_qty ?? '')}</Numeric></td>
                    <td className="px-3 py-2">{row.resolved ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">No drift indicators.</p>
          )}
        </CardContent>
      </Card>
    </FinAdminGate>
  )
}
