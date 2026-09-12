// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { PRO_CAPABLE_MQ, useIsProCapable } from './useIsProCapable'

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mql = {
    matches,
    media: PRO_CAPABLE_MQ,
    onchange: null,
    addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.add(cb)
    },
    removeEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.delete(cb)
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
    /** Test helper */
    _setMatches(next: boolean) {
      mql.matches = next
      const event = { matches: next, media: PRO_CAPABLE_MQ } as MediaQueryListEvent
      listeners.forEach((cb) => cb(event))
    },
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      if (query === PRO_CAPABLE_MQ) return mql
      return { matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }
    }),
  })
  return mql
}

describe('useIsProCapable', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false below 768px (D-S-06)', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useIsProCapable())
    expect(result.current).toBe(false)
  })

  it('returns true at ≥768px', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useIsProCapable())
    expect(result.current).toBe(true)
  })

  it('updates when the viewport crosses the Pro breakpoint', () => {
    const mql = stubMatchMedia(true)
    const { result } = renderHook(() => useIsProCapable())
    expect(result.current).toBe(true)

    act(() => {
      mql._setMatches(false)
    })
    expect(result.current).toBe(false)

    act(() => {
      mql._setMatches(true)
    })
    expect(result.current).toBe(true)
  })
})
