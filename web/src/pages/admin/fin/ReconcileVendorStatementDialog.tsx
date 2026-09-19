import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Numeric } from '@/components/ui/numeric'
import { vendorApi } from './vendor-api'

type StatementSummary = {
  statement_period_key?: string
  status?: string
  total_minor?: number | string
  unresolved_variance_count?: number
  currency?: string
}

export function ReconcileVendorStatementDialog({
  open,
  onOpenChange,
  vendorId,
  month,
  statement,
  onReconciled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendorId: string
  month: string
  statement: StatementSummary | null
  onReconciled: () => void
}) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unresolved = Number(statement?.unresolved_variance_count || 0)
  const blocked = unresolved > 0 && statement?.status === 'RECONCILED'

  useEffect(() => {
    if (!open) return
    setNotes('')
    setError(null)
    setSubmitting(false)
  }, [open, vendorId, month])

  async function submit() {
    if (blocked) return
    setSubmitting(true)
    setError(null)
    try {
      await vendorApi.reconcileStatement(vendorId, month, {
        evidence: {
          signed: true,
          note: notes.trim() || undefined,
        },
      })
      onReconciled()
      onOpenChange(false)
    } catch {
      setError('Could not reconcile statement. Check elevation and drift status.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reconcile vendor statement</DialogTitle>
        </DialogHeader>

        <dl className="grid gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Period:</span>{' '}
            {statement?.statement_period_key || month}
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span>{' '}
            {statement?.status || '—'}
          </div>
          <div>
            <span className="text-muted-foreground">Invoiced total:</span>{' '}
            <Numeric>{String(statement?.total_minor ?? '0')}</Numeric>{' '}
            {statement?.currency || ''}
          </div>
          <div>
            <span className="text-muted-foreground">Unresolved drift:</span>{' '}
            <Numeric>{unresolved}</Numeric>
          </div>
        </dl>

        {blocked ? (
          <p className="text-sm text-red-600" role="alert">
            Resolve drift indicators before recording reconciliation evidence.
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="reconcile-notes">Evidence notes</Label>
          <Input
            id="reconcile-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Signed reconciliation notes or reference"
          />
        </div>

        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || blocked} onClick={() => { void submit() }}>
            {submitting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                Reconciling…
              </>
            ) : (
              'Mark reconciled'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
