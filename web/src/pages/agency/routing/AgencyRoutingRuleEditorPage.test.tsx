// @vitest-environment jsdom
/**
 * AGN-ROU-002 — rule editor page contracts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getAgencyRoutingRule: vi.fn(),
  createAgencyRoutingRule: vi.fn(),
  updateAgencyRoutingRule: vi.fn(),
  deleteAgencyRoutingRule: vi.fn(),
  getMyAgency: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

const authMock = vi.hoisted(() => ({
  agent: {
    id: 'user-owner-1',
    name: 'Owner',
    affiliation: { agency_id: 'agency-1', role: 'owner' as string | undefined },
  } as { id: string; name: string; affiliation: { agency_id: string; role: string | undefined } },
  loading: false,
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

import { AgencyRoutingRuleEditorPage } from './AgencyRoutingRuleEditorPage'

const BASE_RULE = {
  id: 'rule_1',
  agency_id: 'agency-1',
  name: 'Bazaar leads',
  priority: 10,
  trigger: 'inquiry' as const,
  enabled: true,
  strategy: 'round_robin' as const,
  relationship_priority: true,
  filters: { match: 'all' as const, conditions: [{ field: 'source' as const, op: 'eq' as const, value: 'bazaar' }] },
  target: { strategy: 'round_robin' as const, assign_to_agent_id: null, round_robin_group_id: null, language: null },
  eligible_members: {},
  strategy_config: {},
  claim_timeout_seconds: null,
  response_timeout_seconds: null,
  max_attempts: 3,
  cooldown_seconds: 300,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

function renderEditor(path = '/agency/routing/rules/rule_1') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agency/routing/rules/:ruleId" element={<AgencyRoutingRuleEditorPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent.affiliation.role = 'owner'
  authMock.loading = false
  apiMock.getAgencyRoutingRule.mockResolvedValue(BASE_RULE)
  apiMock.getMyAgency.mockResolvedValue({
    id: 'agency-1',
    members: [{ user_id: 'agt_1', name: 'Sara' }],
  })
  apiMock.createAgencyRoutingRule.mockResolvedValue({ ...BASE_RULE, id: 'rule_new' })
  apiMock.updateAgencyRoutingRule.mockResolvedValue(BASE_RULE)
})

afterEach(() => {
  cleanup()
})

describe('AgencyRoutingRuleEditorPage', () => {
  it('loads an existing rule for admins', async () => {
    renderEditor()
    await waitFor(() => expect(apiMock.getAgencyRoutingRule).toHaveBeenCalledWith('rule_1'))
    expect(screen.getByDisplayValue('Bazaar leads')).toBeTruthy()
    expect(screen.getByText('Edit routing rule')).toBeTruthy()
  })

  it('shows forbidden guard for non-admin members', async () => {
    authMock.agent.affiliation.role = 'agent'
    renderEditor()
    await waitFor(() => expect(screen.getByText('Admin access required')).toBeTruthy())
    expect(apiMock.getAgencyRoutingRule).not.toHaveBeenCalled()
  })

  it('creates a new rule when name is provided', async () => {
    const user = userEvent.setup()
    renderEditor('/agency/routing/rules/new')
    await waitFor(() => expect(screen.getByText('New routing rule')).toBeTruthy())

    await user.type(screen.getByLabelText('Rule name'), 'Marina rentals')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(apiMock.createAgencyRoutingRule).toHaveBeenCalled())
    const payload = apiMock.createAgencyRoutingRule.mock.calls[0][0]
    expect(payload.name).toBe('Marina rentals')
  })
})
