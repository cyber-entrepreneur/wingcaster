import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'
import {
  flagsFromSubscription,
  hasPriceReportsSubmitFeature,
  type PackageFeatureFlags,
} from './types'
import { PRICE_REPORTS_SUBMIT_FEATURE } from './constants'

export type UsePackageFeatureFlagsResult = {
  loading: boolean
  flags: PackageFeatureFlags
  hasPriceReportsSubmit: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Reads the caller's package feature flags for AGT-APR-005 tier gating.
 * Uses GET /api/tenant/subscription (existing surface) — never invents a
 * client-only bypass; missing / non-Pro → upsell.
 */
export function usePackageFeatureFlags(
  /** Test / Storybook override — skips network when provided. */
  overrideFlags?: PackageFeatureFlags | null,
): UsePackageFeatureFlagsResult {
  const [loading, setLoading] = useState(overrideFlags == null)
  const [flags, setFlags] = useState<PackageFeatureFlags>(overrideFlags ?? {})
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (overrideFlags != null) {
      setFlags(overrideFlags)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.getTenantSubscription()
      setFlags(flagsFromSubscription(res.subscription))
    } catch (err) {
      setFlags({ [PRICE_REPORTS_SUBMIT_FEATURE]: false })
      setError(err instanceof Error ? err.message : 'Could not load subscription')
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
    refresh,
  }
}
