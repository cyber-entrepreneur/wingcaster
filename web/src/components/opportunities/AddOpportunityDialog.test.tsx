// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { AddOpportunityDialog } from './AddOpportunityDialog'

const apiMock = vi.hoisted(() => ({
  getContacts: vi.fn(),
  getProperties: vi.fn(),
  createOpportunity: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

function renderDialog(props: Partial<{ open: boolean; onOpenChange: (open: boolean) => void; onCreated?: (id: string) => void }> = {}) {
  const onOpenChange = vi.fn()
  const onCreated = vi.fn()
  render(
    <ToastProvider>
      <AddOpportunityDialog open onOpenChange={onOpenChange} onCreated={onCreated} {...props} />
    </ToastProvider>,
  )
  return { onOpenChange, onCreated }
}

beforeEach(() => {
  apiMock.getContacts.mockReset().mockResolvedValue([
    { id: 'contact-abc12345', name: 'Jane Buyer', email: 'jane@example.com' },
  ])
  apiMock.getProperties.mockReset().mockResolvedValue([
    { id: 'prop-abc12345', title: 'Marina flat', address_display: 'Dubai Marina', price: 1200000, currency: 'AED' },
  ])
  apiMock.createOpportunity.mockReset().mockResolvedValue({ id: 'opp-new12345' })
})
afterEach(() => cleanup())

describe('AddOpportunityDialog (AGT-OPP-003)', () => {
  it('renders contact and listing pickers with matrix screen marker', async () => {
    renderDialog()
    expect(await screen.findByTestId('add-opportunity-dialog')).toHaveAttribute('data-screen', 'AGT-OPP-003')
    expect(screen.getByLabelText('Contact')).toBeInTheDocument()
    expect(screen.getByLabelText('Listing (optional)')).toBeInTheDocument()
    // Longer timeout: the async contact load can exceed findByText's 1000ms
    // default on a contended CI shard, which flaked intermittently.
    expect(await screen.findByText('Jane Buyer', undefined, { timeout: 5000 })).toBeInTheDocument()
  })

  it('creates an opportunity and notifies parent with the new id', async () => {
    const user = userEvent.setup()
    const { onCreated, onOpenChange } = renderDialog()
    await screen.findByText('Jane Buyer', undefined, { timeout: 5000 })

    await user.click(screen.getByText('Jane Buyer'))
    await user.click(screen.getByText('Marina flat'))
    await user.type(screen.getByLabelText('Deal value'), '850000')
    await user.type(screen.getByLabelText('Notes'), 'Wants a viewing this week')
    await user.click(screen.getByRole('button', { name: /Save opportunity/i }))

    await waitFor(() =>
      expect(apiMock.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: 'contact-abc12345',
          property_id: 'prop-abc12345',
          stage: 'new',
          deal_value: 850000,
          notes: 'Wants a viewing this week',
        }),
      ),
    )
    expect(onCreated).toHaveBeenCalledWith('opp-new12345')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('blocks save until a contact is selected', async () => {
    apiMock.getContacts.mockResolvedValue([])
    const user = userEvent.setup()
    renderDialog()
    await screen.findByText('No contacts match your search.', undefined, { timeout: 5000 })

    await user.click(screen.getByRole('button', { name: /Save opportunity/i }))
    expect(apiMock.createOpportunity).not.toHaveBeenCalled()
  })
})
