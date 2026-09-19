import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type FacilityRow = {
  id: string
  currency: string
  limit_minor: number | string
  current_draw_minor?: number | string
  status: string
  version?: number
}

const REASON_OPTIONS = [
  { value: 'FACILITY_LIMIT_INCREASE', label: 'Increase credit limit' },
  { value: 'FACILITY_LIMIT_DECREASE', label: 'Decrease credit limit' },
  { value: 'FACILITY_SUPPORT', label: 'Support case remediation' },
  { value: 'FACILITY_OTHER', label: 'Other (document in approval)' },
] as const

export function AdjustFacilityLimitDialog({
  open,
  onOpenChange,
  facilities,
  initialFacilityId,
  onAdjusted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  facilities: FacilityRow[]
  initialFacilityId?: string
  onAdjusted: () => void
}) {
  const [facilityId, setFacilityId] = useState('')
  const [newLimitMinor, setNewLimitMinor] = useState('')
  const [reasonCode, setReasonCode] = useState<string>(REASON_OPTIONS[0].value)
  const [approvalRequestId, setApprovalRequestId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(
    () => facilities.find((row) => row.id === facilityId) || null,
    [facilities, facilityId],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setNewLimitMinor('')
    setApprovalRequestId('')
    setReasonCode(REASON_OPTIONS[0].value)
    const preferred = initialFacilityId && facilities.some((row) => row.id === initialFacilityId)
      ? initialFacilityId
      : facilities[0]?.id || ''
    setFacilityId(preferred)
  }, [open, facilities, initialFacilityId])

  const currentLimit = Number(selected?.limit_minor || 0)
  const currentDraw = Number(selected?.current_draw_minor || 0)
  const parsedLimit = Number(newLimitMinor)
  const belowDraw = Number.isFinite(parsedLimit) && parsedLimit > 0 && parsedLimit < currentDraw

  async function submit() {
    if (!facilityId || !approvalRequestId.trim() || !Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setError('Facility, approval request, and a positive new limit are required.')
      return
    }
    if (belowDraw) {
      setError(`New limit cannot be below current draw (${currentDraw} minor units).`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.finPost(`/facilities/${facilityId}/limit`, {
        limit_minor: parsedLimit,
        reason_code: reasonCode,
        approval_request_id: approvalRequestId.trim(),
      })
      onOpenChange(false)
      onAdjusted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Limit adjustment failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust facility limit</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <Label htmlFor="fac-limit-facility">Facility</Label>
            <select
              id="fac-limit-facility"
              className="mt-1 flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              value={facilityId}
              onChange={(event) => setFacilityId(event.target.value)}
            >
              {facilities.length ? facilities.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.id.slice(0, 8)} · {row.currency} · {row.status}
                </option>
              )) : (
                <option value="">No facilities loaded</option>
              )}
            </select>
          </div>

          {selected ? (
            <dl className="grid gap-1 rounded-md border border-[var(--lc-border-strong)] p-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Current limit</dt>
                <dd><Numeric>{currentLimit}</Numeric> {selected.currency}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Current draw</dt>
                <dd><Numeric>{currentDraw}</Numeric> {selected.currency}</dd>
              </div>
            </dl>
          ) : null}

          <div>
            <Label htmlFor="fac-limit-new">New limit (minor units)</Label>
            <Input
              id="fac-limit-new"
              inputMode="numeric"
              value={newLimitMinor}
              onChange={(event) => setNewLimitMinor(event.target.value)}
              placeholder="500000"
            />
          </div>

          <div>
            <Label htmlFor="fac-limit-reason">Reason</Label>
            <select
              id="fac-limit-reason"
              className="mt-1 flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="fac-limit-approval">FACILITY_OPS approval request id</Label>
            <Input
              id="fac-limit-approval"
              value={approvalRequestId}
              onChange={(event) => setApprovalRequestId(event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000001"
            />
          </div>

          {belowDraw ? (
            <p className="text-sm text-amber-700" role="status">
              New limit is below current open draw ({currentDraw} minor units).
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting || !facilityId || belowDraw}
            onClick={() => { void submit() }}
          >
            {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
