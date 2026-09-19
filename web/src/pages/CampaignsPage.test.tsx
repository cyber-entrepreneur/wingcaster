// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CampaignsPage } from './CampaignsPage'

const apiMock = vi.hoisted(() => ({
  getCampaigns: vi.fn(),
}))
const uiModeMock = vi.hoisted(() => ({
  effectiveMode: 'guided' as 'guided' | 'pro',
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/hooks/useUiMode', () => ({
  useUiMode: () => ({
    effectiveMode: uiModeMock.effectiveMode,
    mode: uiModeMock.effectiveMode,
    shouldRenderPro: uiModeMock.effectiveMode === 'pro',
    isProCapable: true,
    loading: false,
    switching: false,
    setMode: vi.fn(),
    refresh: vi.fn(),
  }),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'agt_1', name: 'Sara' },
    loading: false,
    isAdmin: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

function renderPage() {
  return render(
    <MemoryRouter>
      <CampaignsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  uiModeMock.effectiveMode = 'guided'
  apiMock.getCampaigns.mockReset().mockResolvedValue([])
})

afterEach(() => cleanup())

describe('CampaignsPage (AGT-CMP-001)', () => {
  it('shows guided goal picker instead of a New campaign button', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('campaign-goal-picker')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /New campaign/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('campaign-goal-price_drop')).toHaveAttribute('href', '/campaigns/new?goal=price_drop')
  })

  it('shows Pro new-campaign CTA when effective mode is pro', async () => {
    uiModeMock.effectiveMode = 'pro'
    renderPage()
    await waitFor(() => expect(screen.getByRole('link', { name: /New campaign/i })).toBeInTheDocument())
    expect(screen.queryByTestId('campaign-goal-picker')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /New campaign/i })).toHaveAttribute(
      'href',
      '/campaigns/new?mode=pro',
    )
  })
})
