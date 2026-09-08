// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useVisualViewportKeyboardVisible } from '@/hooks/useVisualViewportKeyboardVisible'

function mockVisualViewport(height: number, innerHeight = 800) {
  const listeners = new Map<string, Set<() => void>>()
  const vv = {
    height,
    width: 375,
    addEventListener: (type: string, cb: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(cb)
    },
    removeEventListener: (type: string, cb: () => void) => {
      listeners.get(type)?.delete(cb)
    },
  }
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    writable: true,
    value: vv,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: innerHeight,
  })
  return {
    setHeight(next: number) {
      ;(vv as { height: number }).height = next
      listeners.get('resize')?.forEach((cb) => cb())
    },
  }
}

function Probe() {
  const visible = useVisualViewportKeyboardVisible()
  return <div data-testid="keyboard-visible">{String(visible)}</div>
}

describe('useVisualViewportKeyboardVisible', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is false when visualViewport nearly fills the window', () => {
    mockVisualViewport(750, 800)
    render(<Probe />)
    expect(screen.getByTestId('keyboard-visible')).toHaveTextContent('false')
  })

  it('is true when visualViewport shrinks by more than 100px', () => {
    mockVisualViewport(600, 800)
    render(<Probe />)
    expect(screen.getByTestId('keyboard-visible')).toHaveTextContent('true')
  })

  it('updates when the viewport resizes', () => {
    const vv = mockVisualViewport(800, 800)
    render(<Probe />)
    expect(screen.getByTestId('keyboard-visible')).toHaveTextContent('false')
    act(() => {
      vv.setHeight(400)
    })
    expect(screen.getByTestId('keyboard-visible')).toHaveTextContent('true')
  })
})
