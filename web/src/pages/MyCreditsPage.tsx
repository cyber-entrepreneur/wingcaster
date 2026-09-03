import { useCallback, useEffect, useState } from 'react'
import { api, type TenantCreditsBalance } from '@/api/client'
import { Button } from '@/components/ui/button'
import { CreditBalance } from '@/components/credits/CreditBalance'
import { FeatureQuotaBar } from '@/components/credits/FeatureQuotaBar'
import { TopUpDialog } from '@/components/credits/TopUpDialog'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

export function MyCreditsPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('My credits')
  const [data, setData] = useState<TenantCreditsBalance | null>(null)
  const [topUpOpen, setTopUpOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api.getTenantCreditsBalance())
    } catch (err: any) {
      addToast({ title: 'Could not load credits', description: err.message, variant: 'error' })
    }
  }, [addToast])

  useEffect(() => { if (agent) load() }, [agent, load])

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">My credits</h1>
        <Button onClick={() => setTopUpOpen(true)}>Top up</Button>
      </div>
      <CreditBalance
        balance={data?.credits_remaining || 0}
        reserved={data?.credits_reserved || 0}
        hardBlock={data?.hard_block}
      />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Per-feature usage this cycle</h2>
        {(data?.quotas || []).filter((q) => q.registered).map((quota) => (
          <FeatureQuotaBar key={quota.feature_code} quota={quota} />
        ))}
      </div>
      <TopUpDialog open={topUpOpen} onOpenChange={setTopUpOpen} onRequested={load} />
    </div>
  )
}
