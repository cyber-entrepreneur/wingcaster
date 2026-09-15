// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useBindingStatusPoll } from './useBindingStatusPoll'

const getBindingStatus = vi.fn()

vi.mock('./intakeApi', () => ({
  getBindingStatus: (...args: unknown[]) => getBindingStatus(...args),
}))

beforeEach(() => {
  getBindingStatus.mockReset()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useBindingStatusPoll', () => {
  it('backs off from 3s to 10s after 60s and caps at 24h', async () => {
    getBindingStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: { bound: false },
    })

    const { result } = renderHook(() =>
      useBindingStatusPoll({
        intervalMs: 3000,
        backoffAfterMs: 60_000,
        backoffIntervalMs: 10_000,
        capMs: 24 * 60 * 60 * 1000,
      }),
    )

    await waitFor(() => expect(getBindingStatus).toHaveBeenCalledTimes(1))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(getBindingStatus.mock.calls.length).toBeGreaterThanOrEqual(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    const afterBackoff = getBindingStatus.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(getBindingStatus.mock.calls.length).toBeGreaterThan(afterBackoff)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
    })
    await waitFor(() => expect(result.current.capReached).toBe(true))
    const capped = getBindingStatus.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(getBindingStatus.mock.calls.length).toBe(capped)
  })

  it('pauses while the tab is hidden and resumes on visibilitychange', async () => {
    let hidden = false
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    })

    getBindingStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: { bound: false },
    })

    renderHook(() =>
      useBindingStatusPoll({
        intervalMs: 1000,
        backoffAfterMs: 60_000,
        backoffIntervalMs: 10_000,
        capMs: 60_000,
      }),
    )

    await waitFor(() => expect(getBindingStatus).toHaveBeenCalledTimes(1))

    hidden = true
    const whileHidden = getBindingStatus.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(getBindingStatus.mock.calls.length).toBe(whileHidden)

    hidden = false
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(getBindingStatus.mock.calls.length).toBeGreaterThan(whileHidden))
  })

  it('stops when bound becomes true', async () => {
    getBindingStatus
      .mockResolvedValueOnce({ ok: true, status: 200, data: { bound: false } })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { bound: true, phone_e164: '+971501234567' },
      })

    const { result } = renderHook(() =>
      useBindingStatusPoll({ intervalMs: 1000, capMs: 60_000 }),
    )

    await waitFor(() => expect(getBindingStatus).toHaveBeenCalledTimes(1))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    await waitFor(() => expect(result.current.bound).toBe(true))
    const calls = getBindingStatus.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(getBindingStatus.mock.calls.length).toBe(calls)
  })
})
