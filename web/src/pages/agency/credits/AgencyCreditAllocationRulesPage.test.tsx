// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AgencyCreditAllocationRulesPage } from './AgencyCreditAllocationRulesPage'

const { addToast, apiMock } = vi.hoisted(() => ({
  addToast: vi.fn(),
  apiMock: {
    getAgencyCreditAllocationRules: vi.fn(),
    updateAgencyCreditAllocationRules: vi.fn(),
  },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

let authRole = 'owner'
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'usr_owner', affiliation: { role: authRole, agency_id: 'agc_1' } },
    loading: false,
  }),
}))

const defaultRules = {
  agency_id: 'agc_1',
  mode: 'manual' as const,
  overrides: [],
  percentage_total: 0,
  shared_pool_percentage: 100,
  updated_by: null,
  updated_at: null,
  created_at: null,
  is_default: true,
}

const defaultAgents = [
  { user_id: 'agent_a', name: 'Agent A', role: 'agent' },
  { user_id: 'agent_b', name: 'Agent B', role: 'agent' },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <AgencyCreditAllocationRulesPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  authRole = 'owner'
  addToast.mockReset()
  apiMock.getAgencyCreditAllocationRules.mockReset()
  apiMock.updateAgencyCreditAllocationRules.mockReset()
  apiMock.getAgencyCreditAllocationRules.mockResolvedValue({
    rules: defaultRules,
    agents: defaultAgents,
  })
})

describe('AgencyCreditAllocationRulesPage', () => {
  it('renders manual mode and data-screen marker', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Allocation rules')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-screen="AGN-CRD-004"]')).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Manual per top-up/i })).toBeChecked()
  })

  it('shows forbidden state for non-admin members', async () => {
    authRole = 'agent'
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Only agency owners and admins/i)).toBeInTheDocument()
    })
  })

  it('saves percentage overrides', async () => {
    apiMock.updateAgencyCreditAllocationRules.mockResolvedValue({
      rules: {
        ...defaultRules,
        mode: 'percentage',
        overrides: [{ agent_user_id: 'agent_a', agent_name: 'Agent A', percentage: 25, cap_usd: null }],
        percentage_total: 25,
        shared_pool_percentage: 75,
        is_default: false,
        updated_at: '2026-09-18T00:00:00.000Z',
      },
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Allocation rules')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('radio', { name: /Automatic percentage/i }))
    await waitFor(() => {
      expect(screen.getByLabelText('Percentage for Agent A')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('Percentage for Agent A'), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: /Save rules/i }))

    await waitFor(() => {
      expect(apiMock.updateAgencyCreditAllocationRules).toHaveBeenCalledWith({
        mode: 'percentage',
        overrides: [{ agent_user_id: 'agent_a', percentage: 25, cap_usd: null }],
      })
    })
    expect(addToast).toHaveBeenCalled()
  })
})
