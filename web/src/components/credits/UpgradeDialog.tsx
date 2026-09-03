import { useEffect, useState } from 'react'
import { api, type TenantPlan, type TenantPlanPreview, type TenantSubscription } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useStepUp } from '@/context/StepUpContext'
import { useToast } from '@/components/ui/toast'

export function UpgradeDialog({
  open,
  onOpenChange,
  subscription,
  plan,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: TenantSubscription | null
  plan: TenantPlan | null
  onChanged?: () => void
}) {
  const { addToast } = useToast()
  const { runElevated } = useStepUp()
  const [preview, setPreview] = useState<TenantPlanPreview | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open || !subscription || !plan) {
      setPreview(null)
      return
    }
    api.previewTenantPlanChange(subscription.id, plan.version_id)
      .then(setPreview)
      .catch((err) => addToast({ title: 'Could not preview plan', description: err.message, variant: 'error' }))
  }, [open, subscription, plan, addToast])

  async function confirm() {
    if (!subscription || !plan) return
    setPending(true)
    try {
      const result = await runElevated(
        () => api.changeTenantPlan(subscription.id, plan.version_id, true),
        'Confirm plan change',
      )
      if (!result) return
      addToast({ title: 'Plan updated', variant: 'success' })
      onChanged?.()
      onOpenChange(false)
    } catch (err: any) {
      addToast({ title: 'Plan change failed', description: err.message, variant: 'error' })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>
            {plan ? `Switch to ${plan.display_name}. Pro-ration is previewed before you confirm.` : 'Select a plan'}
          </DialogDescription>
        </DialogHeader>
        {preview && (
          <div className="space-y-2 text-sm">
            <p>Remaining fraction of current cycle: {(preview.fraction * 100).toFixed(0)}%</p>
            <p>Net credit adjustment: {preview.net} units</p>
            <p>New monthly price: {(preview.new_monthly_price_minor / 100).toFixed(2)} {preview.currency}</p>
          </div>
        )}
        <Button onClick={confirm} disabled={pending || !preview}>{pending ? 'Updating…' : 'Confirm change'}</Button>
      </DialogContent>
    </Dialog>
  )
}
