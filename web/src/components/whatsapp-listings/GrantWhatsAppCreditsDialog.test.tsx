// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { GrantWhatsAppCreditsDialog } from './GrantWhatsAppCreditsDialog'

const apiMock = vi.hoisted(() => ({
  grantAdminWhatsAppListingsCredits: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    runElevated: async (action: () => Promise<unknown>) => action(),
  }),
}))

function renderDialog(open = true) {
  const onOpenChange = vi.fn()
  const onGranted = vi.fn()
  render(
    <ToastProvider>
      <GrantWhatsAppCreditsDialog
        open={open}
        onOpenChange={onOpenChange}
        target={{ scope: 'agent', scopeId: 'agent-123', label: 'agent-123' }}
        onGranted={onGranted}
      />
    </ToastProvider>,
  )
  return { onOpenChange, onGranted }
}

beforeEach(() => {
  apiMock.grantAdminWhatsAppListingsCredits.mockResolvedValue({
    success: true,
    balance: { credits_remaining: 125 },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('GrantWhatsAppCreditsDialog (PA-WLA-003)', () => {
  it('submits an elevated WhatsApp credit grant', async () => {
    const user = userEvent.setup()
    const { onGranted } = renderDialog()
    const dialog = await screen.findByRole('dialog')

    await user.clear(within(dialog).getByLabelText(/Amount \(USD\)/i))
    await user.type(within(dialog).getByLabelText(/Amount \(USD\)/i), '40')
    await user.type(within(dialog).getByLabelText(/Reason/i), 'Outage goodwill credit')
    await user.click(within(dialog).getByRole('button', { name: /Grant credits/i }))

    await waitFor(() =>
      expect(apiMock.grantAdminWhatsAppListingsCredits).toHaveBeenCalledWith({
        scope: 'agent',
        scope_id: 'agent-123',
        amount_usd: 40,
        reason: 'Outage goodwill credit',
      }),
    )
    await waitFor(() => expect(onGranted).toHaveBeenCalled())
  })
})
