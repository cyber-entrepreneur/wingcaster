// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePortalSubmissionPush } from './usePortalSubmissionPush'

const addToast = vi.fn()

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

describe('usePortalSubmissionPush', () => {
  beforeEach(() => {
    addToast.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cross-fades on-screen rows when status_changed fires', () => {
    const patchRow = vi.fn()
    const onInvalidateSummary = vi.fn()
    const { result } = renderHook(() =>
      usePortalSubmissionPush({
        visibleIds: ['att_1'],
        patchRow,
        onInvalidateSummary,
        connect: () => ({ close: vi.fn() }),
      }),
    )

    act(() => {
      result.current.handleEvent({
        type: 'portal_submission.status_changed',
        distribution_attempt_id: 'att_1',
        status: 'live',
        payload: { portal_name: 'Bayut' },
      })
    })

    expect(patchRow).toHaveBeenCalledWith(
      'att_1',
      expect.objectContaining({ status: 'live' }),
    )
    expect(onInvalidateSummary).toHaveBeenCalled()
    expect(result.current.fadingIds.has('att_1')).toBe(true)
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Submission updated' }),
    )

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.fadingIds.has('att_1')).toBe(false)
  })

  it('bumps off-screen update pill without cross-fade', () => {
    const patchRow = vi.fn()
    const { result } = renderHook(() =>
      usePortalSubmissionPush({
        visibleIds: [],
        patchRow,
        connect: () => ({ close: vi.fn() }),
      }),
    )

    act(() => {
      result.current.handleEvent({
        type: 'portal_submission.status_changed',
        distribution_attempt_id: 'att_off',
        status: 'rejected',
      })
    })

    expect(result.current.offscreenUpdateCount).toBe(1)
    expect(result.current.fadingIds.has('att_off')).toBe(false)
  })
})
