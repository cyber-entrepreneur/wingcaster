import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import {
  flagsFromSubscription,
  hasPriceReportsSubmitFeature,
  type PackageFeatureFlags,
} from './types'
import { PRICE_REPORTS_SUBMIT_FEATURE } from './constants'

export type SubscriptionLoadState = 'idle' | 'loading' | 'ready' | 'unavailable'

export type UsePackageFeatureFlagsResult = {
  loading: boolean
  flags: PackageFeatureFlags
  hasPriceReportsSubmit: boolean
  error: string | null
  /** Distinct from "feature off" — subscription surface could not be loaded. */
  subscriptionUnavailable: boolean
  loadState: SubscriptionLoadState
  refresh: () => Promise<void>
}

/**
 * Reads the caller's package feature flags for AGT-APR-005 tier gating.
 * Uses GET /api/tenant/subscription (existing surface) — never invents a
 * client-only bypass; missing / non-Pro → upsell.
 * Network/subscription errors surface as `subscriptionUnavailable` rather
 * than silently treating the feature as disabled.
 */
export function usePackageFeatureFlags(
  /** Test / Storybook override — skips network when provided. */
  overrideFlags?: PackageFeatureFlags | null,
): UsePackageFeatureFlagsResult {
  const [loading, setLoading] = useState(overrideFlags == null)
  const [flags, setFlags] = useState<PackageFeatureFlags>(overrideFlags ?? {})
  const [error, setError] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<SubscriptionLoadState>(
    overrideFlags != null ? 'ready' : 'loading',
  )

  const refresh = useCallback(async () => {
    if (overrideFlags != null) {
      setFlags(overrideFlags)
      setLoading(false)
      setError(null)
      setLoadState('ready')
      return
    }
    setLoading(true)
    setError(null)
    setLoadState('loading')
    try {
      const res = await api.getTenantSubscription()
      setFlags(flagsFromSubscription(res.subscription))
      setLoadState('ready')
    } catch (err) {
      setFlags({})
      setError(err instanceof Error ? err.message : 'Could not load subscription')
      setLoadState('unavailable')
    } finally {
      setLoading(false)
    }
  }, [overrideFlags])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    loading,
    flags,
    hasPriceReportsSubmit: hasPriceReportsSubmitFeature(flags),
    error,
    subscriptionUnavailable: loadState === 'unavailable',
    loadState,
    refresh,
  }
}
