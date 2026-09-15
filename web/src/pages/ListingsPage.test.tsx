// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

const getProperties = vi.hoisted(() => vi.fn())
const getInquiries = vi.hoisted(() => vi.fn())
const addToast = vi.hoisted(() => vi.fn())
const authAgent = vi.hoisted(() => ({ id: 'agt_me', name: 'Sara' }))
const tenantFns = vi.hoisted(() => ({ refresh: vi.fn(), switchTenant: vi.fn() }))

const tenantState = vi.hoisted(() => ({
  activeTenantId: 'personal:agt_me',
  activeTenant: {
    id: 'personal:agt_me',
    name: 'Personal',
    kind: 'personal' as 'personal' | 'agency',
    role: 'owner',
    avatarUrl: null as string | null,
    listingsCount: 1,
    agentsCount: 1,
  },
}))

function personalTenant() {
  return {
    id: 'personal:agt_me',
    name: 'Personal',
    kind: 'personal' as const,
    role: 'owner',
    avatarUrl: null as string | null,
    listingsCount: 1,
    agentsCount: 1,
  }
}

function agencyTenant() {
  return {
    id: 'agency:ag1',
    name: 'Agency One',
    kind: 'agency' as const,
    role: 'owner',
    avatarUrl: null as string | null,
    listingsCount: 3,
    agentsCount: 3,
  }
}

vi.mock('@/api/client', () => ({
  api: {
    getProperties: (...args: unknown[]) => getProperties(...args),
    getInquiries: (...args: unknown[]) => getInquiries(...args),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: authAgent,
    loading: false,
  }),
}))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    activeTenantId: tenantState.activeTenantId,
    activeTenant: tenantState.activeTenant,
    tenants: [],
    loading: false,
    switching: false,
    error: null,
    isMultiTenant: false,
    refresh: tenantFns.refresh,
    switchTenant: tenantFns.switchTenant,
  }),
}))

vi.mock('@/hooks/useUiMode', () => ({
  useUiMode: () => ({
    mode: 'guided',
    effectiveMode: 'guided',
    isProCapable: false,
    shouldRenderPro: false,
    loading: false,
    switching: false,
    setMode: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

import { ListingsPage } from './ListingsPage'

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function renderListings(initialEntry = '/listings') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ListingsPage />
      <LocationDisplay />
    </MemoryRouter>,
  )
}

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
  agency_id: 'ag1',
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
    tenantState.activeTenantId = 'personal:agt_me'
    tenantState.activeTenant = personalTenant()
    getProperties.mockReset()
    getInquiries.mockReset()
    getInquiries.mockResolvedValue({ items: [] })
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
    renderListings()

    const statusGroup = await screen.findByRole('group', { name: /status filter/i })
    await waitFor(() => {
      const allChip = statusGroup.querySelector('button')
      expect(allChip?.textContent).toMatch(/All\s*\(1\)/)
    })
    const allChip = statusGroup.querySelector('button')
    expect(allChip?.textContent).not.toMatch(/\(\(/)
  })

  it('scopes list fetch with agentId for personal tenant', async () => {
    renderListings()

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

    renderListings()

    await screen.findByRole('group', { name: /status filter/i })
    const countsLine = screen.getByText(/total/i).closest('p')
    expect(countsLine?.textContent).toMatch(/unpublished/i)
    expect(countsLine?.textContent).not.toMatch(/pending/i)
  })

  it('exposes area and price range filter groups', async () => {
    renderListings()
    await screen.findByRole('group', { name: /area filter/i })
    expect(screen.getByRole('group', { name: /price range filter/i })).toBeInTheDocument()
  })

  describe('agent of record filter (agency tenant)', () => {
    beforeEach(() => {
      tenantState.activeTenantId = 'agency:ag1'
      tenantState.activeTenant = agencyTenant()
      getProperties.mockResolvedValue([
        {
          ...baseListing,
          id: 'mine',
          title: 'Mine Listing',
          agent_id: 'agt_me',
          agent_name: 'Sara',
          price: 400_000,
        },
        {
          ...baseListing,
          id: 'peer',
          title: 'Peer Listing',
          agent_id: 'agt_other',
          agent_name: 'Omar',
          price: 800_000,
        },
        {
          ...baseListing,
          id: 'third',
          title: 'Third Listing',
          agent_id: 'agt_third',
          agent_name: 'Layla',
          price: 1_500_000,
        },
      ])
    })

    it('filters by My listings, Any agent, and specific agent with URL sync', async () => {
      renderListings()

      await screen.findByText('Mine Listing')
      expect(screen.queryByText('Peer Listing')).not.toBeInTheDocument()
      expect(screen.queryByText('Third Listing')).not.toBeInTheDocument()

      const agentGroup = screen.getByRole('group', { name: /agent of record filter/i })
      const myChip = within(agentGroup).getByRole('button', { name: /my listings/i })
      expect(myChip).toHaveAttribute('aria-pressed', 'true')

      fireEvent.click(within(agentGroup).getByRole('button', { name: /any agent/i }))
      expect(within(agentGroup).getByRole('button', { name: /any agent/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(screen.getByText('Mine Listing')).toBeInTheDocument()
      expect(screen.getByText('Peer Listing')).toBeInTheDocument()
      expect(screen.getByText('Third Listing')).toBeInTheDocument()
      expect(screen.getByTestId('location-search')).toHaveTextContent('agent=any')

      fireEvent.click(within(agentGroup).getByRole('button', { name: /^Omar$/i }))
      expect(within(agentGroup).getByRole('button', { name: /^Omar$/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(screen.queryByText('Mine Listing')).not.toBeInTheDocument()
      expect(screen.getByText('Peer Listing')).toBeInTheDocument()
      expect(screen.queryByText('Third Listing')).not.toBeInTheDocument()
      expect(screen.getByTestId('location-search')).toHaveTextContent('agent=agt_other')

      fireEvent.click(myChip)
      expect(myChip).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText('Mine Listing')).toBeInTheDocument()
      expect(screen.queryByText('Peer Listing')).not.toBeInTheDocument()
      expect(screen.getByTestId('location-search')).toHaveTextContent('agent=me')

      await waitFor(() => expect(getProperties).toHaveBeenCalled())
      expect(getProperties.mock.calls[0][0]).toMatchObject({ include_unsyndicated: '1' })
      expect(getProperties.mock.calls[0][0]).not.toHaveProperty('agentId')
    })
  })

  describe('price range filter', () => {
    beforeEach(() => {
      getProperties.mockResolvedValue([
        { ...baseListing, id: 'u', title: 'Under Studio', price: 350_000 },
        { ...baseListing, id: 'm', title: 'Mid Flat', price: 750_000 },
        { ...baseListing, id: 'h', title: 'High Villa', price: 1_800_000 },
        { ...baseListing, id: 'o', title: 'Over Penthouse', price: 4_200_000 },
      ])
    })

    it('shows only listings in the selected price bucket and syncs URL', async () => {
      renderListings()

      await screen.findByText('Under Studio')
      expect(screen.getByText('Mid Flat')).toBeInTheDocument()
      expect(screen.getByText('High Villa')).toBeInTheDocument()
      expect(screen.getByText('Over Penthouse')).toBeInTheDocument()

      const priceGroup = screen.getByRole('group', { name: /price range filter/i })

      fireEvent.click(within(priceGroup).getByRole('button', { name: /under 500k/i }))
      expect(screen.getByText('Under Studio')).toBeInTheDocument()
      expect(screen.queryByText('Mid Flat')).not.toBeInTheDocument()
      expect(screen.queryByText('High Villa')).not.toBeInTheDocument()
      expect(screen.queryByText('Over Penthouse')).not.toBeInTheDocument()
      expect(screen.getByTestId('location-search')).toHaveTextContent('price=under_500k')

      fireEvent.click(within(priceGroup).getByRole('button', { name: '500k – 1M' }))
      expect(screen.queryByText('Under Studio')).not.toBeInTheDocument()
      expect(screen.getByText('Mid Flat')).toBeInTheDocument()
      expect(screen.queryByText('High Villa')).not.toBeInTheDocument()
      expect(screen.queryByText('Over Penthouse')).not.toBeInTheDocument()
      expect(screen.getByTestId('location-search')).toHaveTextContent('price=500k_1m')

      fireEvent.click(within(priceGroup).getByRole('button', { name: '1M – 3M' }))
      expect(screen.queryByText('Under Studio')).not.toBeInTheDocument()
      expect(screen.queryByText('Mid Flat')).not.toBeInTheDocument()
      expect(screen.getByText('High Villa')).toBeInTheDocument()
      expect(screen.queryByText('Over Penthouse')).not.toBeInTheDocument()
      expect(screen.getByTestId('location-search')).toHaveTextContent('price=1m_3m')

      fireEvent.click(within(priceGroup).getByRole('button', { name: /3M\+/i }))
      expect(screen.queryByText('Under Studio')).not.toBeInTheDocument()
      expect(screen.queryByText('Mid Flat')).not.toBeInTheDocument()
      expect(screen.queryByText('High Villa')).not.toBeInTheDocument()
      expect(screen.getByText('Over Penthouse')).toBeInTheDocument()
      expect(screen.getByTestId('location-search')).toHaveTextContent('price=over_3m')
    })
  })
})
