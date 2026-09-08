// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const authMock = vi.hoisted(() => ({
  agent: null as null | { id: string; env?: string; platform_role?: string },
  loading: false,
  isAdmin: true,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

const setAuthToken = vi.hoisted(() => vi.fn())
vi.mock('@/api/client', () => ({
  API_BASE: '/api',
  setAuthToken,
}))

import {
  CONFIRM_REQUIRED_ERROR,
  ENV_STORAGE_KEY,
  LIVE_SWITCH_CONFIRM_TOKEN,
  WINGCASTER_ENV_HEADER,
  __resetEnvStoreForTests,
  getWingcasterEnv,
  normalizeEnv,
  postEnvSwitch,
  setWingcasterEnvMirror,
  useEnv,
} from './useEnv'
import { publishSessionEvent } from '@/lib/broadcast'

describe('normalizeEnv', () => {
  it('maps TEST/test to test and everything else to live', () => {
    expect(normalizeEnv('TEST')).toBe('test')
    expect(normalizeEnv('test')).toBe('test')
    expect(normalizeEnv('LIVE')).toBe('live')
    expect(normalizeEnv(null)).toBe('live')
  })
})

describe('useEnv / postEnvSwitch', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    __resetEnvStoreForTests('live')
    authMock.agent = { id: 'a1', platform_role: 'platform_admin', env: 'live' }
    authMock.loading = false
    authMock.isAdmin = true
    setAuthToken.mockClear()

    class MockBroadcastChannel {
      name: string
      static listeners = new Set<(event: MessageEvent) => void>()
      constructor(name: string) {
        this.name = name
      }
      postMessage(data: unknown) {
        const event = { data } as MessageEvent
        for (const listener of MockBroadcastChannel.listeners) listener(event)
      }
      addEventListener(_type: string, listener: EventListener) {
        MockBroadcastChannel.listeners.add(listener as (event: MessageEvent) => void)
      }
      removeEventListener(_type: string, listener: EventListener) {
        MockBroadcastChannel.listeners.delete(listener as (event: MessageEvent) => void)
      }
      close() {
        MockBroadcastChannel.listeners.clear()
      }
    }
    MockBroadcastChannel.listeners.clear()
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name === WINGCASTER_ENV_HEADER ? 'test' : null) },
        text: async () => JSON.stringify({ token: 'new-tok', env: 'test' }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    sessionStorage.clear()
    __resetEnvStoreForTests('live')
  })

  it('mirrors env to storage and getWingcasterEnv', () => {
    setWingcasterEnvMirror('test')
    expect(getWingcasterEnv()).toBe('test')
    expect(sessionStorage.getItem(ENV_STORAGE_KEY)).toBe('test')
    expect(localStorage.getItem(ENV_STORAGE_KEY)).toBe('test')
  })

  it('posts /admin/env/switch with X-Wingcaster-Env and updates mirror', async () => {
    localStorage.setItem('fi_token', 'tok')
    const next = await postEnvSwitch('test')
    expect(next).toBe('test')
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/env/switch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ target: 'test' }),
      }),
    )
    const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers
    expect(headers[WINGCASTER_ENV_HEADER]).toBe('live')
    expect(headers.Authorization).toBe('Bearer tok')
    expect(setAuthToken).toHaveBeenCalledWith('new-tok')
    expect(getWingcasterEnv()).toBe('test')
  })

  it('selectEnv(test) switches immediately; selectEnv(live) only opens confirm', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    })

    authMock.agent = { id: 'a1', platform_role: 'platform_admin', env: 'test' }
    __resetEnvStoreForTests('test')
    const { result } = renderHook(() => useEnv())
    expect(result.current.env).toBe('test')
    expect(result.current.confirmLiveOpen).toBe(false)

    await act(async () => {
      await result.current.selectEnv('live')
    })
    expect(result.current.confirmLiveOpen).toBe(true)
    expect(fetch).not.toHaveBeenCalled()

    authMock.agent = { id: 'a1', platform_role: 'platform_admin', env: 'live' }
    __resetEnvStoreForTests('live')
    vi.mocked(fetch).mockClear()
    const { result: result2 } = renderHook(() => useEnv())

    await act(async () => {
      await result2.current.selectEnv('test')
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })
  })

  it('confirmSwitchToLive rejects without confirmed: true', async () => {
    const { result } = renderHook(() => useEnv())
    await expect(
      // @ts-expect-error intentional bypass attempt
      result.current.confirmSwitchToLive({ confirmed: false }),
    ).rejects.toThrow(CONFIRM_REQUIRED_ERROR)
    await expect(
      // @ts-expect-error intentional bypass attempt
      result.current.confirmSwitchToLive({}),
    ).rejects.toThrow(CONFIRM_REQUIRED_ERROR)
    expect(LIVE_SWITCH_CONFIRM_TOKEN).toBe('SWITCH TO LIVE')
  })

  it('shared store keeps confirmLiveOpen in sync across hook instances', () => {
    authMock.agent = { id: 'a1', platform_role: 'platform_admin', env: 'test' }
    __resetEnvStoreForTests('test')
    const { result: c } = renderHook(() => useEnv())
    const { result: d } = renderHook(() => useEnv())

    act(() => {
      c.current.openLiveConfirm()
    })
    expect(d.current.confirmLiveOpen).toBe(true)
    expect(c.current.env).toBe('test')
  })

  it('reacts to cross-tab env-changed publish', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    })

    __resetEnvStoreForTests('live')
    const { result } = renderHook(() => useEnv())
    expect(result.current.env).toBe('live')

    act(() => {
      publishSessionEvent({ type: 'env-changed', env: 'test' })
    })

    await waitFor(() => {
      expect(result.current.env).toBe('test')
      expect(result.current.sessionChangedElsewhere).toBe(true)
    })
  })
})
