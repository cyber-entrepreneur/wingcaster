/**
 * PA-DUN-003 — Advance dunning stage (manual exception action).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinAdminGate } from './shell'
import { dunningStageWarning, nextDunningStage } from './dunning-stage'

type DunningCaseDetail = {
  id?: string
  tenant_id?: string
  invoice_id?: string
  invoice_number?: string | null
  status?: string
}

export function AdvanceDunningStagePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [detail, setDetail] = useState<DunningCaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState('')
  const [reasonCode, setReasonCode] = useState('MANUAL_ADVANCE')

  useEffect(() => {
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
  }, [addToast, id])

  const target = useMemo(
    () => nextDunningStage(detail?.status),
    [detail?.status],
  )
  const warning = dunningStageWarning(target?.status)

  async function advance() {
    if (!id || !target) return
    setBusy(true)
    try {
      await api.finPost(`/dunning/cases/${id}/advance`, {
        reason_code: reasonCode.trim() || 'MANUAL_ADVANCE',
        notes: notes.trim() || undefined,
      })
      addToast({
        variant: 'success',
        title: 'Stage advanced',
        description: `${detail?.status || 'unknown'} → ${target.status}`,
      })
      navigate('/admin/fin/exceptions', { replace: true })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Advance failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <FinAdminGate title="Advance dunning stage">
      <div
        className="max-w-xl"
        data-screen="PA-DUN-003"
      >
        <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
          Manually move an open dunning case to the next stage in the progression chain.
        </p>

        <div className="mb-4">
          <Link to="/admin/fin/exceptions" className="text-sm underline text-[var(--lc-text-muted)]">
            Back to exceptions
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
        ) : !detail ? (
          <p className="text-sm text-[var(--lc-text-muted)]">Case not found.</p>
        ) : !target ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cannot advance</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--lc-text-muted)]">
              Case <Numeric>{String(detail.invoice_number || detail.id)}</Numeric> is in status{' '}
              <Numeric>{String(detail.status || 'unknown')}</Numeric> and has no further manual stage.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Case <Numeric>{String(detail.invoice_number || detail.id)}</Numeric>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-1 text-sm sm:grid-cols-2">
                <p>Current stage: <Numeric>{String(detail.status || 'unknown')}</Numeric></p>
                <p>Target stage: <Numeric>{target.status}</Numeric></p>
                <p>Tenant: <Numeric>{String(detail.tenant_id || '')}</Numeric></p>
                <p>Invoice: <Numeric>{String(detail.invoice_id || '')}</Numeric></p>
              </div>

              {warning ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                  {warning}
                </p>
              ) : null}

              <div>
                <Label htmlFor="dun-reason">Reason code</Label>
                <Input
                  id="dun-reason"
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                  placeholder="MANUAL_ADVANCE"
                />
              </div>

              <div>
                <Label htmlFor="dun-notes">Notes</Label>
                <textarea
                  id="dun-notes"
                  className="mt-1 min-h-24 w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional operator notes for the audit trail"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="button" disabled={busy} onClick={() => { void advance() }}>
                  {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                  Advance stage
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </FinAdminGate>
  )
}
