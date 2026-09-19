/**
 * PA-DUN-002 — Dunning case detail (timeline + manual resolution actions).
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinAdminGate, FinTable } from './shell'

type DunningStep = {
  id?: string
  step_kind?: string
  entered_at?: string
  completed_at?: string | null
  outcome?: string | null
  reason_code?: string | null
}

type DunningCaseDetail = {
  id?: string
  tenant_id?: string
  billing_account_id?: string
  invoice_id?: string
  status?: string
  reason_code?: string
  invoice_number?: string | null
  total_minor?: string | number | null
  due_at?: string | null
  invoice_status?: string | null
  created_at?: string
  updated_at?: string
  steps?: DunningStep[]
}

export function DunningCaseDetailPage() {
  const { id } = useParams()
  const { addToast } = useToast()
  const [detail, setDetail] = useState<DunningCaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  function reload() {
    if (!id) return
    setLoading(true)
    void api.finGet(`/dunning/cases/${id}`)
      .then((body) => setDetail((body.case || null) as DunningCaseDetail | null))
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load dunning case',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [id])

  async function act(path: string, label: string) {
    if (!id) return
    setBusy(true)
    try {
      await api.finPost(`/dunning/cases/${id}${path}`)
      addToast({ variant: 'success', title: `${label} completed` })
      reload()
    } catch (err) {
      addToast({
        variant: 'error',
        title: `${label} failed`,
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const steps = detail?.steps || []

  return (
    <FinAdminGate title="Dunning case">
      <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
        Review one past-due invoice case, its step timeline, and manual exception actions.
      </p>

      <div className="mb-4">
        <Link to="/admin/fin/dunning" className="text-sm underline text-[var(--lc-text-muted)]">
          Back to dunning cases
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : !detail ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Case not found.</p>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg">
                Case <Numeric>{String(detail.invoice_number || detail.id)}</Numeric>
              </CardTitle>
              <Badge variant="secondary">{String(detail.status || 'unknown')}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p>Tenant: <Numeric>{String(detail.tenant_id || '')}</Numeric></p>
              <p>Invoice: <Numeric>{String(detail.invoice_id || '')}</Numeric></p>
              <p>Invoice status: <Numeric>{String(detail.invoice_status || 'unknown')}</Numeric></p>
              <p>Amount due: <Numeric>{String(detail.total_minor ?? '')}</Numeric></p>
              <p>Due at: <Numeric>{String(detail.due_at || '')}</Numeric></p>
              <p>Opened: <Numeric>{String(detail.created_at || '')}</Numeric></p>
            </CardContent>
          </Card>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void act('/advance', 'Advance stage')}>
              Advance stage
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void act('/cure', 'Cure case')}>
              Cure case
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void act('/write-off', 'Write off')}>
              Write off
            </Button>
          </div>

          <h2 className="mb-2 text-lg font-semibold">Timeline</h2>
          {steps.length ? (
            <FinTable
              columns={['step_kind', 'entered_at', 'completed_at', 'outcome', 'reason_code']}
              rows={steps as Array<Record<string, unknown>>}
            />
          ) : (
            <p className="text-sm text-[var(--lc-text-muted)]">No steps recorded yet.</p>
          )}
        </>
      )}
    </FinAdminGate>
  )
}

export default DunningCaseDetailPage
