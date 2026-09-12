// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { resolveUiModeFromAgent, useUiMode } from './useUiMode'

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/useIsProCapable', () => ({
  useIsProCapable: vi.fn(),
}))

import { useAuth } from '@/context/AuthContext'
import { useIsProCapable } from '@/hooks/useIsProCapable'

const mockUseAuth = vi.mocked(useAuth)
const mockUseIsProCapable = vi.mocked(useIsProCapable)

describe('resolveUiModeFromAgent', () => {
  it('defaults to guided', () => {
    expect(resolveUiModeFromAgent(null)).toBe('guided')
    expect(resolveUiModeFromAgent({})).toBe('guided')
  })

  it('prefers tenant_membership.data.ui_mode over user data', () => {
    expect(
      resolveUiModeFromAgent({
        ui_mode: 'guided',
        data: { ui_mode: 'guided' },
        tenant_membership: { data: { ui_mode: 'pro' } },
      }),
    ).toBe('pro')
  })

  it('falls back to agent.data then top-level ui_mode', () => {
    expect(resolveUiModeFromAgent({ data: { ui_mode: 'pro' } })).toBe('pro')
    expect(resolveUiModeFromAgent({ ui_mode: 'pro' })).toBe('pro')
  })
})

describe('useUiMode', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('keeps server ui_mode=pro while effectiveMode stays guided below 768px', () => {
    mockUseAuth.mockReturnValue({
      agent: { id: 'a1', ui_mode: 'pro' },
      loading: false,
    } as ReturnType<typeof useAuth>)
    mockUseIsProCapable.mockReturnValue(false)

    const { result } = renderHook(() => useUiMode())
    expect(result.current.uiMode).toBe('pro')
    expect(result.current.effectiveMode).toBe('guided')
    expect(result.current.shouldRenderPro).toBe(false)
  })

  it('renders Pro when ui_mode=pro and viewport is Pro-capable', () => {
    mockUseAuth.mockReturnValue({
      agent: { id: 'a1', tenant_membership: { data: { ui_mode: 'pro' } } },
      loading: false,
    } as ReturnType<typeof useAuth>)
    mockUseIsProCapable.mockReturnValue(true)

    const { result } = renderHook(() => useUiMode())
    expect(result.current.shouldRenderPro).toBe(true)
    expect(result.current.effectiveMode).toBe('pro')
  })
})
