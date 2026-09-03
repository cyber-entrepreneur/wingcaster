import { useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStepUp } from '@/context/StepUpContext'
import { useToast } from '@/components/ui/toast'

export function TopUpDialog({
  open,
  onOpenChange,
  onRequested,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRequested?: () => void
}) {
  const { addToast } = useToast()
  const { runElevated } = useStepUp()
  const [amount, setAmount] = useState('25')
  const [pending, setPending] = useState(false)

  async function submit() {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      addToast({ title: 'Enter a positive amount', variant: 'error' })
      return
    }
    setPending(true)
    try {
      const action = () => api.requestTenantTopUp(value)
      const result = value > 50
        ? await runElevated(action, 'Confirm top-up above $50')
        : await action()
      if (!result) return
      addToast({
        title: 'Top-up requested',
        description: 'Payment provider handoff is not wired yet. An outbox event was recorded.',
        variant: 'success',
      })
      onRequested?.()
      onOpenChange(false)
    } catch (err: any) {
      addToast({ title: 'Top-up failed', description: err.message, variant: 'error' })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top up credits</DialogTitle>
          <DialogDescription>
            Amounts above $50 require a recent step-up. No card details are collected here — the provider checkout is a separate workstream.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="topup-amount">Amount (USD)</Label>
          <Input id="topup-amount" type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex gap-2">
            {['10', '25', '50', '100'].map((preset) => (
              <Button key={preset} type="button" variant="outline" size="sm" onClick={() => setAmount(preset)}>
                ${preset}
              </Button>
            ))}
          </div>
          <Button onClick={submit} disabled={pending}>{pending ? 'Requesting…' : 'Request top-up'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
