// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHotkey } from './useHotkey'

describe('useHotkey', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Windows' })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fires mod+k on Control+K', () => {
    const handler = vi.fn()
    renderHook(() => useHotkey('mod+k', handler))
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not fire when disabled', () => {
    const handler = vi.fn()
    renderHook(() => useHotkey('mod+k', handler, { enabled: false }))
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    })
    expect(handler).not.toHaveBeenCalled()
  })
})
