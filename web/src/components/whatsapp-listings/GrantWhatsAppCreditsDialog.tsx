/**
 * PA-WLA-003 — Grant WhatsApp Listings credits (modal from entitlements admin).
 */
import { useEffect, useState } from 'react'
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
import { api } from '@/api/client'

export interface GrantWhatsAppCreditsTarget {
  scope: 'agent' | 'agency'
  scopeId: string
  label?: string
}

export interface GrantWhatsAppCreditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target?: GrantWhatsAppCreditsTarget | null
  onGranted?: () => void
}

export function GrantWhatsAppCreditsDialog({
  open,
  onOpenChange,
  target,
  onGranted,
}: GrantWhatsAppCreditsDialogProps) {
  const { addToast } = useToast()
  const { runElevated } = useStepUp()

  const [scope, setScope] = useState<'agent' | 'agency'>('agent')
  const [scopeId, setScopeId] = useState('')
  const [amountUsd, setAmountUsd] = useState('25')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setScope(target?.scope || 'agent')
    setScopeId(target?.scopeId || '')
    setAmountUsd('25')
    setReason('')
  }, [open, target])

  const submit = async () => {
    const amount = Number(amountUsd)
    if (!scopeId.trim()) {
      addToast({ variant: 'error', title: 'Tenant scope ID is required.' })
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast({ variant: 'error', title: 'Amount must be a positive USD value.' })
      return
    }
    if (!reason.trim()) {
      addToast({ variant: 'error', title: 'A reason is required for the audit trail.' })
      return
    }

    setSubmitting(true)
    try {
      const result = await runElevated(async () =>
        api.grantAdminWhatsAppListingsCredits({
          scope,
          scope_id: scopeId.trim(),
          amount_usd: amount,
          reason: reason.trim(),
        }),
      )
      addToast({
        variant: 'success',
        title: 'Credits granted',
        description: result.balance?.credits_remaining
          ? `New balance: ${result.balance.credits_remaining}`
          : undefined,
      })
      onOpenChange(false)
      onGranted?.()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Grant failed',
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
          <DialogTitle>Grant WhatsApp Listings credits</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-[var(--lc-text-muted)]">
            Mint AI credits for WhatsApp intake on the selected tenant. Large or recurring grants should
            use the generic credit-grant approval flow instead.
          </p>

          <div>
            <Label htmlFor="wa-grant-scope">Tenant scope</Label>
            <select
              id="wa-grant-scope"
              className="mt-1 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'agent' | 'agency')}
              disabled={Boolean(target?.scope)}
            >
              <option value="agent">Agent</option>
              <option value="agency">Agency</option>
            </select>
          </div>

          <div>
            <Label htmlFor="wa-grant-scope-id">Scope ID</Label>
            <Input
              id="wa-grant-scope-id"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder={target?.label || 'UUID for agent or agency'}
              className="mt-1 font-mono"
              disabled={Boolean(target?.scopeId)}
            />
          </div>

          <div>
            <Label htmlFor="wa-grant-amount">Amount (USD)</Label>
            <Input
              id="wa-grant-amount"
              inputMode="decimal"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="wa-grant-reason">Reason</Label>
            <Input
              id="wa-grant-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are these credits being granted?"
              className="mt-1"
            />
          </div>

          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            Preview amount: <Numeric>{amountUsd || '0'}</Numeric> USD
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting} onClick={() => void submit()}>
            Grant credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default GrantWhatsAppCreditsDialog
