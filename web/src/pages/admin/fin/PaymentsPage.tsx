/**
 * PA-PAY-001 — Payments index.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinAdminGate, FinTable } from './shell'

type PaymentRow = Record<string, unknown>

export function PaymentsPage() {
  const { addToast } = useToast()
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [tenantId, setTenantId] = useState('')
  const [billingAccountId, setBillingAccountId] = useState('')
  const [amountMinor, setAmountMinor] = useState('100')
  const [currency, setCurrency] = useState('USD')
  const [reasonCode, setReasonCode] = useState('MANUAL_RECEIPT')
  const [busy, setBusy] = useState(false)

  function reload() {
    void api.finGet('/payments').then((body) => setRows((body.payments || []) as PaymentRow[]))
  }

  useEffect(() => { reload() }, [])

  async function recordPayment() {
    if (!tenantId.trim() || !billingAccountId.trim() || !amountMinor.trim()) {
      addToast({ variant: 'error', title: 'Tenant, billing account, and amount are required' })
      return
    }
    setBusy(true)
    try {
      await api.finPost('/payments', {
        tenant_id: tenantId.trim(),
        billing_account_id: billingAccountId.trim(),
        amount_minor: Number(amountMinor),
        currency: currency.trim() || 'USD',
        reason_code: reasonCode.trim() || 'MANUAL_RECEIPT',
        provider: 'MANUAL',
      })
      addToast({ variant: 'success', title: 'Payment recorded' })
      reload()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Record payment failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  async function reversePayment(id: string) {
    setBusy(true)
    try {
      await api.finPost(`/payments/${id}/reverse`, { reason_code: reasonCode.trim() || 'MANUAL_REVERSAL' })
      addToast({ variant: 'success', title: 'Payment reversed' })
      reload()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Reverse payment failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const tableRows = rows.map((row) => ({
    received_at: String(row.received_at || ''),
    tenant_id: String(row.tenant_id || ''),
    amount: `${String(row.amount_minor ?? '')} ${String(row.currency || '')}`.trim(),
    provider: String(row.provider || 'MANUAL'),
    applied_invoices: String(row.applied_invoices || '—'),
    status: String(row.status || ''),
    id: String(row.id || ''),
  }))

  return (
    <FinAdminGate title="Payments">
      <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
        Review received payments across Stripe, Paddle, bank, and manual receipts. Reversals create linked negative records — nothing is deleted.
      </p>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-lg">Record manual payment</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="text-xs text-[var(--lc-text-muted)]">Tenant id</span>
            <input className="mt-1 block w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-xs text-[var(--lc-text-muted)]">Billing account id</span>
            <input className="mt-1 block w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm" value={billingAccountId} onChange={(e) => setBillingAccountId(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-xs text-[var(--lc-text-muted)]">Amount minor</span>
            <input className="mt-1 block w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm" value={amountMinor} onChange={(e) => setAmountMinor(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-xs text-[var(--lc-text-muted)]">Currency</span>
            <input className="mt-1 block w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-xs text-[var(--lc-text-muted)]">Reason code</span>
            <input className="mt-1 block w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} />
          </label>
          <div className="flex items-end">
            <Button disabled={busy} onClick={() => void recordPayment()}>Record payment</Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary"><Numeric>{String(rows.length)}</Numeric> rows</Badge>
        <Link to="/admin/fin/invoices" className="text-sm underline text-[var(--lc-text-muted)]">View invoices</Link>
      </div>

      <FinTable
        columns={['received_at', 'tenant_id', 'amount', 'provider', 'applied_invoices', 'status', 'id']}
        rows={tableRows}
      />

      {rows[0]?.id ? (
        <div className="mt-3">
          <Button variant="outline" disabled={busy} onClick={() => void reversePayment(String(rows[0].id))}>
            Reverse first listed payment
          </Button>
        </div>
      ) : null}
    </FinAdminGate>
  )
}

export default PaymentsPage
