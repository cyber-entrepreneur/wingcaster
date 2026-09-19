/**
 * PA-ACC-002 — Accounting period detail (close checklist + actions).
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinAdminGate } from './shell'

type Checklist = {
  period_ended?: boolean
  invoices_generated?: boolean
  reconciliation_complete?: boolean
  drift_resolved?: boolean
  approvals_cleared?: boolean
  unresolved_drift_count?: number
  blocking_drift_count?: number
  ready_for_soft_close?: boolean
  ready_for_hard_close?: boolean
  ready_for_reopen?: boolean
}

type AccountingPeriodDetail = {
  id?: string
  period_key?: string
  status?: string
  starts_at?: string
  ends_at?: string
  closed_at?: string | null
  legal_entity_id?: string
  checklist?: Checklist
}

function ChecklistRow({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--lc-border)] py-2 last:border-b-0">
      <span>{label}</span>
      <Badge variant={ok ? 'secondary' : 'destructive'}>{ok ? 'Complete' : 'Blocked'}</Badge>
    </div>
  )
}

export function AccountingPeriodDetailPage() {
  const { id } = useParams()
  const { addToast } = useToast()
  const [period, setPeriod] = useState<AccountingPeriodDetail | null>(null)
  const [approvalId, setApprovalId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  function reload() {
    if (!id) return
    setLoading(true)
    void api.finGet(`/accounting/periods/${id}`)
      .then((body) => setPeriod((body.period || null) as AccountingPeriodDetail | null))
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load accounting period',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [id])

  async function act(path: string, label: string, body: Record<string, unknown> = {}) {
    if (!id) return
    setBusy(true)
    try {
      await api.finPost(`/accounting/periods/${id}${path}`, body)
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

  const checklist = period?.checklist

  return (
    <FinAdminGate title="Accounting period">
      <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
        Review the SOX close checklist for one legal-entity accounting period and run elevated close actions.
      </p>

      <div className="mb-4">
        <Link to="/admin/fin/accounting/periods" className="text-sm underline text-[var(--lc-text-muted)]">
          Back to accounting periods
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : !period ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Period not found.</p>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg">
                Period <Numeric>{String(period.period_key || period.id)}</Numeric>
              </CardTitle>
              <Badge variant="secondary">{String(period.status || 'unknown')}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p>Starts: <Numeric>{String(period.starts_at || '')}</Numeric></p>
              <p>Ends: <Numeric>{String(period.ends_at || '')}</Numeric></p>
              <p>Closed at: <Numeric>{String(period.closed_at || '—')}</Numeric></p>
              <p>Legal entity: <Numeric>{String(period.legal_entity_id || '')}</Numeric></p>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader><CardTitle className="text-lg">Close checklist</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <ChecklistRow label="Period ended" ok={checklist?.period_ended} />
              <ChecklistRow label="Invoices generated" ok={checklist?.invoices_generated} />
              <ChecklistRow label="Reconciliation complete" ok={checklist?.reconciliation_complete} />
              <ChecklistRow label="Drift resolved" ok={checklist?.drift_resolved} />
              <ChecklistRow label="Approvals cleared" ok={checklist?.approvals_cleared} />
              {typeof checklist?.unresolved_drift_count === 'number' ? (
                <p className="mt-3 text-[var(--lc-text-muted)]">
                  Unresolved drift items: <Numeric>{String(checklist.unresolved_drift_count)}</Numeric>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-end gap-3">
            <Button
              variant="outline"
              disabled={busy || !checklist?.ready_for_soft_close}
              onClick={() => void act('/soft-close', 'Soft close')}
            >
              Soft close
            </Button>
            <Button
              variant="outline"
              disabled={busy || !checklist?.ready_for_hard_close}
              onClick={() => void act('/hard-close', 'Hard close')}
            >
              Hard close
            </Button>
            <div>
              <label htmlFor="accounting-reopen-approval" className="text-xs text-[var(--lc-text-muted)]">
                Reopen approval id
              </label>
              <input
                id="accounting-reopen-approval"
                className="mt-1 block min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
                value={approvalId}
                onChange={(e) => setApprovalId(e.target.value)}
                placeholder="UUID"
              />
            </div>
            <Button
              variant="outline"
              disabled={busy || !checklist?.ready_for_reopen || !approvalId.trim()}
              onClick={() => void act('/reopen', 'Reopen', { approval_request_id: approvalId.trim() })}
            >
              Reopen
            </Button>
          </div>
        </>
      )}
    </FinAdminGate>
  )
}

export default AccountingPeriodDetailPage
