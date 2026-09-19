/**
 * PA-INV-004 — Create debit note (modal from invoices admin).
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useStepUp } from '@/context/StepUpContext'

export interface DebitNoteInvoiceTarget {
  id: string
  invoice_number?: string | null
  currency?: string | null
  total_minor?: string | number | null
  status?: string | null
}

export interface CreateDebitNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice?: DebitNoteInvoiceTarget | null
  onCreated?: (result: Record<string, unknown>) => void
}

const DEBIT_NOTE_PARENT_STATUSES = new Set(['ISSUED', 'PART_PAID', 'PAID', 'UNCOLLECTIBLE'])

export function CreateDebitNoteDialog({
  open,
  onOpenChange,
  invoice,
  onCreated,
}: CreateDebitNoteDialogProps) {
  const { addToast } = useToast()
  const { runElevated } = useStepUp()

  const [amountMinor, setAmountMinor] = useState('1')
  const [reasonCode, setReasonCode] = useState('INVOICE_UNDERBILL_CORRECTION')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmountMinor('1')
    setReasonCode('INVOICE_UNDERBILL_CORRECTION')
  }, [open, invoice?.id])

  const parentEligible = invoice?.status ? DEBIT_NOTE_PARENT_STATUSES.has(String(invoice.status)) : false

  const submit = async () => {
    if (!invoice?.id) {
      addToast({ variant: 'error', title: 'Select an invoice first.' })
      return
    }
    if (!parentEligible) {
      addToast({
        variant: 'error',
        title: 'Debit notes require an issued invoice.',
        description: `Current status: ${invoice.status || 'unknown'}`,
      })
      return
    }

    const amount = Number(amountMinor)
    if (!Number.isInteger(amount) || amount <= 0) {
      addToast({ variant: 'error', title: 'Amount must be a positive whole number of minor units.' })
      return
    }
    if (!reasonCode.trim()) {
      addToast({ variant: 'error', title: 'A reason code is required for the audit trail.' })
      return
    }

    setSubmitting(true)
    try {
      const result = await runElevated(
        () => api.createAdminDebitNote(String(invoice.id), {
          amount_minor: amount,
          reason_code: reasonCode.trim(),
        }),
        'Issue debit note against invoice',
      )
      if (!result) return
      addToast({
        variant: 'success',
        title: 'Debit note issued',
        description: result.noteNumber ? `Note ${String(result.noteNumber)}` : undefined,
      })
      onOpenChange(false)
      onCreated?.(result)
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Debit note failed',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create debit note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-[var(--lc-text-muted)]">
            Issue a rare upward correction against an issued invoice. The server drafts, approves, and
            issues the debit note in one elevated action.
          </p>

          <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-sm">
            <p>
              Invoice{' '}
              <Numeric className="font-semibold">
                {invoice?.invoice_number || invoice?.id || '—'}
              </Numeric>
            </p>
            <p className="text-[var(--lc-text-muted)]">
              Status: {invoice?.status || '—'}
              {invoice?.currency ? ` · ${invoice.currency}` : ''}
              {invoice?.total_minor != null ? (
                <>
                  {' '}
                  · Total{' '}
                  <Numeric>{String(invoice.total_minor)}</Numeric> minor
                </>
              ) : null}
            </p>
          </div>

          {!parentEligible && invoice?.status ? (
            <p className="text-sm text-[var(--lc-text-danger)]">
              Debit notes can only be created for issued, part-paid, paid, or uncollectible invoices.
            </p>
          ) : null}

          <div>
            <Label htmlFor="debit-note-amount">Amount (minor units)</Label>
            <Input
              id="debit-note-amount"
              inputMode="numeric"
              value={amountMinor}
              onChange={(e) => setAmountMinor(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>

          <div>
            <Label htmlFor="debit-note-reason">Reason code</Label>
            <Input
              id="debit-note-reason"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              placeholder="INVOICE_UNDERBILL_CORRECTION"
              className="mt-1 font-mono"
            />
          </div>

          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            Preview amount: <Numeric>{amountMinor || '0'}</Numeric> minor units
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting || !parentEligible}
            onClick={() => void submit()}
          >
            Issue debit note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateDebitNoteDialog
