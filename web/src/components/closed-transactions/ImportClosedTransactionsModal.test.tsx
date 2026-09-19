// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { ImportClosedTransactionsModal } from './ImportClosedTransactionsModal'

const apiMock = vi.hoisted(() => ({ importClosedTransactionsCsv: vi.fn() }))
vi.mock('@/api/client', () => ({ api: apiMock }))

function renderModal() {
  const onClose = vi.fn()
  const onDone = vi.fn()
  render(
    <ToastProvider>
      <ImportClosedTransactionsModal onClose={onClose} onDone={onDone} />
    </ToastProvider>,
  )
  return { onClose, onDone }
}

const SAMPLE = 'listing_id,final_sold_price,closed_at\nlst-1,475000,2023-04-02'

beforeEach(() => {
  apiMock.importClosedTransactionsCsv.mockReset()
})

afterEach(() => cleanup())

describe('ImportClosedTransactionsModal (AGT-HTX-003)', () => {
  it('walks upload → mapping → preview → import', async () => {
    const user = userEvent.setup()
    apiMock.importClosedTransactionsCsv
      .mockResolvedValueOnce({
        row_count: 1,
        valid_count: 1,
        preview: [{
          row: 2,
          listing_id: 'lst-1',
          external_reference: null,
          transaction_type: 'sale',
          final_sold_price: '475000',
          closed_at: '2023-04-02',
          currency: 'USD',
          valid: true,
        }],
      })
      .mockResolvedValueOnce({ imported: 1, skipped: 0, errors: [], import_id: 'imp-1' })

    renderModal()
    const textarea = screen.getByPlaceholderText(/listing_id/i)
    await user.type(textarea, SAMPLE)
    await user.click(screen.getByRole('button', { name: /Continue/i }))

    expect(screen.getByText(/Map each Wingcaster field/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Preview/i }))

    await waitFor(() => expect(apiMock.importClosedTransactionsCsv).toHaveBeenCalledWith(
      SAMPLE,
      expect.objectContaining({ preview_only: true }),
    ))
    expect(screen.getByText(/rows look valid/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Import$/i }))
    await waitFor(() => expect(apiMock.importClosedTransactionsCsv).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('import-result-summary')).toHaveTextContent('Imported 1')
  })

  it('tags the modal with AGT-HTX-003', () => {
    renderModal()
    expect(document.querySelector('[data-screen="AGT-HTX-003"]')).toBeTruthy()
  })
})
