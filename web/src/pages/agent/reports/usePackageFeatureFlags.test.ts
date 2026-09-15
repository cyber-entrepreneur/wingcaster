// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { PRICE_REPORTS_SUBMIT_FEATURE } from './constants'

const apiMock = vi.hoisted(() => ({
  getTenantSubscription: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

import { usePackageFeatureFlags } from './usePackageFeatureFlags'

describe('usePackageFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks subscriptionUnavailable on fetch error (distinct from feature-off)', async () => {
    apiMock.getTenantSubscription.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => usePackageFeatureFlags())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.subscriptionUnavailable).toBe(true)
    expect(result.current.hasPriceReportsSubmit).toBe(false)
    expect(result.current.loadState).toBe('unavailable')
  })

  it('resolves Pro feature when subscription loads', async () => {
    apiMock.getTenantSubscription.mockResolvedValue({
      subscription: { tier: 'pro', package_code: 'pro-agent' },
    })
    const { result } = renderHook(() => usePackageFeatureFlags())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.subscriptionUnavailable).toBe(false)
    expect(result.current.hasPriceReportsSubmit).toBe(true)
    expect(result.current.flags[PRICE_REPORTS_SUBMIT_FEATURE]).toBe(true)
  })
})
