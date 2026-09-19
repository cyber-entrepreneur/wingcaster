// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { CanonicalPropertyView } from '@/api/client'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  getCanonicalPropertyView: vi.fn(),
  createCanonicalPrimaryDispute: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

import { CanonicalPropertyBanner } from './CanonicalPropertyBanner'

const VIEW: CanonicalPropertyView = {
  canonical: {
    id: 'canonical-1',
    location: 'Dubai Marina',
    city: 'Dubai',
    neighborhood: 'Marina',
    primary_listing_id: 'listing-primary',
    sibling_count: 2,
  },
  state: 'secondary',
  can_contest: true,
  dispute: null,
  listings: [
    {
      id: 'listing-primary',
      title: 'Marina home',
      price: 2050000,
      currency: 'AED',
      status: 'active',
      agency: { id: 'agency-2', name: 'Marina Partners' },
      agent: { id: 'agent-2', name: 'Omar Agent' },
      listed_at: '2026-09-15T00:00:00Z',
      updated_at: new Date().toISOString(),
      is_primary: true,
      is_mine: false,
    },
    {
      id: 'listing-mine',
      title: 'Marina residence',
      price: 2100000,
      currency: 'AED',
      status: 'active',
      agency: { id: 'agency-1', name: 'Harbour Realty' },
      agent: { id: 'agent-1', name: 'Amina Agent' },
      listed_at: '2026-09-14T00:00:00Z',
      updated_at: new Date().toISOString(),
      is_primary: false,
      is_mine: true,
    },
  ],
}

function renderBanner({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' } = {}) {
  return render(
    <div dir={dir}>
      <ToastProvider>
        <MemoryRouter>
          <CanonicalPropertyBanner listingId="listing-mine" />
        </MemoryRouter>
      </ToastProvider>
    </div>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.getCanonicalPropertyView.mockResolvedValue({ canonical_view: VIEW })
  apiMock.createCanonicalPrimaryDispute.mockResolvedValue({
    dispute: {
      id: 'dispute-1',
      canonical_id: 'canonical-1',
      listing_id: 'listing-mine',
      mandate_type: 'exclusive',
      mandate_reference: 'EX-2026-18',
      evidence_notes: 'Signed exclusive mandate is on file.',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  })
})

afterEach(() => {
  cleanup()
})

describe('CanonicalPropertyBanner', () => {
  it('shows secondary state, sibling transparency, and working view links', async () => {
    renderBanner()

    expect(await screen.findByText('This property has listings from other agencies')).toBeInTheDocument()
    expect(screen.getByText('Marina Partners')).toBeInTheDocument()
    expect(screen.getByText('Harbour Realty')).toBeInTheDocument()
    expect(screen.getByText('Canonical ·', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View listing from Marina Partners' })).toHaveAttribute(
      'href',
      '/listings/listing-primary',
    )
  })

  it('validates and submits an exclusive-mandate dispute', async () => {
    const user = userEvent.setup()
    renderBanner()
    await screen.findByText('This property has listings from other agencies')
    await user.click(screen.getByRole('button', { name: 'Contest primary' }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }))
    expect(within(dialog).getByText(/Enter the mandate reference/i)).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Exclusive mandate reference'), 'EX-2026-18')
    await user.type(
      within(dialog).getByLabelText('Supporting details'),
      'Signed exclusive mandate is on file and available for review.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Submit for review' }))

    await waitFor(() =>
      expect(apiMock.createCanonicalPrimaryDispute).toHaveBeenCalledWith('listing-mine', {
        mandate_type: 'exclusive',
        mandate_reference: 'EX-2026-18',
        evidence_notes: 'Signed exclusive mandate is on file and available for review.',
      }),
    )
    expect(await screen.findByText('Primary mandate review pending')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Contest primary' })).not.toBeInTheDocument()
  })

  it('shows the I-am-primary state without a contest action', async () => {
    apiMock.getCanonicalPropertyView.mockResolvedValue({
      canonical_view: {
        ...VIEW,
        state: 'primary',
        can_contest: false,
        canonical: { ...VIEW.canonical, primary_listing_id: 'listing-mine' },
        listings: VIEW.listings.map((listing) => ({
          ...listing,
          is_primary: listing.id === 'listing-mine',
        })),
      },
    })
    renderBanner()

    expect(await screen.findByText('Your listing is the canonical primary')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Contest primary' })).not.toBeInTheDocument()
  })

  it('shows an existing disputed state', async () => {
    apiMock.getCanonicalPropertyView.mockResolvedValue({
      canonical_view: {
        ...VIEW,
        state: 'disputed',
        can_contest: false,
        dispute: {
          id: 'dispute-1',
          canonical_id: 'canonical-1',
          listing_id: 'listing-mine',
          mandate_type: 'exclusive',
          mandate_reference: 'EX-PENDING',
          evidence_notes: 'Pending evidence review.',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    })
    renderBanner()

    expect(await screen.findByText('Primary mandate review pending')).toBeInTheDocument()
    expect(screen.getByText(/EX-PENDING/)).toBeInTheDocument()
  })

  it('renders nothing when this listing has no canonical siblings', async () => {
    apiMock.getCanonicalPropertyView.mockResolvedValue({ canonical_view: null })
    const { container } = renderBanner()

    await waitFor(() => expect(apiMock.getCanonicalPropertyView).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('[data-testid="canonical-property-banner"]')).toBeNull())
  })

  it('shows an error and retries', async () => {
    const user = userEvent.setup()
    apiMock.getCanonicalPropertyView
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ canonical_view: VIEW })
    renderBanner()

    expect(await screen.findByText('Canonical property details are unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('This property has listings from other agencies')).toBeInTheDocument()
  })

  it('uses an RTL-safe, non-scrolling mobile shell', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    renderBanner({ dir: 'rtl' })

    const banner = await screen.findByTestId('canonical-property-banner')
    expect(banner).not.toHaveClass('overflow-x-auto')
    expect(screen.getByRole('button', { name: 'Contest primary' })).toHaveClass('w-full')
  })
})
