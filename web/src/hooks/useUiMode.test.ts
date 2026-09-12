// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const tenantMock = vi.hoisted(() => ({
  activeTenant: {
    id: 'personal:user-1',
    name: 'Personal',
    avatarUrl: null,
    role: 'owner' as const,
    kind: 'personal' as const,
    listingsCount: 0,
    agentsCount: 1,
    uiMode: 'guided' as 'guided' | 'pro',
  },
  loading: false,
  refresh: vi.fn(async () => {}),
}))

const authMock = vi.hoisted(() => ({
  agent: { id: 'user-1', name: 'Sara' },
  loading: false,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => tenantMock,
}))

vi.mock('@/api/client', () => ({
  API_BASE: '/api',
}))

import { persistUiMode, useUiMode } from './useUiMode'

describe('useUiMode', () => {
  beforeEach(() => {
    tenantMock.activeTenant.uiMode = 'guided'
    tenantMock.refresh.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ui_mode: 'pro' }),
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('effectiveMode stays guided when server is pro but viewport <768', () => {
    const { result } = renderHook(() => useUiMode({ forceProCapable: false }))
    tenantMock.activeTenant.uiMode = 'pro'
    const { result: again } = renderHook(() => useUiMode({ forceProCapable: false }))
    expect(again.current.mode).toBe('pro')
    expect(again.current.effectiveMode).toBe('guided')
    expect(result.current.effectiveMode).toBe('guided')
  })

  it('effectiveMode is pro when server is pro and viewport ≥768', () => {
    tenantMock.activeTenant.uiMode = 'pro'
    const { result } = renderHook(() => useUiMode({ forceProCapable: true }))
    expect(result.current.mode).toBe('pro')
    expect(result.current.effectiveMode).toBe('pro')
    expect(result.current.shouldRenderPro).toBe(true)
  })

  it('shouldRenderPro is false when ui_mode=pro but viewport <768 (preference preserved)', () => {
    tenantMock.activeTenant.uiMode = 'pro'
    const { result } = renderHook(() => useUiMode({ forceProCapable: false }))
    expect(result.current.mode).toBe('pro')
    expect(result.current.effectiveMode).toBe('guided')
    expect(result.current.shouldRenderPro).toBe(false)
  })

  it('setMode blocks pro when not viewport-capable', async () => {
    const { result } = renderHook(() => useUiMode({ forceProCapable: false }))
    let outcome: Awaited<ReturnType<typeof result.current.setMode>> | undefined
    await act(async () => {
      outcome = await result.current.setMode('pro')
    })
    expect(outcome?.ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('setMode PATCHes ui_mode on desktop', async () => {
    const { result } = renderHook(() => useUiMode({ forceProCapable: true }))
    await act(async () => {
      const outcome = await result.current.setMode('pro')
      expect(outcome.ok).toBe(true)
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/users/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ ui_mode: 'pro' }),
      }),
    )
    await waitFor(() => expect(tenantMock.refresh).toHaveBeenCalled())
  })

  it('persistUiMode posts to /users/me', async () => {
    const result = await persistUiMode('guided')
    expect(result.ok).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      '/api/users/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ ui_mode: 'guided' }),
      }),
    )
  })
})
