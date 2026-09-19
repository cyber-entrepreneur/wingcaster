// @vitest-environment jsdom
/**
 * AGT-OPP-001b — Guided opportunities list view.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getOpportunities: vi.fn(),
  getContacts: vi.fn(),
  updateOpportunity: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))
vi.mock('@/components/layout/CrmShell', () => ({
  CrmShell: ({ children }: { children: React.ReactNode }) => <div data-testid="crm-shell">{children}</div>,
}))
const authState = vi.hoisted(() => ({
  agent: { id: 'agent-1', name: 'Sara' },
  loading: false,
}))
vi.mock('@/context/AuthContext', () => ({
  // Stable agent identity — a fresh {} each render retriggers load useEffect([agent?.id]).
  useAuth: () => authState,
}))
const uiModeMock = vi.hoisted(() => ({
  mode: 'guided' as 'guided' | 'pro',
  effectiveMode: 'guided' as 'guided' | 'pro',
  isProCapable: false,
}))
vi.mock('@/hooks/useUiMode', () => ({
  useUiMode: () => ({
    mode: uiModeMock.mode,
    effectiveMode: uiModeMock.effectiveMode,
    isProCapable: uiModeMock.isProCapable,
    shouldRenderPro: uiModeMock.effectiveMode === 'pro',
    loading: false,
    switching: false,
    setMode: vi.fn(),
    refresh: vi.fn(),
  }),
}))

import { OpportunitiesPage } from './OpportunitiesPage'

const SAMPLE = [
  {
    id: 'opp-1',
    contact_id: 'c-1',
    property_id: null,
    stage: 'qualification',
    deal_value: 250000,
    currency: 'USD',
    probability: 40,
    expected_close_date: '2026-10-01T00:00:00.000Z',
    lost_reason: '',
    closed_at: null,
    notes: '',
    created_at: '2026-09-18T00:00:00.000Z',
    updated_at: '2026-09-18T00:00:00.000Z',
  },
]

function renderPage(initialEntry = '/opportunities') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <OpportunitiesPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  uiModeMock.mode = 'guided'
  uiModeMock.effectiveMode = 'guided'
  uiModeMock.isProCapable = false
  apiMock.getOpportunities.mockResolvedValue(SAMPLE)
  apiMock.getContacts.mockResolvedValue([{ id: 'c-1', name: 'Alex Buyer' }])
  apiMock.updateOpportunity.mockResolvedValue({})
})

afterEach(() => cleanup())

describe('OpportunitiesPage guided list (AGT-OPP-001b)', () => {
  it('renders sectioned list view in guided mode', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: 'Alex Buyer' })
    expect(link).toHaveAttribute('href', '/opportunities/opp-1')
    expect(screen.getByRole('region', { name: /Qualification/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add opportunity/i })).toBeInTheDocument()
  })

  it('advances stage from list actions', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('link', { name: 'Alex Buyer' })
    await user.click(await screen.findByRole('button', { name: /^Advance$/i }))
    await waitFor(() =>
      expect(apiMock.updateOpportunity).toHaveBeenCalledWith('opp-1', { stage: 'viewing' }),
    )
  })

  it('supports explicit list view query on pro-capable layout', async () => {
    uiModeMock.mode = 'pro'
    uiModeMock.effectiveMode = 'pro'
    uiModeMock.isProCapable = true
    renderPage('/opportunities?view=list')
    expect(await screen.findByRole('link', { name: 'Alex Buyer' })).toBeInTheDocument()
  })
})
