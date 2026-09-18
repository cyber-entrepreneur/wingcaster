/**
 * PA-FAC-002 — Facility detail
 *
 * One facility: draw ledger, reservation timeline, lifecycle actions.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import { FinAdminGate, FinTable } from './shell'

interface FacilityReservation {
  id: string
  reserved_minor: number
  currency: string
  status: string
  expires_at?: string | null
  created_at: string
}

interface FacilityAuditEvent {
  id: string
  action: string
  reason_code?: string | null
  actor_email_snapshot?: string | null
  created_at: string
}

interface FacilityDetail {
  id: string
  tenant_id: string
  tenant_public_id?: string
  billing_account_id: string
  currency: string
  limit_minor: number
  current_draw_minor: number
  utilization_pct: number
  open_reservation_count: number
  net_terms_days: number
  status: string
  valid_from?: string | null
  valid_to?: string | null
  version?: number
  reservations?: FacilityReservation[]
  audit_events?: FacilityAuditEvent[]
}

function statusVariant(status: string) {
  if (status === 'ACTIVE') return 'default'
  if (status === 'PAUSED') return 'secondary'
  if (status === 'SUSPENDED') return 'outline'
  if (status === 'CLOSED') return 'destructive'
  return 'secondary'
}

export function FacilityDetailPage() {
  const { id = '' } = useParams()
  const [facility, setFacility] = useState<FacilityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [approvalId, setApprovalId] = useState('')
  const [limitMinor, setLimitMinor] = useState('')
  const [limitOpen, setLimitOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const body = await api.finGet(`/facilities/${id}`) as unknown as FacilityDetail
      setFacility(body)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load facility')
      setFacility(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void reload()
  }, [reload])

  async function runAction(label: string, path: string, body: Record<string, unknown> = {}) {
    if (!id || !facility) return
    setBusy(label)
    setError(null)
    try {
      const payload = {
        ...body,
        expected_version: facility.version,
        ...(approvalId.trim() ? { approval_request_id: approvalId.trim() } : {}),
      }
      await api.finPost(`/facilities/${id}${path}`, payload)
      setCloseOpen(false)
      setLimitOpen(false)
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `${label} failed`)
    } finally {
      setBusy(null)
    }
  }

  async function adjustLimit() {
    const parsed = Number(limitMinor)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a positive limit in minor units.')
      return
    }
    if (!approvalId.trim()) {
      setError('FACILITY_OPS approval request ID is required to adjust the limit.')
      return
    }
    await runAction('adjust-limit', '/limit', {
      limit_minor: parsed,
      approval_request_id: approvalId.trim(),
    })
  }

  const reservations = (facility?.reservations || []) as unknown as Array<Record<string, unknown>>
  const auditRows = (facility?.audit_events || []).map((event) => ({
    action: event.action,
    reason_code: event.reason_code,
    actor: event.actor_email_snapshot,
    created_at: event.created_at,
  })) as Array<Record<string, unknown>>

  return (
    <FinAdminGate title="Facility detail">
      <Button asChild variant="ghost" size="sm" className="mb-4 ps-0">
        <Link to="/admin/fin/facilities">
          <ArrowLeft className="me-2 h-4 w-4" aria-hidden="true" />
          Facilities
        </Link>
      </Button>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading facility…
        </div>
      )}

      {!loading && error && !facility && (
        <div className="space-y-3">
          <p className="text-sm text-red-500">{error}</p>
          <Button variant="outline" onClick={() => void reload()}>Retry</Button>
        </div>
      )}

      {!loading && facility && (
        <div className="space-y-6">
          {error && (
            <p className="text-sm text-red-500" role="alert">{error}</p>
          )}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {facility.tenant_public_id || facility.tenant_id}
              </h2>
              <p className="text-sm text-muted-foreground">
                {facility.currency} · Net terms <Numeric>{facility.net_terms_days}</Numeric> days
              </p>
              <p className="text-xs text-muted-foreground">
                Valid from {facility.valid_from || '—'}
                {facility.valid_to ? ` → ${facility.valid_to}` : ''}
              </p>
            </div>
            <Badge variant={statusVariant(facility.status)}>{facility.status}</Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Exposure</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Current draw</div>
                <div className="text-lg font-semibold">
                  <Numeric>{facility.current_draw_minor}</Numeric> {facility.currency}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Limit</div>
                <div className="text-lg font-semibold">
                  <Numeric>{facility.limit_minor}</Numeric> {facility.currency}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Utilization</div>
                <div className="text-lg font-semibold">
                  <Numeric>{facility.utilization_pct}</Numeric>%
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--lc-surface-sunken)]">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{ width: `${Math.min(100, facility.utilization_pct)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lifecycle actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                State transitions require an approved FACILITY_OPS request. Paste the approval request ID below.
              </p>
              <Input
                value={approvalId}
                onChange={(e) => setApprovalId(e.target.value)}
                placeholder="approval_request_id (FACILITY_OPS)"
                className="max-w-xl"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy === 'pause'} onClick={() => void runAction('pause', '/pause')}>
                  Pause
                </Button>
                <Button size="sm" variant="outline" disabled={busy === 'resume'} onClick={() => void runAction('resume', '/resume')}>
                  Resume
                </Button>
                <Button size="sm" variant="outline" disabled={busy === 'suspend'} onClick={() => void runAction('suspend', '/suspend')}>
                  Suspend
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLimitOpen(true)}>
                  Adjust limit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setCloseOpen(true)}>
                  Close facility
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reservation timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {reservations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reservations yet.</p>
              ) : (
                <FinTable
                  columns={['status', 'reserved_minor', 'currency', 'expires_at', 'created_at']}
                  rows={reservations}
                />
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                <Numeric>{facility.open_reservation_count}</Numeric> open reservation(s).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              {auditRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
              ) : (
                <FinTable columns={['action', 'reason_code', 'actor', 'created_at']} rows={auditRows} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust facility limit</DialogTitle>
            <DialogDescription>
              Enter the new limit in minor units. Requires an approved FACILITY_OPS approval request.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={limitMinor}
            onChange={(e) => setLimitMinor(e.target.value)}
            placeholder="New limit_minor"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitOpen(false)}>Cancel</Button>
            <Button disabled={busy === 'adjust-limit'} onClick={() => void adjustLimit()}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close facility</DialogTitle>
            <DialogDescription>
              Closing is irreversible. Open reservations must be released first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={busy === 'close'}
              onClick={() => void runAction('close', '/close')}
            >
              Confirm close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FinAdminGate>
  )
}
