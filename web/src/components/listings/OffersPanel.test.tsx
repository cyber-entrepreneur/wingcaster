// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import type { BuyerOffer } from '@/api/client'
import { OffersPanel } from './OffersPanel'

const apiMock = vi.hoisted(() => ({
  listBuyerOffers: vi.fn(),
  createBuyerOffer: vi.fn(),
  updateBuyerOffer: vi.fn(),
  deleteBuyerOffer: vi.fn(),
  getContacts: vi.fn(
    async (): Promise<Array<{ id: string; name: string; email?: string; phone?: string }>> => [],
  ),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

function offer(over: Partial<BuyerOffer> = {}): BuyerOffer {
  return {
    id: 'o1',
    property_id: 'prop-1',
    agent_id: 'agent-1',
    contact_id: null,
    offeror_name: 'Jane Buyer',
    amount: 475000,
    currency: 'USD',
    offer_date: '2026-09-17',
    terms: null,
    financing_type: null,
    expiry_date: null,
    conditions: null,
    status: 'received',
    notes: null,
    created_at: '2026-09-17T00:00:00Z',
    updated_at: '2026-09-17T00:00:00Z',
    ...over,
  }
}

function renderPanel(props: Partial<Parameters<typeof OffersPanel>[0]> = {}) {
  return render(
    <ToastProvider>
      <OffersPanel propertyId="prop-1" currency="USD" {...props} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  for (const fn of Object.values(apiMock)) fn.mockReset()
  apiMock.listBuyerOffers.mockResolvedValue({ offers: [] })
})

afterEach(() => cleanup())

describe('OffersPanel', () => {
  it('shows the empty state when there are no offers', async () => {
    renderPanel()
    expect(await screen.findByText(/No offers recorded yet/i)).toBeInTheDocument()
  })

  it('renders offers with money + status', async () => {
    apiMock.listBuyerOffers.mockResolvedValue({ offers: [offer({ status: 'countered' })] })
    renderPanel()
    expect((await screen.findAllByText('Jane Buyer')).length).toBeGreaterThan(0)
    // amount shows in the summary strip and the row; both count
    expect(screen.getAllByText(/\$475,000/).length).toBeGreaterThan(0)
    // status label appears on both the badge and the <option>; at least one
    expect(screen.getAllByText('Countered').length).toBeGreaterThan(0)
  })

  it('records a new offer via the modal', async () => {
    const user = userEvent.setup()
    apiMock.createBuyerOffer.mockResolvedValue(offer({ id: 'o2', offeror_name: 'New Buyer', amount: 500000 }))
    renderPanel()
    await screen.findByText(/No offers recorded yet/i)

    await user.click(screen.getByRole('button', { name: /Record offer/i }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText(/Buyer or their agent/i), 'New Buyer')
    await user.type(within(dialog).getByPlaceholderText(/e\.g\. 475000/i), '500000')
    await user.click(within(dialog).getByRole('button', { name: /^Record offer$/i }))

    await waitFor(() =>
      expect(apiMock.createBuyerOffer).toHaveBeenCalledWith(
        'prop-1',
        expect.objectContaining({ offeror_name: 'New Buyer', amount: 500000 }),
      ),
    )
    expect((await screen.findAllByText('New Buyer')).length).toBeGreaterThan(0)
  })

  it('links a buyer from the CRM picker into the offer', async () => {
    const user = userEvent.setup()
    apiMock.createBuyerOffer.mockResolvedValue(offer({ id: 'o9', contact_id: 'c-1', offeror_name: 'Sam CRM', amount: 300000 }))
    apiMock.getContacts.mockResolvedValue([{ id: 'c-1', name: 'Sam CRM', email: 'sam@x.test' }])
    renderPanel()
    await screen.findByText(/No offers recorded yet/i)

    await user.click(screen.getByRole('button', { name: /Record offer/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByPlaceholderText(/Search contacts/i))
    await user.click(await within(dialog).findByText('Sam CRM'))
    // Picking fills the offeror name + shows the linked chip
    expect(within(dialog).getByDisplayValue('Sam CRM')).toBeInTheDocument()
    await user.type(within(dialog).getByPlaceholderText(/e\.g\. 475000/i), '300000')
    await user.click(within(dialog).getByRole('button', { name: /^Record offer$/i }))

    await waitFor(() =>
      expect(apiMock.createBuyerOffer).toHaveBeenCalledWith(
        'prop-1',
        expect.objectContaining({ contact_id: 'c-1', offeror_name: 'Sam CRM', amount: 300000 }),
      ),
    )
  })

  it('renders the comparison chart once offers exist', async () => {
    apiMock.listBuyerOffers.mockResolvedValue({ offers: [offer({ amount: 480000 })] })
    const { container } = renderPanel({ asking: 500000, benchmark: 475000 })
    await screen.findAllByText('Jane Buyer')
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('fires onOfferAccepted when status is set to accepted', async () => {
    const user = userEvent.setup()
    apiMock.listBuyerOffers.mockResolvedValue({ offers: [offer()] })
    apiMock.updateBuyerOffer.mockResolvedValue(offer({ status: 'accepted' }))
    const onAccepted = vi.fn()
    renderPanel({ onOfferAccepted: onAccepted })
    await screen.findAllByText('Jane Buyer')

    await user.selectOptions(screen.getByLabelText(/Offer status/i), 'accepted')

    await waitFor(() => expect(apiMock.updateBuyerOffer).toHaveBeenCalledWith('o1', { status: 'accepted' }))
    await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1))
  })

  it('removes an offer', async () => {
    const user = userEvent.setup()
    apiMock.listBuyerOffers.mockResolvedValue({ offers: [offer()] })
    apiMock.deleteBuyerOffer.mockResolvedValue({ success: true })
    renderPanel()
    await screen.findAllByText('Jane Buyer')

    await user.click(screen.getByRole('button', { name: /Remove offer from Jane Buyer/i }))
    await waitFor(() => expect(apiMock.deleteBuyerOffer).toHaveBeenCalledWith('o1'))
    await waitFor(() => expect(screen.queryAllByText('Jane Buyer').length).toBe(0))
  })
})
