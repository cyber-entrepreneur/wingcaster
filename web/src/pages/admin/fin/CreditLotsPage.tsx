import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { FinAdminGate, FinTable } from './shell'

type LotRow = Record<string, unknown>

const STATUS_OPTIONS = ['', 'ACTIVE', 'EXHAUSTED', 'EXPIRED', 'FROZEN'] as const

function statusVariant(status: string) {
  if (status === 'ACTIVE') return 'default' as const
  if (status === 'EXHAUSTED' || status === 'EXPIRED') return 'secondary' as const
  if (status === 'FROZEN') return 'destructive' as const
  return 'outline' as const
}

function buildLotsPath(filters: {
  tenantId: string
  status: string
  expiringSoon: boolean
}) {
  const params = new URLSearchParams()
  if (filters.tenantId.trim()) params.set('tenant_id', filters.tenantId.trim())
  if (filters.status) params.set('status', filters.status)
  if (filters.expiringSoon) params.set('expiring_soon', 'true')
  const qs = params.toString()
  return `/credits/lots${qs ? `?${qs}` : ''}`
}

export function CreditLotsPage() {
  const [rows, setRows] = useState<LotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [status, setStatus] = useState('')
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [selected, setSelected] = useState<LotRow | null>(null)
  const [detail, setDetail] = useState<LotRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [retiring, setRetiring] = useState(false)
  const [retireError, setRetireError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const body = await api.finGet(buildLotsPath({ tenantId, status, expiringSoon }))
      setRows((body.lots || []) as LotRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credit lots')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [tenantId, status, expiringSoon])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (!selected?.id) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    setRetireError(null)
    void api.finGet(`/credits/lots/${String(selected.id)}`)
      .then((body) => setDetail(body))
      .catch((err) => {
        setDetail(null)
        setRetireError(err instanceof Error ? err.message : 'Failed to load lot detail')
      })
      .finally(() => setDetailLoading(false))
  }, [selected?.id])

  const tableRows = useMemo(() => rows.map((row) => ({
    ...row,
    granted_units: String(row.granted_units ?? ''),
    remaining_units: String(row.remaining_units ?? ''),
    consideration_minor: String(row.consideration_minor ?? ''),
  })), [rows])

  async function retireLot() {
    if (!detail?.id || detail.status !== 'ACTIVE') return
    setRetiring(true)
    setRetireError(null)
    try {
      await api.finPost(`/credits/lots/${String(detail.id)}/retire`, { reason_code: 'LOT_RETIRE' })
      setSelected(null)
      await reload()
    } catch (err) {
      setRetireError(err instanceof Error ? err.message : 'Retire failed')
    } finally {
      setRetiring(false)
    }
  }

  return (
    <FinAdminGate title="Credit lots">
      <p className="mb-3 text-sm text-muted-foreground">
        Prepaid stock per tenant — oldest-first draw order. Expiring-soon shows lots expiring within 30 days.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Tenant ID</span>
          <Input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="Filter by tenant UUID"
            className="w-72"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-3 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt || 'all'} value={opt}>{opt || 'All statuses'}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={expiringSoon}
            onChange={(e) => setExpiringSoon(e.target.checked)}
          />
          Expiring in ≤30 days
        </label>
        <Button size="sm" variant="outline" onClick={() => { void reload() }}>Refresh</Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading lots…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && !rows.length && (
        <p className="text-sm text-muted-foreground">No credit lots match these filters.</p>
      )}
      {!loading && !error && rows.length > 0 && (
        <FinTable
          columns={['tenant_id', 'id', 'issued_at', 'expires_at', 'granted_units', 'remaining_units', 'status', 'source_kind']}
          rows={tableRows}
          onRowClick={(row) => setSelected(row)}
        />
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lot detail</DialogTitle>
          </DialogHeader>
          {detailLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!detailLoading && detail && (
            <dl className="grid gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={statusVariant(String(detail.status))}>{String(detail.status)}</Badge>
                </dd>
              </div>
              <div><dt className="text-muted-foreground">Lot ID</dt><dd className="break-all font-mono text-xs">{String(detail.id)}</dd></div>
              <div><dt className="text-muted-foreground">Tenant</dt><dd className="break-all font-mono text-xs">{String(detail.tenant_id)}</dd></div>
              <div><dt className="text-muted-foreground">Source</dt><dd>{String(detail.source_kind)}</dd></div>
              <div>
                <dt className="text-muted-foreground">Granted / remaining</dt>
                <dd>
                  <Numeric>{String(detail.granted_units)}</Numeric>
                  {' / '}
                  <Numeric>{String(detail.remaining_units)}</Numeric>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Consideration (minor)</dt>
                <dd><Numeric>{String(detail.consideration_minor)}</Numeric> {String(detail.currency || '')}</dd>
              </div>
              <div><dt className="text-muted-foreground">Issued</dt><dd>{String(detail.issued_at || '—')}</dd></div>
              <div><dt className="text-muted-foreground">Expires</dt><dd>{String(detail.expires_at || '—')}</dd></div>
            </dl>
          )}
          {retireError && <p className="text-sm text-red-600">{retireError}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            {detail?.status === 'ACTIVE' && (
              <Button variant="destructive" disabled={retiring} onClick={() => { void retireLot() }}>
                {retiring ? 'Retiring…' : 'Retire lot'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FinAdminGate>
  )
}
