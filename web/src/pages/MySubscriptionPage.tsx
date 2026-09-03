import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type TenantSubscription } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

export function MySubscriptionPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('My subscription')
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.getTenantSubscription()
      setSubscription(res.subscription)
    } catch (err: any) {
      addToast({ title: 'Could not load subscription', description: err.message, variant: 'error' })
    }
  }, [addToast])

  useEffect(() => { if (agent) load() }, [agent, load])

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">My subscription</h1>
      <Card>
        <CardHeader>
          <CardTitle>{subscription?.display_name || 'No subscription'}</CardTitle>
          <CardDescription>{subscription?.package_code}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {subscription ? (
            <>
              <div className="flex items-center gap-2">Status <Badge>{subscription.status}</Badge></div>
              <p>Properties committed: {subscription.properties_committed}</p>
              <p>Cycle: {new Date(subscription.billing_cycle_start).toLocaleDateString()} – {new Date(subscription.billing_cycle_end).toLocaleDateString()}</p>
              <p>Auto-renew: {subscription.auto_renew ? 'on' : 'off'}</p>
              <Button asChild><Link to="/plans">Change plan</Link></Button>
            </>
          ) : (
            <p className="text-muted-foreground">No active subscription is attached to this workspace.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
