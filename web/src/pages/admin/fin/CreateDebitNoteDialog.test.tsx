// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { CreateDebitNoteDialog } from './CreateDebitNoteDialog'

const apiMock = vi.hoisted(() => ({
  createAdminDebitNote: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    runElevated: async (action: () => Promise<unknown>) => action(),
  }),
}))

function renderDialog(open = true) {
  const onOpenChange = vi.fn()
  const onCreated = vi.fn()
  render(
    <ToastProvider>
      <CreateDebitNoteDialog
        open={open}
        onOpenChange={onOpenChange}
        invoice={{
          id: 'inv-123',
          invoice_number: 'INV-1001',
          currency: 'SAR',
          total_minor: '8000',
          status: 'ISSUED',
        }}
        onCreated={onCreated}
      />
    </ToastProvider>,
  )
  return { onOpenChange, onCreated }
}

beforeEach(() => {
  apiMock.createAdminDebitNote.mockResolvedValue({
    noteId: 'dn-1',
    status: 'ISSUED',
    noteNumber: 'DN-42',
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CreateDebitNoteDialog (PA-INV-004)', () => {
  it('submits an elevated debit note against the selected invoice', async () => {
    const user = userEvent.setup()
    const { onCreated } = renderDialog()
    const dialog = await screen.findByRole('dialog')

    await user.clear(within(dialog).getByLabelText(/Amount \(minor units\)/i))
    await user.type(within(dialog).getByLabelText(/Amount \(minor units\)/i), '500')
    await user.clear(within(dialog).getByLabelText(/Reason code/i))
    await user.type(within(dialog).getByLabelText(/Reason code/i), 'TEST_CORRECTION')
    await user.click(within(dialog).getByRole('button', { name: /Issue debit note/i }))

    await waitFor(() =>
      expect(apiMock.createAdminDebitNote).toHaveBeenCalledWith('inv-123', {
        amount_minor: 500,
        reason_code: 'TEST_CORRECTION',
      }),
    )
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
  })
})
