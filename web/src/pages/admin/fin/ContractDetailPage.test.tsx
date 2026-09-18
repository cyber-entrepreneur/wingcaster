// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ContractDetailPage } from './ContractDetailPage'

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

const sampleContract = {
  id: 'contract-1',
  contract_number: 'C-1001',
  tenant_public_id: 'tenant-acme',
  status: 'ACTIVE',
  billing_currency: 'USD',
  starts_at: '2026-01-01T00:00:00.000Z',
  ends_at: null,
  version: 3,
  component_count: 1,
  active_version: {
    id: 'ver-2',
    version_n: 2,
    status: 'ACTIVE',
    effective_from: '2026-01-01T00:00:00.000Z',
    components: [
      { id: 'cmp-1', component_type: 'METER_PRICE', price_code: 'social.post', price_unit_rate_minor: 99, price_currency: 'USD' },
    ],
  },
  versions: [
    { id: 'ver-2', version_n: 2, status: 'ACTIVE', effective_from: '2026-01-01T00:00:00.000Z', components: [] },
    { id: 'ver-1', version_n: 1, status: 'DRAFT', effective_from: '2026-02-01T00:00:00.000Z', components: [] },
  ],
}

function renderDetail(id = 'contract-1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/fin/contracts/${id}`]}>
      <Routes>
        <Route path="/admin/fin/contracts/:id" element={<ContractDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ContractDetailPage (PA-CON-002)', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    finGetMock.mockResolvedValue(sampleContract)
    finPostMock.mockResolvedValue({ ok: true })
  })

  it('loads contract detail and renders components', async () => {
    renderDetail()
    expect(await screen.findByText('C-1001')).toBeInTheDocument()
    expect(screen.getByText('social.post')).toBeInTheDocument()
    expect(screen.getByText('Components')).toBeInTheDocument()
    expect(screen.getByText('Version timeline')).toBeInTheDocument()
  })

  it('shows error state when contract is missing', async () => {
    finGetMock.mockRejectedValueOnce(new Error('Not found'))
    renderDetail('missing')
    expect(await screen.findByText('Not found')).toBeInTheDocument()
  })

  it('activates a draft version', async () => {
    renderDetail()
    await screen.findByText('Activate')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Activate' }))
    await waitFor(() => {
      expect(finPostMock).toHaveBeenCalledWith(
        '/contracts/contract-1/versions/ver-1/activate',
        expect.objectContaining({ expected_version: 3 }),
      )
    })
  })

  it('opens terminate confirmation dialog', async () => {
    renderDetail()
    await screen.findByRole('button', { name: 'Terminate' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Terminate' }))
    expect(await screen.findByText('Terminate contract?')).toBeInTheDocument()
  })
})
