// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { DeleteListingModal } from './DeleteListingModal'

const apiMock = vi.hoisted(() => ({
  getDistributions: vi.fn(),
  getListingComments: vi.fn(),
  getInquiries: vi.fn(),
  deleteProperty: vi.fn(),
}))

const stepUpMock = vi.hoisted(() => ({
  requireElevation: vi.fn(async () => true),
  runElevated: vi.fn(async (action: () => Promise<unknown>) => action()),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => stepUpMock,
}))

function renderModal(onDeleted = vi.fn()) {
  return render(
    <ToastProvider>
      <DeleteListingModal
        open
        listingId="prop-1"
        listingTitle="Marina Gate 1"
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />
    </ToastProvider>,
  )
}

beforeEach(() => {
  for (const fn of Object.values(apiMock)) fn.mockReset()
  stepUpMock.requireElevation.mockReset()
  stepUpMock.runElevated.mockReset()
  stepUpMock.requireElevation.mockResolvedValue(true)
  stepUpMock.runElevated.mockImplementation(async (action: () => Promise<unknown>) => action())
  apiMock.getDistributions.mockResolvedValue([{ id: 'd1', status: 'published' }])
  apiMock.getListingComments.mockResolvedValue({ threads: [{ conversation_id: 'c1' }], published_posts: 1 })
  apiMock.getInquiries.mockResolvedValue({
    items: [{ id: 'inq-1', property_id: 'prop-1', status: 'new' }],
  })
  apiMock.deleteProperty.mockResolvedValue({ success: true })
})

afterEach(() => cleanup())

describe('DeleteListingModal (AGT-LST-009)', () => {
  it('renders warning, impact copy, AGT-LST-009 marker; submit disabled until DELETE typed', async () => {
    renderModal()
    expect(screen.getByRole('dialog')).toHaveAttribute('data-screen', 'AGT-LST-009')
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/1 active inquiry/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('delete-listing-submit')).toBeDisabled()
  })

  it('step-up, deletes listing, and calls onDeleted when phrase matches', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    renderModal(onDeleted)

    await waitFor(() => expect(screen.getByText(/1 active inquiry/i)).toBeInTheDocument())
    await user.type(screen.getByTestId('delete-listing-confirm-input'), 'DELETE')
    await user.click(screen.getByTestId('delete-listing-submit'))

    await waitFor(() => {
      expect(stepUpMock.requireElevation).toHaveBeenCalled()
      expect(apiMock.deleteProperty).toHaveBeenCalledWith('prop-1')
    })
    expect(onDeleted).toHaveBeenCalled()
  })
})
