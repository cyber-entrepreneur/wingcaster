// @vitest-environment jsdom
/**
 * D-S-06 mount regression: Pro shell only when ui_mode=pro AND ≥768px;
 * otherwise Guided. Server preference is never mutated by the viewport gate.
 *
 * Tests the thin mount helper (not the Guided dashboard module graph).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const useUiModeMock = vi.fn()

vi.mock('@/hooks/useUiMode', () => ({
  useUiMode: () => useUiModeMock(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'agent-1', name: 'Sara Khalil', ui_mode: 'pro' },
    loading: false,
  }),
}))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    activeTenant: { id: 'personal:agent-1', name: 'Personal', kind: 'personal', uiMode: 'pro' },
    loading: false,
    refresh: vi.fn(),
  }),
}))

import {
  AgentDashboardModeMount,
  AgentDashboardProGate,
} from '@/pages/agent/dashboard/AgentDashboardModeMount'

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('AgentDashboardModeMount (AGT-DSH-002)', () => {
  it('mounts ProDashboard when shouldRenderPro is true', async () => {
    wrap(
      <AgentDashboardModeMount
        shouldRenderPro
        agentName="Sara"
        guided={<div data-testid="guided-dashboard" />}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('pro-dashboard')).toBeTruthy()
    })
    expect(screen.queryByTestId('guided-dashboard')).toBeNull()
  })

  it('keeps Guided when shouldRenderPro is false (D-S-06 mobile fallback)', () => {
    wrap(
      <AgentDashboardModeMount
        shouldRenderPro={false}
        guided={<div data-testid="guided-dashboard" />}
      />,
    )

    expect(screen.getByTestId('guided-dashboard')).toBeTruthy()
    expect(screen.queryByTestId('pro-dashboard')).toBeNull()
  })
})

describe('AgentDashboardProGate', () => {
  beforeEach(() => {
    useUiModeMock.mockReset()
  })

  it('mounts Pro when hook says shouldRenderPro', async () => {
    useUiModeMock.mockReturnValue({
      uiMode: 'pro',
      effectiveMode: 'pro',
      shouldRenderPro: true,
      loading: false,
    })

    wrap(<AgentDashboardProGate guided={<div data-testid="guided-dashboard" />} />)

    await waitFor(() => {
      expect(screen.getByTestId('pro-dashboard')).toBeTruthy()
    })
    expect(screen.queryByTestId('guided-dashboard')).toBeNull()
  })

  it('preserves Guided when ui_mode=pro but viewport is not Pro-capable', () => {
    useUiModeMock.mockReturnValue({
      uiMode: 'pro',
      effectiveMode: 'guided',
      shouldRenderPro: false,
      loading: false,
    })

    wrap(<AgentDashboardProGate guided={<div data-testid="guided-dashboard" />} />)

    expect(screen.getByTestId('guided-dashboard')).toBeTruthy()
    expect(screen.queryByTestId('pro-dashboard')).toBeNull()
  })
})
