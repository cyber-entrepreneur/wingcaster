// @vitest-environment jsdom
/**
 * AGN-ROU-001 — routing rules index page contracts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  listAgencyRoutingRules: vi.fn(),
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

import { AgencyRoutingRulesPage } from './AgencyRoutingRulesPage'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.agent.affiliation.role = 'owner'
  authMock.loading = false
  apiMock.listAgencyRoutingRules.mockResolvedValue({
    rules: [
      {
        id: 'rule_1',
        agency_id: 'agency-1',
        name: 'Bazaar leads',
        priority: 10,
        trigger: 'inquiry',
        enabled: true,
        strategy: 'round_robin',
        relationship_priority: true,
        filters: { match: 'all', conditions: [] },
        target: { strategy: 'round_robin', assign_to_agent_id: null, round_robin_group_id: null, language: null },
        eligible_members: {},
        strategy_config: {},
        claim_timeout_seconds: null,
        response_timeout_seconds: null,
        max_attempts: 3,
        cooldown_seconds: 300,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ],
  })
})

afterEach(() => {
  cleanup()
})

describe('AgencyRoutingRulesPage', () => {
  it('lists routing rules for admins', async () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/agency/routing']}>
          <AgencyRoutingRulesPage />
        </MemoryRouter>
      </ToastProvider>,
    )
    await waitFor(() => expect(apiMock.listAgencyRoutingRules).toHaveBeenCalled())
    expect(screen.getByText('Bazaar leads')).toBeTruthy()
  })

  it('shows forbidden guard for non-admin members', async () => {
    authMock.agent.affiliation.role = 'agent'
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/agency/routing']}>
          <AgencyRoutingRulesPage />
        </MemoryRouter>
      </ToastProvider>,
    )
    await waitFor(() => expect(screen.getByText('Admin access required')).toBeTruthy())
    expect(apiMock.listAgencyRoutingRules).not.toHaveBeenCalled()
  })
})
