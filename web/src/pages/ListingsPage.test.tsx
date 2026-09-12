// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const getProperties = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({
  api: {
    getProperties: (...args: unknown[]) => getProperties(...args),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: { id: 'agt_me', name: 'Sara' },
    loading: false,
  }),
}))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    activeTenantId: 'personal:agt_me',
    activeTenant: {
      id: 'personal:agt_me',
      name: 'Personal',
      kind: 'personal',
      role: 'owner',
      avatarUrl: null,
      listingsCount: 1,
      agentsCount: 1,
    },
    tenants: [],
    loading: false,
    switching: false,
    error: null,
    isMultiTenant: false,
    refresh: vi.fn(),
    switchTenant: vi.fn(),
  }),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn(), toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

import { ListingsPage } from './ListingsPage'

const baseListing = {
  id: 'p1',
  title: 'Marina Gate',
  status: 'published',
  type: 'sale' as const,
  price: 2_400_000,
  bedrooms: 2,
  bathrooms: 2,
  area: 1200,
  area_unit: 'sqft',
  location: 'Dubai Marina',
  city: 'Dubai',
  neighborhood: 'Dubai Marina',
  address: '',
  amenities: [] as string[],
  furnished: false,
  photos: [] as string[],
  agent_id: 'agt_me',
  agent_name: 'Sara',
  agent_photo: '',
  agent_license: '',
  agency_name: '',
  listed_date: '2026-09-01',
  permit_number: '',
  reference: 'LST-1',
  featured: false,
  views: 10,
  description: '',
  property_type: 'apartment',
}

describe('ListingsPage fix batch', () => {
  beforeEach(() => {
    getProperties.mockReset()
    getProperties.mockResolvedValue([
      baseListing,
      {
        ...baseListing,
        id: 'p2',
        title: 'Other agent listing',
        agent_id: 'agt_other',
        agent_name: 'Omar',
        status: 'draft',
        neighborhood: 'JLT',
        location: 'JLT',
      },
    ])
  })

  it('renders filter chip counts as (N) not ((N)', async () => {
    render(
      <MemoryRouter>
        <ListingsPage />
      </MemoryRouter>,
    )

    const statusGroup = await screen.findByRole('group', { name: /status filter/i })
    const allChip = statusGroup.querySelector('button')
    expect(allChip?.textContent).toMatch(/All\s*\(1\)/)
    expect(allChip?.textContent).not.toMatch(/\(\(/)
  })

  it('scopes list fetch with agentId for personal tenant', async () => {
    render(
      <MemoryRouter>
        <ListingsPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getProperties).toHaveBeenCalled())
    expect(getProperties.mock.calls[0][0]).toMatchObject({
      agentId: 'agt_me',
      include_unsyndicated: '1',
    })
    await screen.findByText('Marina Gate')
    expect(screen.queryByText('Other agent listing')).not.toBeInTheDocument()
  })

  it('labels unpublished as unpublished (not pending)', async () => {
    getProperties.mockResolvedValue([
      { ...baseListing, id: 'p3', title: 'Taken down', status: 'unpublished', price: 100 },
    ])

    render(
      <MemoryRouter>
        <ListingsPage />
      </MemoryRouter>,
    )

    await screen.findByRole('group', { name: /status filter/i })
    const countsLine = screen.getByText(/total/i).closest('p')
    expect(countsLine?.textContent).toMatch(/unpublished/i)
    expect(countsLine?.textContent).not.toMatch(/pending/i)
  })

  it('exposes area and price range filter groups', async () => {
    render(
      <MemoryRouter>
        <ListingsPage />
      </MemoryRouter>,
    )
    await screen.findByRole('group', { name: /area filter/i })
    expect(screen.getByRole('group', { name: /price range filter/i })).toBeInTheDocument()
  })
})
