/**
 * PA-FIN-003 — Tenant detail (360° fin-ops view).
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { FinAdminGate } from './shell'

type TenantDetail = Record<string, unknown>

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--lc-text-muted)]">{label}</p>
      <p className="text-sm font-medium"><Numeric>{value}</Numeric></p>
    </div>
  )
}

export function TenantDetailPage() {
  const { id } = useParams()
  const { addToast } = useToast()
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    void api.finGet(`/tenants/${id}`)
      .then((body) => setTenant(body as TenantDetail))
      .catch((err: unknown) => {
        addToast({
          variant: 'error',
          title: 'Failed to load tenant',
          description: err instanceof Error ? err.message : undefined,
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  const title = String(tenant?.public_tenant_id || tenant?.id || id || 'Tenant')

  return (
    <FinAdminGate title="Tenant detail">
      <p className="mb-4 text-sm text-[var(--lc-text-muted)]">
        Review one tenant&apos;s credit exposure, receivables, dunning posture, and billing identifiers.
      </p>

      <div className="mb-4">
        <Link to="/admin/fin/tenants" className="text-sm underline text-[var(--lc-text-muted)]">
          Back to tenants
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Loading…</p>
      ) : !tenant ? (
        <p className="text-sm text-[var(--lc-text-muted)]">Tenant not found.</p>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg"><Numeric>{title}</Numeric></CardTitle>
              <Badge variant="secondary">{String(tenant.status || 'unknown')}</Badge>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Tenant id" value={String(tenant.id || '')} />
              <Metric label="Billing account" value={String(tenant.billing_account_id || '—')} />
              <Metric label="Holder id" value={String(tenant.holder_id || '—')} />
              <Metric label="Dunning status" value={String(tenant.dunning_status || 'none')} />
              <Metric label="Dunning case" value={String(tenant.dunning_case_id || '—')} />
              <Metric label="Legal name" value={String(tenant.legal_name || tenant.display_name || '—')} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">Credit & exposure</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Metric label="Remaining units" value={String(tenant.remaining_units ?? 0)} />
                <Metric label="Granted units" value={String(tenant.granted_units ?? 0)} />
                <Metric label="Active lots" value={String(tenant.lot_count ?? 0)} />
                <Metric label="Credit exposure (minor)" value={String(tenant.credit_exposure_minor ?? 0)} />
                <Metric label="Open holds" value={String(tenant.open_holds ?? 0)} />
                <Metric label="Held units" value={String(tenant.held_units ?? 0)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Receivables & cash</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Metric label="AR outstanding (minor)" value={String(tenant.ar_outstanding_minor ?? 0)} />
                <Metric label="Unapplied cash (minor)" value={String(tenant.unapplied_cash_minor ?? 0)} />
                <Metric label="Facility limit (minor)" value={String(tenant.facility_limit_minor ?? 0)} />
                <Metric label="Active facilities" value={String(tenant.facility_count ?? 0)} />
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link to="/admin/fin/invoices" className="underline text-[var(--lc-text-muted)]">Invoices</Link>
            <Link to="/admin/fin/credits" className="underline text-[var(--lc-text-muted)]">Credit lots</Link>
            <Link to="/admin/fin/holds" className="underline text-[var(--lc-text-muted)]">Holds</Link>
            <Link to="/admin/fin/facilities" className="underline text-[var(--lc-text-muted)]">Facilities</Link>
          </div>
        </>
      )}
    </FinAdminGate>
  )
}

export default TenantDetailPage
