import { useCallback, useEffect, useState } from 'react'
import { api, type TenantPlan, type TenantSubscription } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UpgradeDialog } from '@/components/credits/UpgradeDialog'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

export function PlansPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('Plans')
  const [plans, setPlans] = useState<TenantPlan[]>([])
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null)
  const [selected, setSelected] = useState<TenantPlan | null>(null)

  const load = useCallback(async () => {
    try {
      const [planRes, subRes] = await Promise.all([api.getTenantPlans(), api.getTenantSubscription()])
      setPlans(planRes.plans)
      setSubscription(subRes.subscription)
    } catch (err: any) {
      addToast({ title: 'Could not load plans', description: err.message, variant: 'error' })
    }
  }, [addToast])

  useEffect(() => { if (agent) load() }, [agent, load])

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Plans</h1>
        <p className="text-muted-foreground">Choose a published package. Change-plan uses pro-ration preview.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const current = subscription?.package_code === plan.code
          return (
            <Card key={plan.version_id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.display_name}</CardTitle>
                  {current && <Badge>Current</Badge>}
                </div>
                <CardDescription>{plan.tier} · {plan.billing_cadence}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">${(plan.monthly_price_minor / 100).toFixed(0)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
                <p className="text-sm text-muted-foreground">{plan.properties_covered} properties covered</p>
                {!current && (
                  <Button onClick={() => setSelected(plan)}>Upgrade</Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      <UpgradeDialog
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSelected(null) }}
        subscription={subscription}
        plan={selected}
        onChanged={load}
      />
    </div>
  )
}
