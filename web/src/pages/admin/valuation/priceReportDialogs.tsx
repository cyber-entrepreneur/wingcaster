import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import {
  HIGH_DELTA_THRESHOLD_PCT,
  REJECT_REASON_OPTIONS,
  REQUEST_INFO_REASON_OPTIONS,
} from './priceReportTypes'

export function PriceReportIncorporateDialog({
  open,
  onOpenChange,
  segmentLabel,
  deltaPct,
  twoPersonRequired,
  weight,
  onWeightChange,
  onConfirm,
  confirmDisabled,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
  segmentLabel: string
  deltaPct: number
  twoPersonRequired: boolean
  weight: number
  onWeightChange?: (weight: number) => void
  onConfirm?: () => void
  confirmDisabled?: boolean
}) {
  const abs = Math.abs(deltaPct)
  const highDelta = twoPersonRequired || abs >= HIGH_DELTA_THRESHOLD_PCT

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="price-report-incorporate-desc">
        <DialogHeader>
          <DialogTitle>Approve and incorporate into benchmark?</DialogTitle>
          <DialogDescription id="price-report-incorporate-desc">
            {highDelta ? (
              <>
                Delta is <Numeric as="span">{abs.toFixed(1)}</Numeric>% — a second approver is
                required. On confirm, this becomes a pending approval request assigned to the on-call
                PA.
              </>
            ) : (
              <>
                This report will be marked verified AND written as an authoritative signal into the
                pricing benchmark for {segmentLabel}. This affects agent pricing tools and Bazaar
                segment badges.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="incorporate-weight">Signal weight</Label>
          <select
            id="incorporate-weight"
            value={String(weight)}
            onChange={(e) => onWeightChange?.(Number(e.target.value))}
            className={cn(
              'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
              'bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]',
            )}
          >
            <option value="100">100% (authoritative — incorporate)</option>
            <option value="75">75%</option>
            <option value="50">50%</option>
          </select>
          <p className="text-xs text-[var(--lc-text-muted)]">
            Incorporate commits an authoritative benchmark write. Weight is audited with the decision.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm?.()
              onOpenChange?.(false)
            }}
          >
            Incorporate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PriceReportSignalOnlyDialog({
  open,
  onOpenChange,
  count = 1,
  weight,
  onWeightChange,
  onConfirm,
  confirmDisabled,
  bulk = false,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
  count?: number
  weight: number
  onWeightChange?: (weight: number) => void
  onConfirm?: () => void
  confirmDisabled?: boolean
  bulk?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="price-report-signal-desc">
        <DialogHeader>
          <DialogTitle>
            {bulk ? (
              <>
                Publish <Numeric>{count}</Numeric> reports as signal-only?
              </>
            ) : (
              'Approve as signal-only?'
            )}
          </DialogTitle>
          <DialogDescription id="price-report-signal-desc">
            {bulk
              ? 'Each report will be marked verified and visible to Bazaar and agents as a considered opinion. The benchmark will NOT change.'
              : 'This report will be marked verified and visible to Bazaar and agents as a considered opinion. The pricing benchmark will NOT change.'}
          </DialogDescription>
        </DialogHeader>

        {!bulk ? (
          <div className="mt-4 flex flex-col gap-2">
            <Label htmlFor="signal-weight">Signal weight</Label>
            <select
              id="signal-weight"
              value={String(weight)}
              onChange={(e) => onWeightChange?.(Number(e.target.value))}
              className={cn(
                'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
                'bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]',
              )}
            >
              <option value="75">75%</option>
              <option value="50">50%</option>
              <option value="25">25%</option>
            </select>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm?.()
              onOpenChange?.(false)
            }}
          >
            {bulk ? (
              <>
                Publish <Numeric className="ms-1">{count}</Numeric> as signal-only
              </>
            ) : (
              'Approve as signal-only'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PriceReportReasonDialog({
  open,
  onOpenChange,
  mode,
  onConfirm,
  confirmDisabled,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
  mode: 'reject' | 'request_info'
  onConfirm?: (payload: { reasonCode: string; notes: string }) => void
  confirmDisabled?: boolean
}) {
  const [reasonCode, setReasonCode] = useState('')
  const [notes, setNotes] = useState('')
  const options = mode === 'reject' ? REJECT_REASON_OPTIONS : REQUEST_INFO_REASON_OPTIONS
  const canConfirm = Boolean(reasonCode) && notes.trim().length >= 5

  const handleClose = (next: boolean) => {
    if (!next) {
      setReasonCode('')
      setNotes('')
    }
    onOpenChange?.(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent aria-describedby="price-report-reason-desc">
        <DialogHeader>
          <DialogTitle>{mode === 'reject' ? 'Reject price report' : 'Request more info'}</DialogTitle>
          <DialogDescription id="price-report-reason-desc">
            {mode === 'reject'
              ? 'The agent sees this reason in their outcome inbox.'
              : 'The agent can resubmit after addressing your request.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price-report-reason">
              {mode === 'reject' ? 'Reason (shown to the agent)' : 'What do you need? (shown to the agent)'}
            </Label>
            <select
              id="price-report-reason"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className={cn(
                'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
                'bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]',
              )}
            >
              <option value="">Select a reason…</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price-report-notes">
              {mode === 'reject' ? 'Notes for the agent (optional)' : 'Additional context (optional)'}
            </Label>
            <textarea
              id="price-report-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(
                'w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
                'bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)]',
                'placeholder:text-[var(--lc-text-muted)]',
              )}
              placeholder="Be specific about what to fix."
            />
            <p className="text-xs text-[var(--lc-text-muted)]">Minimum 5 characters.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={!canConfirm || confirmDisabled}
            onClick={() => {
              onConfirm?.({ reasonCode, notes: notes.trim() })
              handleClose(false)
            }}
          >
            {mode === 'reject' ? 'Reject' : 'Send request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
