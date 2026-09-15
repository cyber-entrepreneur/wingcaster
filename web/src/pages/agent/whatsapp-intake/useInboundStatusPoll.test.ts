// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useInboundStatusPoll } from './useInboundStatusPoll'

const getInboundStatus = vi.fn()
const listBindings = vi.fn()

vi.mock('./intakeApi', () => ({
  getInboundStatus: (...args: unknown[]) => getInboundStatus(...args),
  listBindings: (...args: unknown[]) => listBindings(...args),
}))

beforeEach(() => {
  getInboundStatus.mockReset()
  listBindings.mockReset()
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

describe('useInboundStatusPoll', () => {
  it('uses 2s → 5s after 30s → 10s after 90s backoff and caps at 24h', async () => {
    listBindings.mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: 'bind-1', phone_e164: '+971501234567' }],
    })
    getInboundStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        bound: true,
        binding_id: 'bind-1',
        latest_message_at: null,
        draft_session_id: null,
      },
    })

    const { result } = renderHook(() =>
      useInboundStatusPoll({
        intervalMs: 2000,
        backoffAfterMs: 30_000,
        backoffIntervalMs: 5000,
        lateBackoffAfterMs: 90_000,
        lateBackoffIntervalMs: 10_000,
        capMs: 24 * 60 * 60 * 1000,
      }),
    )

    await waitFor(() => expect(getInboundStatus).toHaveBeenCalled())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(getInboundStatus.mock.calls.length).toBeGreaterThanOrEqual(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    const mid = getInboundStatus.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(getInboundStatus.mock.calls.length).toBeGreaterThan(mid)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    const late = getInboundStatus.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(getInboundStatus.mock.calls.length).toBeGreaterThan(late)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
    })
    await waitFor(() => expect(result.current.capReached).toBe(true))
  })

  it('pauses when document is hidden', async () => {
    let hidden = false
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    })
    listBindings.mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: 'bind-1', phone_e164: '+971501234567' }],
    })
    getInboundStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        bound: true,
        binding_id: 'bind-1',
        latest_message_at: null,
        draft_session_id: null,
      },
    })

    renderHook(() => useInboundStatusPoll({ intervalMs: 1000, capMs: 60_000 }))
    await waitFor(() => expect(getInboundStatus).toHaveBeenCalled())

    hidden = true
    const whileHidden = getInboundStatus.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })
    expect(getInboundStatus.mock.calls.length).toBe(whileHidden)

    hidden = false
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(getInboundStatus.mock.calls.length).toBeGreaterThan(whileHidden))
  })

  it('sets bindingLost when inbound reports bound:false and stops polling', async () => {
    getInboundStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        bound: false,
        binding_id: 'bind-1',
        latest_message_at: null,
        draft_session_id: null,
      },
    })

    const { result } = renderHook(() =>
      useInboundStatusPoll({
        bindingId: 'bind-1',
        intervalMs: 1000,
        capMs: 60_000,
      }),
    )

    await waitFor(() => expect(result.current.bindingLost).toBe(true))
    const calls = getInboundStatus.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(getInboundStatus.mock.calls.length).toBe(calls)
  })

  it('stops when a first message arrives (latest_message_at set)', async () => {
    getInboundStatus.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        bound: true,
        binding_id: 'bind-1',
        latest_message_at: new Date().toISOString(),
        draft_session_id: 'sess-1',
      },
    })

    const { result } = renderHook(() =>
      useInboundStatusPoll({ bindingId: 'bind-1', intervalMs: 1000, capMs: 60_000 }),
    )

    await waitFor(() => expect(result.current.inbound?.draft_session_id).toBe('sess-1'))
    const calls = getInboundStatus.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(getInboundStatus.mock.calls.length).toBe(calls)
  })
})
