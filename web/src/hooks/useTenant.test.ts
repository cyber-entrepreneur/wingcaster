// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { normalizeTenant, sortTenants, useTenant } from './useTenant'

const fetchMock = vi.fn()
const setAuthTokenMock = vi.fn()
const publishMock = vi.fn()
let sessionListener: ((event: { type: string; tenantId?: string }) => void) | null = null

vi.mock('@/api/client', () => ({
  API_BASE: '/api',
  setAuthToken: (...args: unknown[]) => setAuthTokenMock(...args),
}))

vi.mock('@/lib/broadcast', () => ({
  publishSessionEvent: (...args: unknown[]) => publishMock(...args),
  subscribeSessionEvents: (listener: (event: { type: string; tenantId?: string }) => void) => {
    sessionListener = listener
    return () => {
      sessionListener = null
    }
  },
}))

const SAMPLE = {
  tenants: [
    {
      id: 'agency-elite',
      name: 'Elite Real Estate',
      role: 'owner',
      tenantType: 'agency',
      listingsCount: 47,
      agentsCount: 5,
      otherMembersCount: 4,
    },
    {
      id: 'personal:u1',
      name: 'Sara Almansoori',
      role: 'owner',
      tenantType: 'personal',
      listingsCount: 3,
      agentsCount: 1,
      isActive: true,
    },
    {
      id: 'agency-dpc',
      name: 'Dubai Properties Consortium',
      role: 'member',
      tenantType: 'agency',
      listingsCount: 213,
      agentsCount: 23,
      otherMembersCount: 22,
    },
  ],
  activeTenantId: 'personal:u1',
}

describe('sortTenants / normalizeTenant', () => {
  it('keeps personal first then agencies by role', () => {
    const sorted = sortTenants(SAMPLE.tenants.map(normalizeTenant))
    expect(sorted.map((t) => t.id)).toEqual(['personal:u1', 'agency-elite', 'agency-dpc'])
  })
})

describe('useTenant', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    setAuthTokenMock.mockReset()
    publishMock.mockReset()
    sessionListener = null
    localStorage.clear()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads tenants and mirrors the active id to localStorage', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(SAMPLE),
    })

    const { result } = renderHook(() => useTenant())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.tenants).toHaveLength(3)
    expect(result.current.activeTenantId).toBe('personal:u1')
    expect(result.current.isMultiTenant).toBe(true)
    expect(localStorage.getItem('wc_active_tenant_id')).toBe('personal:u1')
  })

  it('POSTs switch-tenant, updates session token, and publishes tenant-switched', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(SAMPLE),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            token: 'fresh-jwt',
            activeTenantId: 'agency-elite',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ...SAMPLE,
            activeTenantId: 'agency-elite',
            tenants: SAMPLE.tenants.map((t) => ({
              ...t,
              isActive: t.id === 'agency-elite',
            })),
          }),
      })

    const { result } = renderHook(() => useTenant())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.switchTenant('agency-elite')
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/switch-tenant',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tenantId: 'agency-elite' }),
      }),
    )
    expect(setAuthTokenMock).toHaveBeenCalledWith('fresh-jwt')
    expect(publishMock).toHaveBeenCalledWith({ type: 'tenant-switched', tenantId: 'agency-elite' })
    expect(result.current.activeTenantId).toBe('agency-elite')
  })

  it('applies cross-tab tenant-switched events', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(SAMPLE),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ...SAMPLE,
            activeTenantId: 'agency-dpc',
          }),
      })

    const { result } = renderHook(() => useTenant())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(sessionListener).toBeTruthy()

    await act(async () => {
      sessionListener?.({ type: 'tenant-switched', tenantId: 'agency-dpc' })
    })

    await waitFor(() => expect(result.current.activeTenantId).toBe('agency-dpc'))
  })
})
