/**
 * PA-ACC-003 — Billing period close sub-flow (advisory lock 1020 + 12-step close).
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

type BillingPeriodLock = {
  held?: boolean
  pid?: string | null
  usename?: string | null
  application_name?: string | null
  state?: string | null
}

type BillingPeriodDetail = {
  id?: string
  tenant_id?: string
  billing_account_id?: string
  period_key?: string
  starts_at?: string
  ends_at?: string
  status?: string
  lock?: BillingPeriodLock
  invoice?: { id?: string; status?: string; invoice_number?: string | null } | null
  ready_for_close?: boolean
  ready_for_reopen?: boolean
}

export function BillingPeriodClosePage() {
  const { id } = useParams()
  const { addToast } = useToast()
  const [period, setPeriod] = useState<BillingPeriodDetail | null>(null)
  const [reasonCode, setReasonCode] = useState('PA_CLOSE')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  function reload() {
    if (!id) return
    setLoading(true)
    void api.finGet(`/billing/periods/${id}`)
      .then((body) => setPeriod((body.period || null) as BillingPeriodDetail | null))
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load billing period',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [id])

  async function act(path: string, label: string) {
    if (!id || !reasonCode.trim()) return
    setBusy(true)
    try {
      await api.finPost(`/billing/periods/${id}${path}`, {
        reason_code: reasonCode.trim(),
        tenant_id: period?.tenant_id,
      })
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

  const lock = period?.lock

  return (
    <FinAdminGate title="Billing period close">
      <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
        Run the 12-step billing-period close under advisory lock 1020. Confirm tenant scope before closing.
      </p>

      <div className="mb-4">
        <Link to="/admin/fin/exceptions" className="text-sm underline text-[var(--lc-text-muted)]">
          Back to exceptions
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : !period ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Billing period not found.</p>
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
              <p>Tenant: <Numeric>{String(period.tenant_id || '')}</Numeric></p>
              <p>Billing account: <Numeric>{String(period.billing_account_id || '')}</Numeric></p>
              <p>Starts: <Numeric>{String(period.starts_at || '')}</Numeric></p>
              <p>Ends: <Numeric>{String(period.ends_at || '')}</Numeric></p>
              {period.invoice?.id ? (
                <p className="sm:col-span-2">
                  Invoice: <Numeric>{String(period.invoice.invoice_number || period.invoice.id)}</Numeric>
                  {' '}({String(period.invoice.status || '')})
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader><CardTitle className="text-lg">Advisory lock 1020</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {lock?.held ? (
                <div className="space-y-1 text-[var(--lc-text-muted)]">
                  <p>Lock held — close blocked until the holder releases it.</p>
                  {lock.pid ? <p>PID: <Numeric>{lock.pid}</Numeric></p> : null}
                  {lock.usename ? <p>User: <Numeric>{lock.usename}</Numeric></p> : null}
                  {lock.application_name ? <p>Application: <Numeric>{lock.application_name}</Numeric></p> : null}
                </div>
              ) : (
                <p className="text-[var(--lc-text-muted)]">Lock free — close may proceed when the period is eligible.</p>
              )}
            </CardContent>
          </Card>

          <div className="mb-4">
            <label htmlFor="billing-close-reason" className="text-xs text-[var(--lc-text-muted)]">
              Reason code
            </label>
            <input
              id="billing-close-reason"
              className="mt-1 block min-h-tap w-full max-w-md rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy || !period.ready_for_close || !reasonCode.trim()}
              onClick={() => void act('/close', 'Close billing period')}
            >
              Close billing period
            </Button>
            <Button
              variant="outline"
              disabled={busy || !period.ready_for_reopen || !reasonCode.trim()}
              onClick={() => void act('/reopen', 'Reopen billing period')}
            >
              Reopen billing period
            </Button>
          </div>
        </>
      )}
    </FinAdminGate>
  )
}

export default BillingPeriodClosePage
