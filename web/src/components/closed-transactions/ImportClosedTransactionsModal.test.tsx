// @vitest-environment jsdom
/**
 * AGT-HTX-003 import modal tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'

const apiMock = vi.hoisted(() => ({
  importClosedTransactionsCsv: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

import { ImportClosedTransactionsModal } from './ImportClosedTransactionsModal'

function renderModal() {
  return render(
    <ToastProvider>
      <ImportClosedTransactionsModal onClose={vi.fn()} onDone={vi.fn()} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.importClosedTransactionsCsv.mockResolvedValue({ imported: 1, skipped: 0, errors: [] })
  Object.defineProperty(File.prototype, 'text', {
    configurable: true,
    value: function text() {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(reader.error)
        reader.readAsText(this)
      })
    },
  })
})

afterEach(() => cleanup())

describe('ImportClosedTransactionsModal', () => {
  it('shows file upload step initially', () => {
    renderModal()
    expect(screen.getByText(/Choose a CSV file/i)).toBeInTheDocument()
  })

  it('advances to mapping after file selection', async () => {
    const user = userEvent.setup()
    renderModal()
    const csv = 'listing_id,final_sold_price,closed_at\np-1,100000,2024-01-01'
    const file = new File([csv], 'history.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)
    expect(await screen.findByLabelText(/Listing ID/i)).toBeInTheDocument()
    expect(screen.getByText(/history.csv/i)).toBeInTheDocument()
  })

  it('imports after preview', async () => {
    const user = userEvent.setup()
    renderModal()
    const csv = 'listing_id,final_sold_price,closed_at\np-1,100000,2024-01-01'
    const file = new File([csv], 'history.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)
    await user.click(await screen.findByRole('button', { name: /Preview/i }))
    await user.click(screen.getByRole('button', { name: /Import/i }))
    await waitFor(() => expect(apiMock.importClosedTransactionsCsv).toHaveBeenCalled())
  })
})
