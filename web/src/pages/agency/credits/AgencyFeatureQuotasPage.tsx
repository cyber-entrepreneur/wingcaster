import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api, type AgencyFeatureQuotasResponse } from '@/api/client'
import { AgencyFeatureQuotaCard } from '@/components/credits/AgencyFeatureQuotaCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

export function AgencyFeatureQuotasPage() {
  const { agent } = useAuth()
  const affiliation = (agent?.affiliation as { role?: string } | undefined) || undefined
  const role = affiliation?.role || null
  const canAttemptLoad = Boolean(role === 'owner' || role === 'admin' || role === 'member')

  const [data, setData] = useState<AgencyFeatureQuotasResponse | null>(null)
  const [loadState, setLoadState] = useState<LoadState>(canAttemptLoad ? 'loading' : 'forbidden')

  const load = useCallback(async () => {
    if (!canAttemptLoad) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      setData(await api.getAgencyFeatureQuotas())
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) setLoadState('forbidden')
      else setLoadState('error')
    }
  }, [canAttemptLoad])

  useEffect(() => {
    void load()
  }, [load])

  if (loadState === 'forbidden') {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--lc-text-muted)]">
          You need owner, admin, finance, marketer, or read-only access to view agency feature quotas.
        </p>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" aria-label="Loading quotas" />
      </div>
    )
  }

  if (loadState === 'error' || !data) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-[var(--lc-text-muted)]">Feature quotas could not be loaded.</p>
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    )
  }

  if (!data.groups.length) {
    return (
      <div className="rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-8 text-center">
        <p className="text-[var(--lc-text-muted)]">No metered feature usage recorded for this billing cycle yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8" data-screen="AGN-CRD-006">
      {data.billing_cycle_start && data.billing_cycle_end && (
        <p className="text-sm text-[var(--lc-text-muted)]">
          Billing cycle {new Date(data.billing_cycle_start).toLocaleDateString()} –{' '}
          {new Date(data.billing_cycle_end).toLocaleDateString()}
        </p>
      )}

      {data.groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--lc-text-primary)]">{group.label}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {group.quotas.map((quota) => (
              <AgencyFeatureQuotaCard key={quota.feature_code} quota={quota} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
