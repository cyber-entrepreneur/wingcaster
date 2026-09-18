// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AgencySettingsHomePage } from './AgencySettingsHomePage'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getAgencySettingsIndex: vi.fn(),
  },
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

let authRole = 'owner'
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'usr_owner', affiliation: { role: authRole } },
    loading: false,
  }),
}))

const sampleIndex = {
  agency_id: 'agc_1',
  role: 'owner',
  groups: [
    {
      id: 'access',
      label: 'Access & roles',
      items: [
        {
          id: 'roles',
          label: 'Roles & permissions',
          route: '/agency/settings/roles',
          icon: 'shield-check',
        },
      ],
    },
  ],
  capabilities: { can_manage_team: true, can_transfer_ownership: true },
}

beforeEach(() => {
  authRole = 'owner'
  apiMock.getAgencySettingsIndex.mockReset()
  apiMock.getAgencySettingsIndex.mockResolvedValue(sampleIndex)
})

describe('AgencySettingsHomePage', () => {
  it('renders settings groups with data-screen marker', async () => {
    render(
      <MemoryRouter>
        <AgencySettingsHomePage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText('Agency settings')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-screen="AGN-SET-001"]')).toBeTruthy()
    expect(screen.getByText('Roles & permissions')).toBeInTheDocument()
  })

  it('shows forbidden state for non-admin members', async () => {
    authRole = 'agent'
    render(
      <MemoryRouter>
        <AgencySettingsHomePage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText(/Only agency owners and admins/i)).toBeInTheDocument()
    })
  })
})
