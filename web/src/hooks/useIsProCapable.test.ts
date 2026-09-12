// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { PRO_VIEWPORT_MQ, useIsProCapable } from './useIsProCapable'

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(ev: MediaQueryListEvent) => void>()
  const mql = {
    matches,
    media: PRO_VIEWPORT_MQ,
    onchange: null,
    addEventListener: (_: string, cb: (ev: MediaQueryListEvent) => void) => {
      listeners.add(cb)
    },
    removeEventListener: (_: string, cb: (ev: MediaQueryListEvent) => void) => {
      listeners.delete(cb)
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    _emit(next: boolean) {
      mql.matches = next
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent))
    },
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation(() => mql),
  })
  return mql
}

describe('useIsProCapable', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false below 768px', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useIsProCapable())
    expect(result.current).toBe(false)
  })

  it('returns true at ≥768px', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsProCapable())
    expect(result.current).toBe(true)
  })

  it('updates when viewport crosses the breakpoint', () => {
    const mql = mockMatchMedia(true)
    const { result } = renderHook(() => useIsProCapable())
    expect(result.current).toBe(true)
    act(() => {
      mql._emit(false)
    })
    expect(result.current).toBe(false)
  })

  it('honors force override', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useIsProCapable(true))
    expect(result.current).toBe(true)
  })
})
