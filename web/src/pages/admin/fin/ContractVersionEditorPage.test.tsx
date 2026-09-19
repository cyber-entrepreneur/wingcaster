// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ContractVersionEditorPage } from './ContractVersionEditorPage'

const finGetMock = vi.fn()
const finPostMock = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    finGet: (...args: unknown[]) => finGetMock(...args),
    finPost: (...args: unknown[]) => finPostMock(...args),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true }),
}))

const contract = {
  id: 'contract-1',
  contract_number: 'C-1001',
  status: 'ACTIVE',
  billing_currency: 'USD',
  version: 2,
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/admin/fin/contracts/contract-1/versions/new']}>
      <Routes>
        <Route path="/admin/fin/contracts/:contractId/versions/new" element={<ContractVersionEditorPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ContractVersionEditorPage (PA-CON-003)', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    finGetMock.mockImplementation(async (path: string) => {
      if (path === '/contracts') return { contracts: [contract] }
      if (path === '/prices/active-catalog') {
        return { prices: [{ id: 'price-1', code: 'social.post', currency: 'USD', unit_rate_minor: 100 }] }
      }
      return {}
    })
    finPostMock.mockResolvedValue({ id: 'ver-new' })
  })

  it('loads contract header and price catalog', async () => {
    renderEditor()
    expect(await screen.findByText('C-1001')).toBeInTheDocument()
    expect(screen.getByText(/social.post/)).toBeInTheDocument()
    expect(screen.getByText('Preview total')).toBeInTheDocument()
  })

  it('shows validation error when effective from missing', async () => {
    renderEditor()
    await screen.findByText('Save draft')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Effective from is required.')).toBeInTheDocument()
    expect(finPostMock).not.toHaveBeenCalled()
  })

  it('saves draft version', async () => {
    renderEditor()
    await screen.findByLabelText('Effective from')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Effective from'), '2026-02-01T10:00')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => {
      expect(finPostMock).toHaveBeenCalledWith(
        '/contracts/contract-1/versions',
        expect.objectContaining({
          effective_from: expect.any(String),
          components: expect.any(Array),
        }),
      )
    })
  })

  it('submits draft then activates', async () => {
    renderEditor()
    await screen.findByLabelText('Effective from')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Effective from'), '2026-02-01T10:00')
    await user.click(screen.getByRole('button', { name: 'Submit for activation' }))
    await waitFor(() => {
      expect(finPostMock).toHaveBeenCalledWith('/contracts/contract-1/versions', expect.any(Object))
      expect(finPostMock).toHaveBeenCalledWith(
        '/contracts/contract-1/versions/ver-new/activate',
        expect.objectContaining({ expected_version: 2 }),
      )
    })
  })
})
