// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  getProperty: vi.fn(),
  deleteProperty: vi.fn(),
  uploadMedia: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  setAuthToken: vi.fn(),
  API_BASE: '/api',
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

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    tenants: [],
    activeTenantId: 'personal:u1',
    activeTenant: {
      id: 'personal:u1',
      name: 'Personal',
      kind: 'personal',
      role: 'owner',
      avatarUrl: null,
      listingsCount: 0,
      agentsCount: 0,
    },
    loading: false,
    switching: false,
    error: null,
    isMultiTenant: false,
    refresh: vi.fn(),
    switchTenant: vi.fn(),
  }),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

import { ManualListingComposerPage } from './ManualListingComposerPage'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{`${loc.pathname}${loc.search}`}</div>
}

function renderComposer(path = '/listings/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/listings/new" element={<ManualListingComposerPage />} />
        <Route path="/listings/:id/edit" element={<ManualListingComposerPage />} />
        <Route path="/listings" element={<div>Listings home</div>} />
        <Route path="/listings/:id" element={<div>Listing detail</div>} />
        <Route path="/publish/outcome/:id" element={<div>Publish outcome</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ManualListingComposerPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    apiMocks.createProperty.mockReset()
    apiMocks.updateProperty.mockReset()
    apiMocks.getProperty.mockReset()
    apiMocks.deleteProperty.mockReset()
    apiMocks.uploadMedia.mockReset()
    addToast.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders step 1 and advances through all 5 steps', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    apiMocks.createProperty.mockResolvedValue({ id: 'prop_new' })
    apiMocks.updateProperty.mockResolvedValue({ id: 'prop_new' })

    renderComposer('/listings/new')

    expect(screen.getByRole('heading', { name: /the basics/i })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')

    await user.type(screen.getByLabelText(/area \/ neighborhood/i), 'Dubai Marina')
    await user.type(screen.getByLabelText(/asking price/i), '2400000')
    await user.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /property details/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')

    await user.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /photos & video/i })).toBeInTheDocument(),
    )

    // Add 3 photos via URL so step 5 validators pass later
    const urlInput = screen.getByLabelText(/or paste a photo url/i)
    for (const url of ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg', 'https://cdn.example/3.jpg']) {
      await user.clear(urlInput)
      await user.type(urlInput, `${url}{Enter}`)
    }

    await user.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /how should buyers reach you/i })).toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /last look before you publish/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5')
    expect(screen.getByRole('button', { name: /publish →/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /publish →/i }))
    await user.click(screen.getByRole('button', { name: /yes, publish/i }))
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toMatch(/\/publish\/outcome\/prop_new/),
    )
  })

  it('autosaves via PUT after create on typing idle (happy path)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    apiMocks.createProperty.mockResolvedValue({ id: 'prop_draft' })
    apiMocks.updateProperty.mockResolvedValue({ id: 'prop_draft' })

    renderComposer('/listings/new')

    await user.type(screen.getByLabelText(/area \/ neighborhood/i), 'Hamra')
    await user.type(screen.getByLabelText(/asking price/i), '500000')

    await actAdvance(3100)

    await waitFor(() => expect(apiMocks.createProperty).toHaveBeenCalled())
    expect(apiMocks.createProperty.mock.calls[0][0]).toMatchObject({
      status: 'draft',
      location: 'Hamra',
    })
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toMatch(/\/listings\/prop_draft\/edit/),
    )

    // URL replaced to /listings/:id/edit so refresh preserves draft
    await waitFor(() =>
      expect(screen.getByRole('progressbar')).toBeInTheDocument(),
    )

    await user.type(screen.getByLabelText(/area \/ neighborhood/i), ' Beach')
    await actAdvance(3100)

    await waitFor(() => expect(apiMocks.updateProperty).toHaveBeenCalled())
    expect(apiMocks.updateProperty.mock.calls[0][0]).toBe('prop_draft')
  })

  it('navigates to /publish/outcome/:id after successful publish', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    apiMocks.createProperty.mockResolvedValue({ id: 'prop_pub' })
    apiMocks.updateProperty.mockResolvedValue({ id: 'prop_pub' })

    renderComposer('/listings/new')

    await user.type(screen.getByLabelText(/area \/ neighborhood/i), 'Dubai Marina')
    await user.type(screen.getByLabelText(/asking price/i), '2400000')
    await user.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /property details/i })).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /photos & video/i })).toBeInTheDocument(),
    )
    const urlInput = screen.getByLabelText(/or paste a photo url/i)
    for (const url of ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg', 'https://cdn.example/3.jpg']) {
      await user.clear(urlInput)
      await user.type(urlInput, `${url}{Enter}`)
    }
    await user.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /how should buyers reach you/i })).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /last look before you publish/i })).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /publish →/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /yes, publish/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /yes, publish/i }))
    await waitFor(() => expect(screen.getByText(/publish outcome/i)).toBeInTheDocument())
  })

  it('hydrates edit mode from GET /properties/:id', async () => {
    apiMocks.getProperty.mockResolvedValue({
      id: 'prop_edit',
      title: 'Existing villa',
      type: 'sale',
      property_type: 'villa',
      price: 1000000,
      bedrooms: 4,
      bathrooms: 3,
      area: 300,
      area_unit: 'sqm',
      location: 'New Cairo',
      city: 'Cairo',
      neighborhood: 'Palm Hills',
      address: '12 Palm',
      amenities: ['Pool'],
      photos: ['https://cdn.example/v.jpg'],
      description: '',
      agent_id: 'agt_1',
      agent_name: 'Sara',
      agent_photo: '',
      agent_license: '',
      agency_name: '',
      furnished: false,
      listed_date: '2026-01-01',
      permit_number: '',
      reference: 'LST-1',
      featured: false,
      views: 0,
      status: 'draft',
    })

    renderComposer('/listings/prop_edit/edit?step=2')

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /property details/i })).toBeInTheDocument(),
    )
    expect(apiMocks.getProperty).toHaveBeenCalledWith('prop_edit')
    expect(screen.getByLabelText(/bedrooms/i)).toHaveValue('4')
  })
})

async function actAdvance(ms: number) {
  const { act } = await import('@testing-library/react')
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}
