import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStepUp } from '@/context/StepUpContext'
import { useToast } from '@/components/ui/toast'
import { PaddleCheckoutPanel } from '@/components/billing/PaddleCheckoutDialog'
import { isPaddleConfigured } from '@/lib/billing/paddle'

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
  const [checkoutAmount, setCheckoutAmount] = useState<number | null>(null)
  const [pending, setPending] = useState(false)

  function reset() {
    setCheckoutAmount(null)
    setPending(false)
  }

  async function proceed() {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      addToast({ title: 'Enter a positive amount', variant: 'error' })
      return
    }
    if (!isPaddleConfigured()) {
      addToast({ title: 'Online payment isn’t available yet', variant: 'error' })
      return
    }
    setPending(true)
    try {
      // Preserve the step-up gate for larger amounts before opening checkout.
      if (value > 50) {
        const ok = await runElevated(async () => true, 'Confirm top-up above $50')
        if (!ok) return
      }
      setCheckoutAmount(value)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top up credits</DialogTitle>
          <DialogDescription>
            {checkoutAmount == null
              ? 'Buy shared credits with your card. Amounts above $50 require a recent step-up.'
              : `Paying for $${checkoutAmount} of credits.`}
          </DialogDescription>
        </DialogHeader>

        {checkoutAmount == null ? (
          <div className="space-y-3">
            <Label htmlFor="topup-amount">Amount (USD)</Label>
            <Input
              id="topup-amount"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2">
              {['10', '25', '50', '100'].map((preset) => (
                <Button key={preset} type="button" variant="outline" size="sm" onClick={() => setAmount(preset)}>
                  ${preset}
                </Button>
              ))}
            </div>
            <Button onClick={proceed} disabled={pending}>
              {pending ? 'Preparing…' : 'Continue to payment'}
            </Button>
          </div>
        ) : (
          <PaddleCheckoutPanel
            request={{ kind: 'topup', amount_usd: checkoutAmount }}
            onCompleted={onRequested}
            onClose={() => { reset(); onOpenChange(false) }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
