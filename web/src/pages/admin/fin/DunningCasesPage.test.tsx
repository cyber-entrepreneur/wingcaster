// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { DunningCasesPage } from './DunningCasesPage'

const apiMock = vi.hoisted(() => ({
  finGet: vi.fn(),
  finPost: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true }),
}))
vi.mock('@/context/StepUpContext', () => ({
  useStepUp: () => ({
    runElevated: async (action: () => Promise<unknown>) => action(),
  }),
}))

beforeEach(() => {
  apiMock.finGet.mockResolvedValue({
    cases: [{
      id: 'case-1',
      tenant_id: 'tenant-1',
      invoice_id: 'inv-1',
      status: 'OPEN',
      created_at: '2026-09-19T00:00:00.000Z',
    }],
  })
  apiMock.finPost.mockResolvedValue({ ok: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DunningCasesPage (PA-DUN-001)', () => {
  it('loads cases and advances the selected row', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ToastProvider>
          <DunningCasesPage />
        </ToastProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Dunning cases' })).toBeTruthy()
    await user.click(await screen.findByText('case-1'))
    await user.click(screen.getByRole('button', { name: 'Advance selected' }))

    await waitFor(() =>
      expect(apiMock.finPost).toHaveBeenCalledWith('/dunning/cases/case-1/advance'),
    )
  })
})
