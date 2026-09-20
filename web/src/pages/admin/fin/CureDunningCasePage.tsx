/**
 * PA-DUN-004 — Cure dunning case (mark paid offline).
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

type DunningCaseDetail = {
  id?: string
  tenant_id?: string
  invoice_id?: string
  invoice_number?: string | null
  invoice_status?: string | null
  total_minor?: string | number | null
  status?: string
}

type PaymentRow = {
  id?: string
  tenant_id?: string
  status?: string
  amount_minor?: string | number
  currency?: string
  received_at?: string
}

export function CureDunningCasePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [detail, setDetail] = useState<DunningCaseDetail | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [paymentId, setPaymentId] = useState('')
  const [notes, setNotes] = useState('')
  const [reasonCode, setReasonCode] = useState('MANUAL_CURE')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.finGet(`/dunning/cases/${id}`),
      api.finGet('/payments'),
    ])
      .then(([caseBody, paymentsBody]) => {
        setDetail((caseBody.case || null) as DunningCaseDetail | null)
        setPayments((paymentsBody.payments || []) as PaymentRow[])
      })
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load cure case context',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }, [addToast, id])

  const tenantPayments = useMemo(
    () => payments.filter((payment) => payment.tenant_id === detail?.tenant_id),
    [detail?.tenant_id, payments],
  )

  const selectedPayment = tenantPayments.find((payment) => payment.id === paymentId) || null
  const invoicePaid = String(detail?.invoice_status || '').toUpperCase() === 'PAID'

  async function cure() {
    if (!id || !paymentId) return
    setBusy(true)
    try {
      await api.finPost(`/dunning/cases/${id}/cure`, {
        reason_code: reasonCode.trim() || 'MANUAL_CURE',
        payment_id: paymentId,
        notes: notes.trim() || undefined,
      })
      addToast({
        variant: 'success',
        title: 'Case cured',
        description: `Linked payment ${paymentId}`,
      })
      navigate('/admin/fin/exceptions', { replace: true })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Cure failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <FinAdminGate title="Cure dunning case">
      <div className="max-w-xl" data-screen="PA-DUN-004">
        <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
          Mark a dunning case as cured after an offline payment has been recorded and linked.
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
                <p>Amount due: <Numeric>{String(detail.total_minor ?? '')}</Numeric></p>
              </div>

              {!invoicePaid ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                  Invoice is not PAID yet. Apply the selected payment to this invoice before curing the case.
                </p>
              ) : null}

              <div>
                <Label htmlFor="cure-payment">Payment reference</Label>
                <select
                  id="cure-payment"
                  className="mt-1 flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  value={paymentId}
                  onChange={(event) => setPaymentId(event.target.value)}
                >
                  <option value="">Select a payment record</option>
                  {tenantPayments.map((payment) => (
                    <option key={String(payment.id)} value={String(payment.id)}>
                      {String(payment.id)} — {String(payment.amount_minor ?? '')} {String(payment.currency || '')} ({String(payment.status || '')})
                    </option>
                  ))}
                </select>
                {selectedPayment?.id ? (
                  <p className="mt-2 text-sm">
                    <Link
                      to={`/admin/fin/payments/${selectedPayment.id}`}
                      className="underline text-[var(--lc-text-muted)]"
                    >
                      Open payment detail
                    </Link>
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="cure-reason">Reason code</Label>
                <Input
                  id="cure-reason"
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                  placeholder="MANUAL_CURE"
                />
              </div>

              <div>
                <Label htmlFor="cure-notes">Notes</Label>
                <textarea
                  id="cure-notes"
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
                <Button
                  type="button"
                  disabled={busy || !paymentId}
                  onClick={() => { void cure() }}
                >
                  {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                  Cure case
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </FinAdminGate>
  )
}
