/**
 * PA-DUN-005 — Write off dunning case (destructive + approval).
 */
import { useEffect, useState } from 'react'
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

type DunningCaseDetail = {
  id?: string
  tenant_id?: string
  invoice_id?: string
  invoice_number?: string | null
  invoice_status?: string | null
  total_minor?: string | number | null
  status?: string
}

const REASON_OPTIONS = [
  { value: 'BAD_DEBT', label: 'Bad debt' },
  { value: 'FRAUD', label: 'Fraud' },
  { value: 'REGULATORY', label: 'Regulatory' },
  { value: 'OTHER', label: 'Other' },
] as const

export function WriteOffDunningCasePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [detail, setDetail] = useState<DunningCaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [amountMinor, setAmountMinor] = useState('')
  const [reasonCategory, setReasonCategory] = useState<(typeof REASON_OPTIONS)[number]['value']>('BAD_DEBT')
  const [evidence, setEvidence] = useState('')
  const [reasonCode, setReasonCode] = useState('WRITE_OFF_REQUEST')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    void api.finGet(`/dunning/cases/${id}`)
      .then((body) => {
        const dunningCase = (body.case || null) as DunningCaseDetail | null
        setDetail(dunningCase)
        if (dunningCase?.total_minor != null) {
          setAmountMinor(String(dunningCase.total_minor))
        }
      })
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load dunning case',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }, [addToast, id])

  const needsReviewStage = detail?.status !== 'WRITE_OFF_REVIEW'

  async function submitForApproval() {
    if (!id || !amountMinor.trim() || !evidence.trim()) return
    setBusy(true)
    try {
      const result = await api.finPost(`/dunning/cases/${id}/write-off/request`, {
        reason_code: reasonCode.trim() || 'WRITE_OFF_REQUEST',
        amount_minor: amountMinor.trim(),
        reason_category: reasonCategory,
        evidence: evidence.trim(),
      })
      addToast({
        variant: 'success',
        title: 'Write-off submitted for approval',
        description: String(result.approvalRequestId || result.approval_request_id || ''),
      })
      navigate('/admin/fin/approvals', { replace: true })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Submit failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <FinAdminGate title="Write off dunning case">
      <div className="max-w-xl" data-screen="PA-DUN-005">
        <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
          Submit an invoice write-off for maker-checker approval. Execution happens after approval in the queue.
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
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Case <Numeric>{String(detail.invoice_number || detail.id)}</Numeric>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-1 text-sm sm:grid-cols-2">
                <p>Case status: <Numeric>{String(detail.status || 'unknown')}</Numeric></p>
                <p>Invoice status: <Numeric>{String(detail.invoice_status || 'unknown')}</Numeric></p>
                <p>Tenant: <Numeric>{String(detail.tenant_id || '')}</Numeric></p>
                <p>Invoice: <Numeric>{String(detail.invoice_id || '')}</Numeric></p>
              </div>

              {needsReviewStage ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                  Case is not in WRITE_OFF_REVIEW yet. Advance the case through legal escalation before execution, but you may still queue approval now.
                </p>
              ) : null}

              <div>
                <Label htmlFor="woff-amount">Amount to write off (minor units)</Label>
                <Input
                  id="woff-amount"
                  value={amountMinor}
                  onChange={(event) => setAmountMinor(event.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div>
                <Label htmlFor="woff-reason">Reason</Label>
                <select
                  id="woff-reason"
                  className="mt-1 flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  value={reasonCategory}
                  onChange={(event) => setReasonCategory(event.target.value as typeof reasonCategory)}
                >
                  {REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="woff-evidence">Evidence</Label>
                <textarea
                  id="woff-evidence"
                  className="mt-1 min-h-24 w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  placeholder="Required supporting evidence (case notes, regulator letter, fraud investigation ref, …)"
                />
              </div>

              <div>
                <Label htmlFor="woff-reason-code">Reason code</Label>
                <Input
                  id="woff-reason-code"
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                  placeholder="WRITE_OFF_REQUEST"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={busy || !amountMinor.trim() || !evidence.trim()}
                  onClick={() => { void submitForApproval() }}
                >
                  {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                  Submit for approval
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </FinAdminGate>
  )
}
