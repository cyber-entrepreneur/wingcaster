// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { ArchiveListingModal } from './ArchiveListingModal'

const apiMock = vi.hoisted(() => ({
  updateProperty: vi.fn(),
  createListingNote: vi.fn(),
  trackPropertyEvent: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: apiMock }))

function renderModal(onArchived = vi.fn()) {
  return render(
    <ToastProvider>
      <ArchiveListingModal
        open
        listingId="prop-1"
        listingTitle="Marina Gate 1"
        onClose={vi.fn()}
        onArchived={onArchived}
      />
    </ToastProvider>,
  )
}

beforeEach(() => {
  for (const fn of Object.values(apiMock)) fn.mockReset()
  apiMock.updateProperty.mockResolvedValue({ id: 'prop-1', status: 'archived' })
  apiMock.createListingNote.mockResolvedValue({ id: 'note-1' })
  apiMock.trackPropertyEvent.mockResolvedValue({ ok: true })
})

afterEach(() => cleanup())

describe('ArchiveListingModal (AGT-LST-008)', () => {
  it('renders warning, reason options, and AGT-LST-008 screen marker', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toHaveAttribute('data-screen', 'AGT-LST-008')
    expect(screen.getByRole('heading', { name: /Archive this listing/i })).toBeInTheDocument()
    expect(screen.getByText(/Why are you archiving/i)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Sold/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Rented/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Withdrawn/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Wrong data/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Archive$/i })).toBeDisabled()
  })

  it('archives with reason + note and calls onArchived', async () => {
    const user = userEvent.setup()
    const onArchived = vi.fn()
    renderModal(onArchived)

    await user.click(screen.getByRole('radio', { name: /Withdrawn/i }))
    await user.type(screen.getByLabelText(/Notes/i), 'Owner changed mind')
    await user.click(screen.getByRole('button', { name: /^Archive$/i }))

    await waitFor(() => {
      expect(apiMock.updateProperty).toHaveBeenCalledWith('prop-1', { status: 'archived' })
    })
    expect(apiMock.createListingNote).toHaveBeenCalledWith('prop-1', {
      body: '[Archived] Reason: Withdrawn\nNotes: Owner changed mind',
      visibility: 'internal',
    })
    expect(apiMock.trackPropertyEvent).toHaveBeenCalledWith('prop-1', {
      type: 'archive',
      source: 'listing_profile',
      reason: 'withdrawn',
    })
    expect(onArchived).toHaveBeenCalledWith('withdrawn')
  })
})
