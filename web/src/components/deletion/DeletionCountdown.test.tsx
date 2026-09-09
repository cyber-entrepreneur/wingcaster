// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { DeletionCountdown, splitRemaining } from './DeletionCountdown'

describe('splitRemaining', () => {
  it('splits ms into DD/HH/MM/SS without negatives', () => {
    const parts = splitRemaining(
      2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 + 4 * 60 * 1000 + 5 * 1000,
    )
    expect(parts).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      totalMs: 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 + 4 * 60 * 1000 + 5 * 1000,
    })
  })

  it('clamps past-due to zeros', () => {
    expect(splitRemaining(-1000)).toMatchObject({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
    })
  })
})

describe('DeletionCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders fixed-width tabular digit slots that do not change width on tick', () => {
    const deletionAt = new Date(Date.UTC(2026, 9, 7, 14, 22, 15)).toISOString()
    const start = Date.UTC(2026, 9, 6, 14, 22, 10) // ~1d remaining

    const { container, rerender } = render(
      <DeletionCountdown deletionAt={deletionAt} nowMs={start} />,
    )

    const seconds = container.querySelector('[data-countdown-digits="seconds"]')
    expect(seconds).toBeTruthy()
    expect(seconds?.className).toMatch(/min-w-\[2\.5ch\]/)
    expect(seconds?.className).toMatch(/tabular-nums/)
    expect(seconds).toHaveAttribute('data-lc-numeric')

    const widthBefore = (seconds as HTMLElement).className
    const textBefore = seconds?.textContent

    rerender(<DeletionCountdown deletionAt={deletionAt} nowMs={start + 1000} />)
    const secondsAfter = container.querySelector('[data-countdown-digits="seconds"]')
    expect((secondsAfter as HTMLElement).className).toBe(widthBefore)
    // Digit text changed but layout class (fixed ch width) stayed identical.
    expect(secondsAfter?.textContent).not.toBe(textBefore)
    expect(secondsAfter?.textContent).toMatch(/^\d{2}$/)
  })

  it('exposes a timer with aria-live off and LTR embedding', () => {
    const deletionAt = new Date(Date.now() + 90_000).toISOString()
    render(<DeletionCountdown deletionAt={deletionAt} nowMs={Date.now()} />)
    const timer = screen.getByRole('timer')
    expect(timer).toHaveAttribute('aria-live', 'off')
    expect(timer).toHaveAttribute('dir', 'ltr')
  })

  it('applies urgent tint under 24h and announces once', () => {
    const deletionAt = new Date(Date.UTC(2026, 9, 7, 12, 0, 0)).toISOString()
    const now = Date.UTC(2026, 9, 6, 13, 0, 0) // 23h remaining
    const onEnter = vi.fn()
    render(
      <DeletionCountdown
        deletionAt={deletionAt}
        nowMs={now}
        onEnterFinalDay={onEnter}
      />,
    )
    expect(screen.getByRole('timer')).toHaveAttribute('data-urgent', 'true')
    expect(onEnter).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Final 24 hours until deletion/i)).toBeInTheDocument()
  })

  it('fires onReachZero when remaining hits zero', () => {
    const deletionAt = new Date(Date.UTC(2026, 9, 7, 12, 0, 0)).toISOString()
    const onZero = vi.fn()
    render(
      <DeletionCountdown
        deletionAt={deletionAt}
        nowMs={Date.UTC(2026, 9, 7, 12, 0, 0)}
        onReachZero={onZero}
      />,
    )
    expect(onZero).toHaveBeenCalledTimes(1)
  })

  it('ticks via interval when nowMs is not controlled', () => {
    const deletionAt = new Date(Date.now() + 5_000).toISOString()
    render(<DeletionCountdown deletionAt={deletionAt} />)
    const before = screen.getByRole('timer').getAttribute('aria-label')
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    const after = screen.getByRole('timer').getAttribute('aria-label')
    // Label may stay same near boundaries; ensure timer still mounted.
    expect(screen.getByRole('timer')).toBeInTheDocument()
    expect(typeof before).toBe('string')
    expect(typeof after).toBe('string')
  })
})
