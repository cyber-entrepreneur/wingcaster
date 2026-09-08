// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const authMock = vi.hoisted(() => ({
  agent: null as null | { id: string; preferred_locale?: string },
  loading: false,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/api/client', () => ({
  API_BASE: '/api',
}))

import {
  applyDocumentLocale,
  LOCALE_STORAGE_KEY,
  persistPreferredLocale,
  resolveLocale,
  useLocale,
} from './useLocale'
import { publishSessionEvent } from '@/lib/broadcast'

describe('resolveLocale', () => {
  it('prefers preferred_locale, then localStorage, then navigator ar-*, else en', () => {
    expect(
      resolveLocale({
        preferredLocale: 'ar',
        storedLocale: 'en',
        navigatorLanguage: 'en-US',
      }),
    ).toBe('ar')
    expect(
      resolveLocale({
        preferredLocale: null,
        storedLocale: 'ar',
        navigatorLanguage: 'en-US',
      }),
    ).toBe('ar')
    expect(
      resolveLocale({
        preferredLocale: null,
        storedLocale: null,
        navigatorLanguage: 'ar-EG',
      }),
    ).toBe('ar')
    expect(
      resolveLocale({
        preferredLocale: null,
        storedLocale: null,
        navigatorLanguage: 'en-GB',
      }),
    ).toBe('en')
  })
})

describe('applyDocumentLocale', () => {
  it('sets html lang + dir immediately', () => {
    applyDocumentLocale('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    applyDocumentLocale('en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
  })
})

describe('persistPreferredLocale', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true }),
    )
    localStorage.setItem('fi_token', 'test-token')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('PATCHes preferred_locale on /users/me', async () => {
    await persistPreferredLocale('ar')
    expect(fetch).toHaveBeenCalledWith(
      '/api/users/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ preferred_locale: 'ar' }),
      }),
    )
  })
})

describe('useLocale', () => {
  let listeners: Set<(event: MessageEvent) => void>

  beforeEach(() => {
    localStorage.clear()
    authMock.agent = null
    authMock.loading = false
    document.documentElement.removeAttribute('lang')
    document.documentElement.removeAttribute('dir')

    listeners = new Set()
    class MockBroadcastChannel {
      name: string
      constructor(name: string) {
        this.name = name
      }
      postMessage(data: unknown) {
        const event = { data } as MessageEvent
        for (const listener of listeners) listener(event)
      }
      addEventListener(_type: string, listener: EventListener) {
        listeners.add(listener as (event: MessageEvent) => void)
      }
      removeEventListener(_type: string, listener: EventListener) {
        listeners.delete(listener as (event: MessageEvent) => void)
      }
      close() {
        listeners.clear()
      }
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('writes localStorage and syncs html for anonymous switch', async () => {
    const { result } = renderHook(() => useLocale())

    await act(async () => {
      const res = await result.current.setLocale('ar')
      expect(res.ok).toBe(true)
    })

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('PATCHes preferred_locale when signed in', async () => {
    authMock.agent = { id: 'a1', preferred_locale: 'en' }
    localStorage.setItem('fi_token', 'tok')
    const { result } = renderHook(() => useLocale())

    await act(async () => {
      await result.current.setLocale('ar')
    })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/users/me',
        expect.objectContaining({ method: 'PATCH' }),
      )
    })
  })

  it('applies cross-tab locale-changed events', async () => {
    const { result } = renderHook(() => useLocale())

    await act(async () => {
      publishSessionEvent({ type: 'locale-changed', locale: 'ar' })
    })

    await waitFor(() => {
      expect(result.current.locale).toBe('ar')
      expect(document.documentElement.dir).toBe('rtl')
    })
  })

  it('returns switchFailed when persistence rejects', async () => {
    authMock.agent = { id: 'a1' }
    localStorage.setItem('fi_token', 'tok')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const { result } = renderHook(() => useLocale())

    let res: Awaited<ReturnType<typeof result.current.setLocale>> | undefined
    await act(async () => {
      res = await result.current.setLocale('ar')
    })

    expect(res?.ok).toBe(false)
    if (res && !res.ok) {
      expect(res.error).toBe('switchFailed')
    }
    // Visual switch still applied
    expect(document.documentElement.lang).toBe('ar')
  })
})
